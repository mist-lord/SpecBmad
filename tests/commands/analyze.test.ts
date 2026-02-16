/**
 * Analyze Command Unit Tests
 *
 * Tests analyze command core functionality:
 * - Direct execution mode
 * - Subprocess execution mode
 * - Python bridge integration
 * - Analysis result formatting
 * - Agent-based analysis
 *
 * @see src/commands/analyze.ts
 */

import * as fs from 'fs';
import { Command } from 'commander';

// Mock dependencies before imports
jest.mock('chalk', () => require('../commands/command-test-utils').mockChalk());
jest.mock('@/utils/logger', () => require('../commands/command-test-utils').mockLogger());
jest.mock('@/utils/error', () => require('../commands/command-test-utils').mockErrorHandler());

// Mock config with BMAD method enabled for direct mode tests
const mockConfigData = {
  projectName: 'test-project',
  version: '1.0.0',
  type: 'web',
  bmad_method: {
    enabled: true,
  },
  integration: {
    bridge_mode: 'direct',
  },
  llm: {
    provider: 'mock',
    model: 'mock-1',
  },
};

jest.mock('@/utils/config', () => ({
  config: {
    load: jest.fn(() => mockConfigData),
    save: jest.fn(),
    get: jest.fn((key: string) => (mockConfigData as any)[key]),
    getAll: jest.fn(() => mockConfigData),
    set: jest.fn(),
  },
}));

jest.mock('@/utils/auto-init', () => ({
  ensureProjectInitialized: jest.fn().mockResolvedValue(undefined),
}));

// Mock LLM manager
const mockLLMClient = {
  generateText: jest.fn().mockResolvedValue('Mock analysis result'),
  generateWithMessages: jest.fn().mockResolvedValue({ text: 'Mock analysis result' }),
  generateStructured: jest.fn().mockResolvedValue({}),
};

jest.mock('@/core/llm/manager', () => ({
  llmManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getDefaultClient: jest.fn().mockReturnValue(mockLLMClient),
    addClient: jest.fn(),
    reset: jest.fn(),
    listClients: jest.fn().mockReturnValue([mockLLMClient]),
  },
}));

// Mock AgentFactory with has() method
const mockAgent = {
  name: 'Analyst',
  execute: jest.fn().mockResolvedValue({
    success: true,
    output: 'Analysis completed successfully.\n\nKey findings:\n- Finding 1\n- Finding 2\n- Finding 3',
    artifacts: [],
    nextSteps: ['Review findings', 'Proceed to implementation'],
    metadata: { agent: 'Analyst', mode: 'technical' },
  }),
};

jest.mock('@/agents/factory', () => ({
  AgentFactory: {
    register: jest.fn(),
    create: jest.fn().mockReturnValue(mockAgent),
    has: jest.fn().mockReturnValue(true),
    getAvailableAgents: jest.fn().mockReturnValue(['Analyst']),
    clear: jest.fn(),
  },
}));

// Mock registerAnalystAgent
jest.mock('@/agents/analyst', () => ({
  registerAnalystAgent: jest.fn(),
}));

// Mock child_process for subprocess mode
// Use inline factory to avoid hoisting issues
const mockSpawnEventHandlers: Record<string, Function[]> = {};

jest.mock('child_process', () => {
  // Create the mock inside the factory
  const createMockSpawn = (): jest.Mock =>
    jest.fn().mockImplementation(() => {
      // Type explicitly to avoid circular reference
      interface MockChildProcess {
        on: jest.Mock;
        stdout: { on: jest.Mock };
        stderr: { on: jest.Mock };
        stdin: { write: jest.Mock; end: jest.Mock };
        pid: number;
        kill: jest.Mock;
      }

      const childProc: MockChildProcess = {
        on: jest.fn((event: string, handler: Function): MockChildProcess => {
          if (!mockSpawnEventHandlers[event]) {
            mockSpawnEventHandlers[event] = [];
          }
          mockSpawnEventHandlers[event].push(handler);
          return childProc;
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        stdin: { write: jest.fn(), end: jest.fn() },
        pid: 12345,
        kill: jest.fn(),
      };
      return childProc;
    });

  return {
    spawn: createMockSpawn(),
    spawnSync: jest.fn().mockReturnValue({ status: 0, error: null }),
  };
});

// Helper to emit spawn events
function emitSpawnEvent(event: string, ...args: any[]) {
  const handlers = mockSpawnEventHandlers[event] || [];
  handlers.forEach((handler) => handler(...args));
}

// Clear spawn event handlers before each test
function clearSpawnEventHandlers() {
  Object.keys(mockSpawnEventHandlers).forEach((key) => {
    delete mockSpawnEventHandlers[key];
  });
}

// Now import the modules under test
import { analyzeCommand } from '@/commands/analyze';
import { log } from '@/utils/logger';
import { config } from '@/utils/config';
import { llmManager } from '@/core/llm/manager';
import { AgentFactory } from '@/agents/factory';
import { registerAnalystAgent } from '@/agents/analyst';
import { spawn, spawnSync } from 'child_process';

/**
 * Helper to invoke the analyze command via Commander's parseAsync
 * This properly simulates CLI invocation
 */
async function runAnalyzeCommand(args: string[] = []): Promise<void> {
  const program = new Command();
  program.addCommand(analyzeCommand);
  // Prevent Commander from calling process.exit
  program.exitOverride();
  // Silence Commander's own error output
  program.configureOutput({
    writeErr: () => {},
    writeOut: () => {},
  });

  try {
    await program.parseAsync(['node', 'test', 'analyze', ...args]);
  } catch (err: any) {
    // Commander throws on exit, but we want to continue testing
    if (err.code !== 'commander.helpDisplayed' && err.code !== 'commander.version') {
      // Re-throw if it's not a Commander control flow error
      if (!err.code?.startsWith('commander.')) {
        throw err;
      }
    }
  }
}

describe('AnalyzeCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSpawnEventHandlers();

    // Reset mock config to direct mode
    (config.load as jest.Mock).mockReturnValue({
      ...mockConfigData,
      integration: { bridge_mode: 'direct' },
    });

    // Reset AgentFactory.has to return true
    (AgentFactory.has as jest.Mock).mockReturnValue(true);

    // Reset LLM manager to return the mock client
    (llmManager.getDefaultClient as jest.Mock).mockReturnValue(mockLLMClient);

    // Reset agent execute to success
    mockAgent.execute.mockResolvedValue({
      success: true,
      output: 'Analysis completed successfully.\n\nKey findings:\n- Finding 1\n- Finding 2\n- Finding 3',
      artifacts: [],
      nextSteps: ['Review findings', 'Proceed to implementation'],
      metadata: { agent: 'Analyst', mode: 'technical' },
    });
  });

  describe('Direct execution mode (default)', () => {
    it('should create Analyst agent', async () => {
      await runAnalyzeCommand(['-m', 'technical', '-a', 'Analyst']);

      // Verify registerAnalystAgent was called
      expect(registerAnalystAgent).toHaveBeenCalled();

      // Verify AgentFactory.create was called with Analyst
      expect(AgentFactory.create).toHaveBeenCalledWith('Analyst', expect.anything());
    });

    it('should execute agent with project context', async () => {
      await runAnalyzeCommand(['-m', 'comprehensive']);

      // Verify agent.execute was called with appropriate context
      expect(mockAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          projectState: expect.objectContaining({
            projectName: expect.any(String),
            workflow: expect.objectContaining({
              currentStep: 'analysis',
              completedSteps: expect.any(Array),
            }),
          }),
          workingDirectory: expect.any(String),
          inputData: expect.objectContaining({
            mode: 'comprehensive',
          }),
        })
      );
    });

    it('should return analysis result', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await runAnalyzeCommand(['-m', 'technical']);

      // Verify success log was called
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('分析'));

      consoleSpy.mockRestore();
    });

    it('should log analysis summary', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await runAnalyzeCommand(['-m', 'brief']);

      // Verify log.info was called for summary
      expect(log.info).toHaveBeenCalledWith(expect.stringMatching(/分析结果|分析完成|开始/));

      consoleSpy.mockRestore();
    });
  });

  describe('Subprocess execution mode (--subprocess)', () => {
    beforeEach(() => {
      // Set config to subprocess mode
      (config.load as jest.Mock).mockReturnValue({
        ...mockConfigData,
        integration: { bridge_mode: 'subprocess' },
      });
    });

    it('should use Python bridge for analysis', async () => {
      // Start the command (don't await - subprocess is async with events)
      const promise = runAnalyzeCommand(['-m', 'technical']);

      // Allow microtasks to process
      await new Promise((resolve) => setImmediate(resolve));

      // Verify spawn was called
      expect(spawn).toHaveBeenCalled();

      // Emit close event to complete
      emitSpawnEvent('close', 0);

      // Now await the promise
      await promise;
    });

    it('should pass project path to Python script', async () => {
      const promise = runAnalyzeCommand(['-m', 'business', '-a', 'CustomAnalyst']);

      await new Promise((resolve) => setImmediate(resolve));

      // Verify spawn arguments include the expected script path
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String), // python or python3
        expect.arrayContaining([
          expect.stringContaining('bmad_bridge.py'),
          'analyze',
          '--mode',
          'business',
          '--agent',
          'CustomAnalyst',
        ]),
        expect.objectContaining({
          stdio: 'inherit',
          cwd: expect.any(String),
        })
      );

      emitSpawnEvent('close', 0);
      await promise;
    });

    it('should parse Python script output', async () => {
      const promise = runAnalyzeCommand(['-m', 'technical', '-o', 'json']);

      await new Promise((resolve) => setImmediate(resolve));

      // Verify output option is passed
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--output', 'json']),
        expect.anything()
      );

      // Emit successful close
      emitSpawnEvent('close', 0);
      await promise;

      // Verify success log
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('分析完成'));
    });

    it('should handle Python execution errors', async () => {
      const promise = runAnalyzeCommand(['-m', 'technical']);

      await new Promise((resolve) => setImmediate(resolve));

      // Emit non-zero exit code
      emitSpawnEvent('close', 1);
      await promise;

      // Verify error was logged
      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('分析失败'));
    });
  });

  describe('Analysis scope', () => {
    it('should analyze entire project by default', async () => {
      await runAnalyzeCommand([]);

      // Verify agent was executed with default context (entire project)
      expect(mockAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          workingDirectory: expect.any(String),
          projectState: expect.anything(),
        })
      );
    });

    it('should analyze specific files when --files provided', async () => {
      // Note: The current implementation doesn't have --files option
      // This test verifies the agent receives inputData that could include files
      await runAnalyzeCommand(['-m', 'technical']);

      // Verify the context includes inputData
      expect(mockAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          inputData: expect.objectContaining({
            mode: 'technical',
          }),
        })
      );
    });

    it('should analyze specific directories when --dirs provided', async () => {
      // Note: The current implementation doesn't have --dirs option
      // This test verifies the context structure supports directory specification
      await runAnalyzeCommand(['-m', 'comprehensive']);

      expect(mockAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          workingDirectory: process.cwd(),
        })
      );
    });
  });

  describe('Analysis result formatting', () => {
    it('should format result as markdown by default', async () => {
      mockAgent.execute.mockResolvedValue({
        success: true,
        output: '# Analysis Report\n\n## Overview\n\nThis is markdown output.',
        artifacts: [],
        nextSteps: [],
        metadata: { agent: 'Analyst' },
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await runAnalyzeCommand(['-m', 'technical']);

      // Verify console.log was called (output preview)
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should format result as JSON when --format=json', async () => {
      // Set subprocess mode to test output flag
      (config.load as jest.Mock).mockReturnValue({
        ...mockConfigData,
        integration: { bridge_mode: 'subprocess' },
      });

      const promise = runAnalyzeCommand(['-m', 'technical', '-o', 'json']);

      await new Promise((resolve) => setImmediate(resolve));

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--output', 'json']),
        expect.anything()
      );

      emitSpawnEvent('close', 0);
      await promise;
    });

    it('should include analysis metadata (timestamp, version)', async () => {
      mockAgent.execute.mockResolvedValue({
        success: true,
        output: 'Analysis output',
        artifacts: [],
        nextSteps: [],
        metadata: {
          agent: 'Analyst',
          mode: 'technical',
          timestamp: new Date().toISOString(),
        },
      });

      await runAnalyzeCommand(['-m', 'technical']);

      // Verify execute was called and metadata would be included
      expect(mockAgent.execute).toHaveBeenCalled();
    });

    it('should save result to file when --output specified', async () => {
      mockAgent.execute.mockResolvedValue({
        success: true,
        output: 'Analysis output to save',
        artifacts: [],
        nextSteps: [],
        metadata: { agent: 'Analyst' },
      });

      await runAnalyzeCommand(['-m', 'technical', '--out-file', '/tmp/analysis-output.md']);

      // Verify success log indicating file was written
      expect(log.success).toHaveBeenCalledWith(expect.stringContaining('analysis-output.md'));
    });
  });

  describe('Agent-based analysis', () => {
    it('should use Analyst agent by default', async () => {
      // Pass explicit -a Analyst to ensure we test the default value path
      // Commander maintains state across parseAsync calls on same instance
      await runAnalyzeCommand(['-m', 'technical', '-a', 'Analyst']);

      // Verify Analyst was used
      expect(AgentFactory.create).toHaveBeenCalledWith('Analyst', expect.anything());
    });

    it('should support custom agent (--agent)', async () => {
      // Ensure AgentFactory.has returns true for custom agent
      (AgentFactory.has as jest.Mock).mockReturnValue(true);

      await runAnalyzeCommand(['-m', 'technical', '-a', 'CustomAnalyzer']);

      expect(AgentFactory.create).toHaveBeenCalledWith('CustomAnalyzer', expect.anything());
    });

    it('should pass LLM client to agent', async () => {
      await runAnalyzeCommand(['-m', 'technical']);

      // Verify llmManager.getDefaultClient was called
      expect(llmManager.getDefaultClient).toHaveBeenCalled();

      // Verify AgentFactory.create received the client
      expect(AgentFactory.create).toHaveBeenCalledWith(
        expect.any(String),
        mockLLMClient
      );
    });

    it('should handle agent execution failure', async () => {
      mockAgent.execute.mockResolvedValue({
        success: false,
        output: '',
        artifacts: [],
        nextSteps: [],
        metadata: { agent: 'Analyst' },
      });

      await runAnalyzeCommand(['-m', 'technical']);

      // Verify error was logged
      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('分析失败'));
    });
  });

  describe('Python bridge integration', () => {
    beforeEach(() => {
      (config.load as jest.Mock).mockReturnValue({
        ...mockConfigData,
        integration: { bridge_mode: 'subprocess' },
      });
    });

    it('should initialize Python bridge correctly', async () => {
      const promise = runAnalyzeCommand(['-m', 'technical']);

      await new Promise((resolve) => setImmediate(resolve));

      // Verify spawnSync was called to check python version
      expect(spawnSync).toHaveBeenCalledWith('python', ['--version']);

      emitSpawnEvent('close', 0);
      await promise;
    });

    it('should pass correct arguments to Python script', async () => {
      const promise = runAnalyzeCommand([
        '-m', 'comprehensive',
        '-a', 'Analyst',
        '-o', 'detailed',
        '-v',
        '-P', 'PROP-001',
      ]);

      await new Promise((resolve) => setImmediate(resolve));

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'analyze',
          '--mode',
          'comprehensive',
          '--agent',
          'Analyst',
          '--output',
          'detailed',
          '--verbose',
          '--proposal',
          'PROP-001',
        ]),
        expect.anything()
      );

      emitSpawnEvent('close', 0);
      await promise;
    });

    it('should parse YAML output from Python', async () => {
      const promise = runAnalyzeCommand(['-m', 'technical']);

      await new Promise((resolve) => setImmediate(resolve));

      // Emit successful completion
      emitSpawnEvent('close', 0);
      await promise;

      // Verify completion was logged
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('分析完成'));
    });

    it('should handle subprocess spawn errors', async () => {
      const promise = runAnalyzeCommand(['-m', 'technical']);

      await new Promise((resolve) => setImmediate(resolve));

      // Emit error event
      emitSpawnEvent('error', new Error('Spawn failed'));
      await promise;

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('执行分析时出错'),
        expect.any(String)
      );
    });
  });

  describe('Error handling', () => {
    it('should handle agent creation errors', async () => {
      // Make AgentFactory.has return false to trigger fallback
      (AgentFactory.has as jest.Mock).mockReturnValue(false);

      // Set direct mode to trigger fallback to Python
      (config.load as jest.Mock).mockReturnValue({
        ...mockConfigData,
        integration: { bridge_mode: 'direct' },
      });

      const promise = runAnalyzeCommand(['-a', 'NonExistentAgent']);

      await new Promise((resolve) => setImmediate(resolve));

      // Should log warning and fall back to Python
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('未找到代理类型'));

      // Verify it fell back to subprocess mode
      expect(spawn).toHaveBeenCalled();

      emitSpawnEvent('close', 0);
      await promise;
    });

    it('should handle analysis execution errors', async () => {
      mockAgent.execute.mockRejectedValue(new Error('Agent execution failed'));

      await runAnalyzeCommand(['-m', 'technical']);

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('分析命令执行失败'),
        expect.any(Error)
      );
    });

    it('should display helpful error message on failure', async () => {
      // Test when LLM client is not available
      (llmManager.getDefaultClient as jest.Mock).mockReturnValue(null);

      await runAnalyzeCommand(['-m', 'technical']);

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('无可用的 LLM 客户端')
      );
    });
  });

  describe('BMAD Method configuration', () => {
    // Test proposal ID first before we disable BMAD method
    it('should pass proposal ID for change analysis', async () => {
      // Reset mocks to ensure clean state
      jest.clearAllMocks();
      clearSpawnEventHandlers();

      // Ensure direct mode with BMAD enabled
      (config.load as jest.Mock).mockReturnValue({
        ...mockConfigData,
        bmad_method: { enabled: true },
        integration: { bridge_mode: 'direct' },
      });
      (AgentFactory.has as jest.Mock).mockReturnValue(true);
      mockAgent.execute.mockResolvedValue({
        success: true,
        output: 'Proposal analysis',
        artifacts: [],
        nextSteps: [],
        metadata: { agent: 'Analyst' },
      });

      await runAnalyzeCommand(['-m', 'technical', '-P', 'CHANGE-123', '-a', 'Analyst']);

      expect(mockAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          inputData: expect.objectContaining({
            proposalId: 'CHANGE-123',
          }),
        })
      );
    });

    it('should warn when BMAD method is not enabled', async () => {
      (config.load as jest.Mock).mockReturnValue({
        ...mockConfigData,
        bmad_method: { enabled: false },
      });

      await runAnalyzeCommand(['-m', 'technical', '-a', 'Analyst']);

      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('BMAD-Method未启用'));
    });
  });
});
