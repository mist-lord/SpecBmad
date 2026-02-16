/**
 * BoundaryGuard Unit Tests
 *
 * Tests the main security controller for tool permission validation.
 * @see ADR-ARCH-004-boundary-driven-architecture.md v2.1
 */

import {
  BoundaryGuard,
  createBoundaryGuard,
  executeWithGuard,
  executeWithGuardSafe,
} from '@/core/boundary/guard';
import { ContractLoader } from '@/core/boundary/contract';
import { CircuitBreaker } from '@/core/boundary/circuit-breaker';
import {
  AgentContract,
  ContractViolation,
  IContractLoader,
  SecurityEvent,
} from '@/core/boundary/types';

describe('BoundaryGuard', () => {
  let guard: BoundaryGuard;
  let contractLoader: ContractLoader;
  let circuitBreaker: CircuitBreaker;

  const developerContract: AgentContract = {
    name: 'Developer',
    scope: {
      read: ['architecture.md', 'plan.yaml'],
      write: ['src/**', 'tests/**'],
      forbidden: ['需求分析', '架构设计'],
    },
    allowed_tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'],
    allowed_paths: ['src/**', 'tests/**', 'config/**'],
    input_schema: 'DesignSpec',
    output_schema: 'CodeArtifacts',
  };

  beforeEach(() => {
    contractLoader = new ContractLoader();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      halfOpenMaxAttempts: 2,
    });

    guard = new BoundaryGuard(
      contractLoader,
      { enableAuditLog: true },
      undefined,
      circuitBreaker
    );
  });

  describe('checkPermission', () => {
    it('should allow valid tool calls', async () => {
      const permission = await guard.checkPermission({
        toolName: 'Read',
        toolInput: { file_path: 'src/index.ts' },
        agentName: 'Developer',
      });

      expect(permission.allowed).toBe(true);
    });

    it('should reject when contract not found', async () => {
      const permission = await guard.checkPermission({
        toolName: 'Read',
        toolInput: { file_path: 'src/index.ts' },
        agentName: 'UnknownAgent',
      });

      expect(permission.allowed).toBe(false);
      expect(permission.reason).toBe('contract-not-found');
    });

    it('should reject tool not in allowed list', async () => {
      const permission = await guard.checkPermission({
        toolName: 'Delete',
        toolInput: { file_path: 'src/index.ts' },
        agentName: 'QA', // QA cannot use Delete
      });

      expect(permission.allowed).toBe(false);
      expect(permission.reason).toBe('tool-not-allowed');
    });

    it('should reject path outside allowed paths', async () => {
      const permission = await guard.checkPermission({
        toolName: 'Write',
        toolInput: { file_path: '/etc/passwd', content: 'malicious' },
        agentName: 'Developer',
      });

      expect(permission.allowed).toBe(false);
      expect(permission.reason).toBe('path-not-allowed');
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should block unsafe tools when circuit is open', async () => {
      // Force circuit open
      circuitBreaker.forceState('open');

      const permission = await guard.checkPermission({
        toolName: 'Write',
        toolInput: { file_path: 'src/index.ts', content: 'code' },
        agentName: 'Developer',
      });

      expect(permission.allowed).toBe(false);
      expect(permission.reason).toBe('circuit-breaker-open-unsafe-tool');
    });

    it('should allow safe tools when circuit is open', async () => {
      circuitBreaker.forceState('open');

      const permission = await guard.checkPermission({
        toolName: 'Read',
        toolInput: { file_path: 'src/index.ts' },
        agentName: 'Developer',
      });

      expect(permission.allowed).toBe(true);
      expect(permission.reason).toBe('safe-mode');
    });

    it('should return correct circuit state', () => {
      expect(guard.getCircuitState()).toBe('closed');

      circuitBreaker.forceState('open');
      expect(guard.getCircuitState()).toBe('open');
    });

    it('should record failures manually', () => {
      guard.recordFailure();
      guard.recordFailure();
      guard.recordFailure();

      expect(guard.getCircuitState()).toBe('open');
    });

    it('should record successes manually', async () => {
      circuitBreaker.forceState('half-open');

      guard.recordSuccess();
      guard.recordSuccess();

      expect(guard.getCircuitState()).toBe('closed');
    });
  });

  describe('Security Event Emission', () => {
    it('should emit tool_allowed event on success', async () => {
      const events: SecurityEvent[] = [];
      guard.addEventListener((event) => events.push(event));

      await guard.checkPermission({
        toolName: 'Read',
        toolInput: { file_path: 'src/index.ts' },
        agentName: 'Developer',
      });

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('tool_allowed');
      expect(events[0].agentName).toBe('Developer');
      expect(events[0].toolName).toBe('Read');
    });

    it('should emit tool_blocked event on failure', async () => {
      const events: SecurityEvent[] = [];
      guard.addEventListener((event) => events.push(event));

      await guard.checkPermission({
        toolName: 'Delete',
        toolInput: { file_path: 'src/index.ts' },
        agentName: 'Developer',
      });

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('tool_blocked');
    });

    it('should allow removing event listeners', async () => {
      const events: SecurityEvent[] = [];
      const listener = (event: SecurityEvent) => events.push(event);

      guard.addEventListener(listener);
      guard.removeEventListener(listener);

      await guard.checkPermission({
        toolName: 'Read',
        toolInput: { file_path: 'src/index.ts' },
        agentName: 'Developer',
      });

      expect(events.length).toBe(0);
    });
  });

  describe('validateOutput (SEC-005)', () => {
    it('should reject null output', async () => {
      const result = await guard.validateOutput(null, 'CodeArtifacts');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Output is null or undefined');
    });

    it('should reject undefined output', async () => {
      const result = await guard.validateOutput(undefined, 'CodeArtifacts');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Output is null or undefined');
    });

    it('should reject unknown schema names (fail-closed)', async () => {
      const result = await guard.validateOutput({ data: 'test' }, 'UnknownSchema');

      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('Unknown output schema');
    });

    it('should accept valid CodeArtifacts output', async () => {
      const validCodeArtifacts = {
        files: [
          { path: 'src/index.ts', content: 'console.log("hello");', language: 'typescript' },
        ],
      };
      const result = await guard.validateOutput(validCodeArtifacts, 'CodeArtifacts');

      expect(result.valid).toBe(true);
    });

    it('should reject invalid CodeArtifacts output (missing files)', async () => {
      const invalidOutput = { metadata: { agent: 'Developer' } };
      const result = await guard.validateOutput(invalidOutput, 'CodeArtifacts');

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some((e) => e.includes('files'))).toBe(true);
    });

    it('should accept valid QAReport output', async () => {
      const validQAReport = {
        summary: { passed: 10, failed: 2, skipped: 1, coverage: 85 },
        testResults: [
          { name: 'test1', status: 'passed' },
          { name: 'test2', status: 'failed', error: 'assertion failed' },
        ],
      };
      const result = await guard.validateOutput(validQAReport, 'QAReport');

      expect(result.valid).toBe(true);
    });

    it('should reject invalid QAReport output (invalid status)', async () => {
      const invalidReport = {
        summary: { passed: 10, failed: 2 },
        testResults: [{ name: 'test1', status: 'unknown' }], // invalid status
      };
      const result = await guard.validateOutput(invalidReport, 'QAReport');

      expect(result.valid).toBe(false);
    });

    it('should accept valid SecurityReport output', async () => {
      const validSecurityReport = {
        summary: { critical: 0, high: 1, medium: 2, low: 3 },
        findings: [
          {
            id: 'SEC-001',
            severity: 'HIGH',
            title: 'SQL Injection',
            description: 'Unsanitized input in query',
            location: 'src/db.ts:42',
          },
        ],
        passed: false,
      };
      const result = await guard.validateOutput(validSecurityReport, 'SecurityReport');

      expect(result.valid).toBe(true);
    });

    it('should provide detailed error paths for nested validation failures', async () => {
      const invalidOutput = {
        files: [
          { path: '', content: 'code' }, // path is empty string, should fail min(1)
        ],
      };
      const result = await guard.validateOutput(invalidOutput, 'CodeArtifacts');

      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes('files'))).toBe(true);
    });
  });

  describe('getContract', () => {
    it('should return contract for known agent', () => {
      const contract = guard.getContract('Developer');

      expect(contract).toBeDefined();
      expect(contract?.name).toBe('Developer');
    });

    it('should return undefined for unknown agent', () => {
      const contract = guard.getContract('NonExistent');

      expect(contract).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker', () => {
      circuitBreaker.forceState('open');
      expect(guard.getCircuitState()).toBe('open');

      guard.reset();
      expect(guard.getCircuitState()).toBe('closed');
    });
  });
});

describe('executeWithGuard', () => {
  let guard: BoundaryGuard;
  let contractLoader: ContractLoader;
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    contractLoader = new ContractLoader();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      halfOpenMaxAttempts: 2,
    });
    guard = new BoundaryGuard(
      contractLoader,
      { enableAuditLog: true },
      undefined,
      circuitBreaker
    );
  });

  it('should execute when permission granted', async () => {
    const result = await executeWithGuard(
      guard,
      {
        toolName: 'Read',
        toolInput: { file_path: 'src/index.ts' },
        agentName: 'Developer',
      },
      async () => 'success'
    );

    expect(result).toBe('success');
  });

  it('should throw ContractViolation when permission denied', async () => {
    await expect(
      executeWithGuard(
        guard,
        {
          toolName: 'Delete',
          toolInput: { file_path: 'src/index.ts' },
          agentName: 'Developer',
        },
        async () => 'should not reach'
      )
    ).rejects.toThrow(ContractViolation);
  });

  it('should record success after successful execution', async () => {
    const events: SecurityEvent[] = [];
    guard.addEventListener((event) => events.push(event));

    await executeWithGuard(
      guard,
      {
        toolName: 'Read',
        toolInput: { file_path: 'src/index.ts' },
        agentName: 'Developer',
      },
      async () => 'success'
    );

    // Permission check emits tool_allowed, but success is recorded internally
    expect(events.some((e) => e.type === 'tool_allowed')).toBe(true);
  });

  it('should record failure when executor throws', async () => {
    // Force near-open state
    guard.recordFailure();
    guard.recordFailure();

    await expect(
      executeWithGuard(
        guard,
        {
          toolName: 'Read',
          toolInput: { file_path: 'src/index.ts' },
          agentName: 'Developer',
        },
        async () => {
          throw new Error('Execution failed');
        }
      )
    ).rejects.toThrow('Execution failed');

    // After this failure, circuit should be open
    expect(guard.getCircuitState()).toBe('open');
  });
});

describe('createBoundaryGuard', () => {
  it('should create guard with contract loader', () => {
    const loader = new ContractLoader();
    const guard = createBoundaryGuard(loader);

    expect(guard).toBeInstanceOf(BoundaryGuard);
  });

  it('should create guard with custom config', () => {
    const loader = new ContractLoader();
    const guard = createBoundaryGuard(loader, {
      enableAuditLog: false,
    });

    // No events should be emitted when audit log is disabled and no listeners
    const events: SecurityEvent[] = [];
    // Don't add listener, events should still be empty

    expect(guard).toBeInstanceOf(BoundaryGuard);
  });
});

describe('TOCTOU Protection', () => {
  let guard: BoundaryGuard;
  let contractLoader: ContractLoader;

  beforeEach(() => {
    contractLoader = new ContractLoader();
    guard = new BoundaryGuard(contractLoader, { enableAuditLog: true });
  });

  it('should deep freeze nested objects in toolInput', async () => {
    const toolInput = {
      file_path: 'src/index.ts',
      options: {
        nested: {
          value: 'original',
        },
      },
    };

    await guard.checkPermission({
      toolName: 'Read',
      toolInput,
      agentName: 'Developer',
    });

    // The original should still be mutable (we clone before freeze)
    expect(() => {
      toolInput.options.nested.value = 'modified';
    }).not.toThrow();
    expect(toolInput.options.nested.value).toBe('modified');
  });

  it('should reject non-JSON-serializable input', async () => {
    const circularRef: Record<string, unknown> = { name: 'test' };
    circularRef['self'] = circularRef;

    const permission = await guard.checkPermission({
      toolName: 'Read',
      toolInput: circularRef,
      agentName: 'Developer',
    });

    expect(permission.allowed).toBe(false);
    expect(permission.reason).toBe('validation-error');
    expect(permission.details?.error).toBe('non-serializable input');
  });

  it('should reject non-serializable input in executeWithGuard', async () => {
    const circularRef: Record<string, unknown> = { name: 'test' };
    circularRef['self'] = circularRef;

    await expect(
      executeWithGuard(
        guard,
        {
          toolName: 'Read',
          toolInput: circularRef,
          agentName: 'Developer',
        },
        async () => 'should not reach'
      )
    ).rejects.toThrow('validation-error');
  });

  it('should reject input with getters', async () => {
    const inputWithGetter = {
      get file_path() {
        return 'src/index.ts';
      },
    };

    const permission = await guard.checkPermission({
      toolName: 'Read',
      toolInput: inputWithGetter as Record<string, unknown>,
      agentName: 'Developer',
    });

    expect(permission.allowed).toBe(false);
    expect(permission.reason).toBe('validation-error');
    expect(permission.details?.error).toBe('input has getters or toJSON');
  });

  it('should reject input with toJSON method', async () => {
    const inputWithToJSON = {
      file_path: 'malicious.ts',
      toJSON() {
        return { file_path: 'safe.ts' };
      },
    };

    const permission = await guard.checkPermission({
      toolName: 'Read',
      toolInput: inputWithToJSON as unknown as Record<string, unknown>,
      agentName: 'Developer',
    });

    expect(permission.allowed).toBe(false);
    expect(permission.reason).toBe('validation-error');
    expect(permission.details?.error).toBe('input has getters or toJSON');
  });

  it('should reject input with nested getters', async () => {
    const inputWithNestedGetter = {
      file_path: 'src/index.ts',
      options: {
        get basePath() {
          return '/etc/passwd';
        },
      },
    };

    const permission = await guard.checkPermission({
      toolName: 'Read',
      toolInput: inputWithNestedGetter as Record<string, unknown>,
      agentName: 'Developer',
    });

    expect(permission.allowed).toBe(false);
    expect(permission.reason).toBe('validation-error');
    expect(permission.details?.error).toBe('input has getters or toJSON');
  });
});

describe('executeWithGuardSafe', () => {
  let guard: BoundaryGuard;
  let contractLoader: ContractLoader;

  beforeEach(() => {
    contractLoader = new ContractLoader();
    guard = new BoundaryGuard(contractLoader, { enableAuditLog: true });
  });

  it('should pass frozen input to executor', async () => {
    let receivedInput: Record<string, unknown> | undefined;

    await executeWithGuardSafe(
      guard,
      {
        toolName: 'Read',
        toolInput: { file_path: 'src/index.ts' },
        agentName: 'Developer',
      },
      async (frozenInput) => {
        receivedInput = frozenInput;
        return 'success';
      }
    );

    expect(receivedInput).toBeDefined();
    expect(receivedInput?.file_path).toBe('src/index.ts');

    // Verify the input is frozen
    expect(Object.isFrozen(receivedInput)).toBe(true);
  });

  it('should prevent mutation of frozen input in executor', async () => {
    await executeWithGuardSafe(
      guard,
      {
        toolName: 'Read',
        toolInput: { file_path: 'src/index.ts' },
        agentName: 'Developer',
      },
      async (frozenInput) => {
        // Attempt to mutate should throw in strict mode
        expect(() => {
          (frozenInput as Record<string, unknown>).file_path = 'malicious.ts';
        }).toThrow();
        return 'success';
      }
    );
  });

  it('should throw ContractViolation when permission denied', async () => {
    await expect(
      executeWithGuardSafe(
        guard,
        {
          toolName: 'Delete',
          toolInput: { file_path: 'src/index.ts' },
          agentName: 'Developer',
        },
        async () => 'should not reach'
      )
    ).rejects.toThrow(ContractViolation);
  });
});
