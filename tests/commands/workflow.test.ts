/**
 * Workflow Command Integration Tests
 *
 * 测试workflow命令的核心功能：
 * - Phase-driven workflow (options.phase=true)
 * - Traditional workflow (options.phase=false)
 * - Output formatting (markdown/json/yaml)
 * - Resume from checkpoint
 * - Error handling
 *
 * @see src/commands/workflow.ts
 */

// Mock dependencies before imports
jest.mock('chalk', () => require('../commands/command-test-utils').mockChalk());
jest.mock('@/utils/logger', () => require('../commands/command-test-utils').mockLogger());
jest.mock('@/utils/perf', () => require('../commands/command-test-utils').mockPerfTracer());
jest.mock('@/utils/error', () => require('../commands/command-test-utils').mockErrorHandler());
jest.mock('@/utils/auto-init', () => require('../commands/command-test-utils').mockAutoInit());
jest.mock('@/utils/config', () => require('../commands/command-test-utils').mockConfig());
jest.mock('@/core/llm/manager', () => require('../commands/command-test-utils').mockLLMManager());
jest.mock('@/core/workflow/orchestrator', () => require('../commands/command-test-utils').mockOrchestrator());
jest.mock('@/core/phase/controller', () => require('../commands/command-test-utils').mockPhaseController());

// 现在导入被测试的模块
import { workflowCommand } from '@/commands/workflow';
import { Orchestrator } from '@/core/workflow/orchestrator';
import { log } from '@/utils/logger';
import { testFixtures } from './command-test-utils';

describe('WorkflowCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Phase-driven workflow (options.phase=true)', () => {
    it('should execute phase workflow with valid start/end phases', async () => {
      const mockExecutePhaseWorkflow = jest.fn().mockResolvedValue([testFixtures.agentResult]);
      Orchestrator.prototype.executePhaseWorkflow = mockExecutePhaseWorkflow;

      await workflowCommand({ phase: true, startPhase: 0, endPhase: 1 });

      expect(mockExecutePhaseWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ projectState: expect.anything() }),
        0,
        1
      );
    });

    it('should reject invalid phase numbers', async () => {
      await expect(
        workflowCommand({ phase: true, startPhase: 5 })
      ).rejects.toThrow('startPhase 只能是 0-3');

      await expect(
        workflowCommand({ phase: true, endPhase: -1 })
      ).rejects.toThrow('endPhase 只能是 0-3');
    });

    it('should handle resume from checkpoint', async () => {
      // Note: Phase-driven workflow doesn't have checkpoint resume in current implementation
      // This test verifies it doesn't crash with resume option
      const mockExecutePhaseWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executePhaseWorkflow = mockExecutePhaseWorkflow;

      await workflowCommand({ phase: true, resume: true });

      expect(mockExecutePhaseWorkflow).toHaveBeenCalled();
    });

    it('should use default phase range (0-3) when not specified', async () => {
      const mockExecutePhaseWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executePhaseWorkflow = mockExecutePhaseWorkflow;

      await workflowCommand({ phase: true });

      expect(mockExecutePhaseWorkflow).toHaveBeenCalledWith(
        expect.anything(),
        0, // default startPhase
        3  // default endPhase
      );
    });

    it('should call orchestrator.executePhaseWorkflow with correct context', async () => {
      const mockExecutePhaseWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executePhaseWorkflow = mockExecutePhaseWorkflow;

      await workflowCommand({ phase: true, name: '测试需求' });

      expect(mockExecutePhaseWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          workingDirectory: expect.any(String),
          projectState: expect.objectContaining({
            projectName: expect.any(String),
            workflow: expect.objectContaining({
              currentStep: '',
              completedSteps: []
            })
          }),
          inputData: expect.objectContaining({
            requirement: '测试需求'
          })
        }),
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  describe('Traditional workflow (options.phase=false)', () => {
    it('should execute named workflow', async () => {
      const mockExecuteWorkflow = jest.fn().mockResolvedValue([testFixtures.agentResult]);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await workflowCommand({ name: 'planning-only' });

      expect(mockExecuteWorkflow).toHaveBeenCalledWith(
        'planning-only',
        expect.objectContaining({ projectState: expect.anything() }),
        'json'
      );
    });

    it('should reject unknown workflow name', async () => {
      const mockExecuteWorkflow = jest.fn().mockRejectedValue(
        new Error('Unknown workflow: invalid-workflow-name')
      );
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await expect(
        workflowCommand({ name: 'invalid-workflow-name' })
      ).rejects.toThrow('Unknown workflow: invalid-workflow-name');
    });

    it('should pass workflow options correctly', async () => {
      const mockExecuteWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await workflowCommand({ name: 'core-planning', format: 'yaml' });

      expect(mockExecuteWorkflow).toHaveBeenCalledWith(
        'core-planning',
        expect.anything(),
        'yaml'
      );
    });
  });

  describe('Output formatting', () => {
    it('should write markdown summary when format=markdown', async () => {
      const fs = require('fs');
      const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const mockExecutePhaseWorkflow = jest.fn().mockResolvedValue([testFixtures.agentResult]);
      Orchestrator.prototype.executePhaseWorkflow = mockExecutePhaseWorkflow;

      await workflowCommand({
        phase: true,
        format: 'markdown',
        output: './test-output.md'
      });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test-output.md'),
        expect.any(String),
        'utf-8'
      );

      mockWriteFileSync.mockRestore();
    });

    it('should write JSON summary when format=json', async () => {
      const fs = require('fs');
      const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const mockExecutePhaseWorkflow = jest.fn().mockResolvedValue([testFixtures.agentResult]);
      Orchestrator.prototype.executePhaseWorkflow = mockExecutePhaseWorkflow;

      await workflowCommand({
        phase: true,
        format: 'json',
        output: './test-output.json'
      });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test-output.json'),
        expect.stringContaining('"agent"'),
        'utf-8'
      );

      mockWriteFileSync.mockRestore();
    });

    it('should write YAML summary when format=yaml', async () => {
      const fs = require('fs');
      const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const mockExecuteWorkflow = jest.fn().mockResolvedValue([testFixtures.agentResult]);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await workflowCommand({
        name: 'planning-only',
        format: 'yaml',
        output: './test-output.yaml'
      });

      const yamlCalls = mockWriteFileSync.mock.calls.filter((call: any) =>
        call[0].toString().includes('test-output.yaml')
      );
      expect(yamlCalls.length).toBeGreaterThan(0);

      mockWriteFileSync.mockRestore();
    });

    it('should use default format (json) when not specified', async () => {
      const mockExecuteWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await workflowCommand({ name: 'planning-only' });

      expect(mockExecuteWorkflow).toHaveBeenCalledWith(
        'planning-only',
        expect.anything(),
        'json' // default format
      );
    });

    it('should save output to specified path', async () => {
      const fs = require('fs');
      const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const mockMkdirSync = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const mockExecutePhaseWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executePhaseWorkflow = mockExecutePhaseWorkflow;

      const outputPath = '/tmp/workflow-output.json';
      await workflowCommand({
        phase: true,
        output: outputPath
      });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.any(String),
        'utf-8'
      );

      mockWriteFileSync.mockRestore();
      mockMkdirSync.mockRestore();
    });
  });

  describe('Project initialization', () => {
    it('should ensure project is initialized before workflow execution', async () => {
      const mockExecutePhaseWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executePhaseWorkflow = mockExecutePhaseWorkflow;

      // Mock auto-init module
      const autoInitModule = require('@/utils/auto-init');
      const mockEnsureInit = jest.fn().mockResolvedValue(undefined);
      autoInitModule.ensureProjectInitialized = mockEnsureInit;

      await workflowCommand({ phase: true });

      expect(mockEnsureInit).toHaveBeenCalledWith(true);
      expect(mockExecutePhaseWorkflow).toHaveBeenCalled();
    });

    it('should load config after initialization', async () => {
      const configModule = require('@/utils/config');
      const mockLoad = jest.spyOn(configModule.config, 'load').mockImplementation(() => {});
      const mockExecutePhaseWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executePhaseWorkflow = mockExecutePhaseWorkflow;

      await workflowCommand({ phase: true });

      expect(mockLoad).toHaveBeenCalled();
      expect(mockExecutePhaseWorkflow).toHaveBeenCalled();

      mockLoad.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should handle workflow execution failure gracefully', async () => {
      const mockExecutePhaseWorkflow = jest.fn().mockRejectedValue(
        new Error('Phase execution failed')
      );
      Orchestrator.prototype.executePhaseWorkflow = mockExecutePhaseWorkflow;

      await expect(
        workflowCommand({ phase: true })
      ).rejects.toThrow('Phase execution failed');

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('工作流执行失败')
      );
    });

    it('should propagate orchestrator errors', async () => {
      const testError = new Error('Orchestrator internal error');
      const mockExecuteWorkflow = jest.fn().mockRejectedValue(testError);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await expect(
        workflowCommand({ name: 'planning-only' })
      ).rejects.toThrow('Orchestrator internal error');
    });

    it('should handle invalid options gracefully', async () => {
      // Test invalid phase number
      await expect(
        workflowCommand({ phase: true, startPhase: 99 })
      ).rejects.toThrow();

      // Test invalid endPhase
      await expect(
        workflowCommand({ phase: true, endPhase: -5 })
      ).rejects.toThrow();
    });
  });
});
