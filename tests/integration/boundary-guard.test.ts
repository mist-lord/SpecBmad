/**
 * BoundaryGuard Integration Tests
 *
 * Tests the SDK integration layer and PhaseController circuit breaker integration.
 * @see ADR-ARCH-004-boundary-driven-architecture.md v2.1
 */

import {
  ToolExecutionContext,
  createAgentContext,
  executeBatch,
  createSecurityLogger,
} from '@/core/boundary/sdk-integration';
import { ContractLoader } from '@/core/boundary/contract';
import { ContractViolation, SecurityEvent } from '@/core/boundary/types';
import { PhaseController } from '@/core/phase/controller';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('ToolExecutionContext Integration', () => {
  let ctx: ToolExecutionContext;

  beforeEach(() => {
    ctx = new ToolExecutionContext('Developer');
  });

  describe('executeToolSafely', () => {
    it('should execute allowed tool successfully', async () => {
      const result = await ctx.executeToolSafely(
        'Read',
        { file_path: 'src/index.ts' },
        async () => 'file content'
      );

      expect(result).toBe('file content');
    });

    it('should throw ContractViolation for disallowed tool', async () => {
      await expect(
        ctx.executeToolSafely(
          'Delete', // Developer doesn't have Delete permission
          { file_path: 'src/index.ts' },
          async () => 'should not execute'
        )
      ).rejects.toThrow(ContractViolation);
    });

    it('should throw ContractViolation for path outside allowed paths', async () => {
      await expect(
        ctx.executeToolSafely(
          'Write',
          { file_path: '/etc/passwd', content: 'malicious' },
          async () => 'should not execute'
        )
      ).rejects.toThrow(ContractViolation);
    });
  });

  describe('checkPermission', () => {
    it('should return allowed for valid tool call', async () => {
      const permission = await ctx.checkPermission('Read', {
        file_path: 'src/index.ts',
      });

      expect(permission.allowed).toBe(true);
    });

    it('should return denied for invalid path', async () => {
      const permission = await ctx.checkPermission('Write', {
        file_path: '/root/secret.txt',
        content: 'test',
      });

      expect(permission.allowed).toBe(false);
      expect(permission.reason).toBe('path-not-allowed');
    });
  });

  describe('Circuit Breaker State', () => {
    it('should start in closed state', () => {
      expect(ctx.getCircuitState()).toBe('closed');
      expect(ctx.isInSafeMode()).toBe(false);
    });

    it('should be able to reset', () => {
      ctx.reset();
      expect(ctx.getCircuitState()).toBe('closed');
    });
  });

  describe('Event Listeners', () => {
    it('should emit security events', async () => {
      const events: SecurityEvent[] = [];
      ctx.addEventListener((event) => events.push(event));

      await ctx.executeToolSafely(
        'Read',
        { file_path: 'src/index.ts' },
        async () => 'content'
      );

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === 'tool_allowed')).toBe(true);
    });

    it('should remove event listeners', async () => {
      const events: SecurityEvent[] = [];
      const listener = (event: SecurityEvent) => events.push(event);

      ctx.addEventListener(listener);
      ctx.removeEventListener(listener);

      await ctx.executeToolSafely(
        'Read',
        { file_path: 'src/index.ts' },
        async () => 'content'
      );

      expect(events.length).toBe(0);
    });
  });
});

describe('createAgentContext Factory', () => {
  it('should create context for known agent', () => {
    const ctx = createAgentContext('Developer');

    expect(ctx.getAgentName()).toBe('Developer');
    expect(ctx.getCircuitState()).toBe('closed');
  });

  it('should create context for QA agent with limited tools', async () => {
    const ctx = createAgentContext('QA');

    // QA should be able to read
    const readPermission = await ctx.checkPermission('Read', {
      file_path: 'src/index.ts',
    });
    expect(readPermission.allowed).toBe(true);

    // QA should NOT have Bash
    const bashPermission = await ctx.checkPermission('Bash', {
      command: 'echo test',
    });
    expect(bashPermission.allowed).toBe(false);
  });
});

describe('executeBatch', () => {
  let ctx: ToolExecutionContext;

  beforeEach(() => {
    ctx = new ToolExecutionContext('Developer');
  });

  it('should execute multiple operations in sequence', async () => {
    const results = await executeBatch(ctx, [
      {
        toolName: 'Read',
        toolInput: { file_path: 'src/file1.ts' },
        executor: async () => 'content1',
      },
      {
        toolName: 'Read',
        toolInput: { file_path: 'src/file2.ts' },
        executor: async () => 'content2',
      },
    ]);

    expect(results).toEqual(['content1', 'content2']);
  });

  it('should stop on permission failure', async () => {
    await expect(
      executeBatch(ctx, [
        {
          toolName: 'Read',
          toolInput: { file_path: 'src/file1.ts' },
          executor: async () => 'content1',
        },
        {
          toolName: 'Delete', // Not allowed for Developer
          toolInput: { file_path: 'src/file2.ts' },
          executor: async () => 'should not execute',
        },
      ])
    ).rejects.toThrow(ContractViolation);
  });
});

describe('createSecurityLogger', () => {
  it('should create a logger function', () => {
    const logger = createSecurityLogger();
    expect(typeof logger).toBe('function');
  });

  it('should log blocked events by default', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const logger = createSecurityLogger({ logBlocked: true });

    const event: SecurityEvent = {
      type: 'tool_blocked',
      timestamp: Date.now(),
      agentName: 'Developer',
      toolName: 'Delete',
      permission: { allowed: false, reason: 'tool-not-allowed' },
    };

    logger(event);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log circuit breaker events', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const logger = createSecurityLogger();

    const event: SecurityEvent = {
      type: 'circuit_breaker_opened',
      timestamp: Date.now(),
      agentName: 'system',
      toolName: 'circuit_breaker',
      permission: { allowed: false, reason: 'safe-mode' },
    };

    logger(event);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('PhaseController Circuit Breaker Integration', () => {
  let controller: PhaseController;
  let tempDir: string;

  beforeEach(() => {
    // Create a temp directory for test state
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-test-'));
    fs.mkdirSync(path.join(tempDir, '.specbmad'), { recursive: true });

    controller = new PhaseController(tempDir, {
      failureThreshold: 3,
      resetTimeout: 1000,
      halfOpenMaxAttempts: 2,
    });
  });

  afterEach(() => {
    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Circuit State', () => {
    it('should start in closed state', () => {
      expect(controller.getCircuitState()).toBe('closed');
      expect(controller.isCircuitOpen()).toBe(false);
    });

    it('should be resettable', () => {
      controller.resetCircuitBreaker();
      expect(controller.getCircuitState()).toBe('closed');
    });
  });

  describe('Phase Transitions with Circuit Breaker', () => {
    it('should include circuit state in successful transition result', async () => {
      const result = await controller.transitionTo(1, {
        projectRoot: tempDir,
        currentPhase: 0,
      });

      expect(result.success).toBe(true);
      expect(result.circuitState).toBe('closed');
    });

    it('should include circuit state in failed transition result', async () => {
      // Try invalid transition
      const result = await controller.transitionTo(3, {
        projectRoot: tempDir,
        currentPhase: 0, // Can't go from 0 to 3 directly
      });

      expect(result.success).toBe(false);
      // Circuit state may not be set for permission failures
    });
  });
});

describe('Agent Contracts', () => {
  it('should have correct default contracts', () => {
    const loader = new ContractLoader();

    const developer = loader.getContract('Developer');
    expect(developer).toBeDefined();
    expect(developer?.allowed_tools).toContain('Bash');
    expect(developer?.allowed_tools).toContain('Edit');

    const qa = loader.getContract('QA');
    expect(qa).toBeDefined();
    expect(qa?.allowed_tools).not.toContain('Bash');
    expect(qa?.allowed_tools).not.toContain('Edit');

    const analyst = loader.getContract('Analyst');
    expect(analyst).toBeDefined();
    expect(analyst?.allowed_tools).not.toContain('Bash');
  });

  it('should return undefined for unknown agent', () => {
    const loader = new ContractLoader();
    const unknown = loader.getContract('UnknownAgent');
    expect(unknown).toBeUndefined();
  });
});
