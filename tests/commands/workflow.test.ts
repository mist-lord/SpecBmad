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

// Mock chain commands used by core-cli workflow
jest.mock('@/commands/specify', () => ({ specifyCommand: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/commands/tasks', () => ({ tasksCommand: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/commands/implement', () => ({ implementCommand: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/commands/qa', () => ({ qaCommand: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/commands/deploy', () => ({ deployCommand: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/commands/generate', () => ({ generateCommand: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/commands/run', () => ({ runCommand: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/core/plugin/manager', () => ({
  pluginManager: {
    initializeAll: jest.fn().mockResolvedValue(undefined),
    hasPlugin: jest.fn().mockReturnValue(false),
    registerPlugin: jest.fn(),
    initializePlugin: jest.fn().mockResolvedValue(undefined),
    getPlugin: jest.fn(),
  }
}));
jest.mock('@/utils/summary', () => ({
  renderWorkflowMarkdownSummary: jest.fn().mockReturnValue('# Workflow Summary\n\nTest summary content')
}));
jest.mock('@/utils/dashboard', () => ({
  renderLlmUsageDashboard: jest.fn().mockReturnValue('# LLM Dashboard\n\nTest dashboard')
}));
jest.mock('@/utils/paths', () => ({
  PATHS: {
    CONFIG_DIR: '.specbmad',
    WORKFLOW_STATE_FILE: '.specbmad/workflow.state.json',
    WORKFLOW_CHAIN_STATE_FILE: '.specbmad/chain.state.json',
    ARTIFACTS_DIR: '.specbmad/artifacts',
    SPECIFICATIONS_DIR: '.specbmad/specifications',
  },
  getProjectPath: jest.fn((p: string) => require('path').join(process.cwd(), p)),
}));
jest.mock('@/plugins/artifacts-indexer', () => ({
  ArtifactsIndexerPlugin: jest.fn(),
}));

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

  describe('workflow_mode config selection', () => {
    it('should use spec_first → planning-only when no name given', async () => {
      const configModule = require('@/utils/config');
      configModule.config.getAll.mockReturnValue({
        projectName: 'test-project',
        integration: { workflow_mode: 'spec_first' },
      });
      const mockExecuteWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await workflowCommand({});

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('planning-only')
      );
      expect(mockExecuteWorkflow).toHaveBeenCalledWith(
        'planning-only',
        expect.anything(),
        expect.anything()
      );
    });

    it('should use core-cli when workflow_mode=core_only', async () => {
      const configModule = require('@/utils/config');
      configModule.config.getAll.mockReturnValue({
        projectName: 'test-project',
        integration: { workflow_mode: 'core_only' },
      });
      const { specifyCommand } = require('@/commands/specify');
      const { tasksCommand } = require('@/commands/tasks');
      const { deployCommand } = require('@/commands/deploy');

      await workflowCommand({});

      expect(specifyCommand).toHaveBeenCalled();
      expect(tasksCommand).toHaveBeenCalled();
      expect(deployCommand).toHaveBeenCalled();
    });

    it('should default to full-development when workflow_mode=hybrid', async () => {
      const configModule = require('@/utils/config');
      configModule.config.getAll.mockReturnValue({
        projectName: 'test-project',
        integration: { workflow_mode: 'hybrid' },
      });
      const mockExecuteWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await workflowCommand({});

      expect(mockExecuteWorkflow).toHaveBeenCalledWith(
        'full-development',
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('core-cli chain execution', () => {
    beforeEach(() => {
      const configModule = require('@/utils/config');
      configModule.config.getAll.mockReturnValue({
        projectName: 'test-project',
        integration: { workflow_mode: 'core_only' },
      });
    });

    it('should run all chain steps in order', async () => {
      const { specifyCommand } = require('@/commands/specify');
      const { tasksCommand } = require('@/commands/tasks');
      const { implementCommand } = require('@/commands/implement');
      const { qaCommand } = require('@/commands/qa');
      const { deployCommand } = require('@/commands/deploy');

      await workflowCommand({ name: 'core-cli' });

      expect(specifyCommand).toHaveBeenCalled();
      expect(tasksCommand).toHaveBeenCalled();
      expect(implementCommand).toHaveBeenCalled();
      expect(qaCommand).toHaveBeenCalled();
      expect(deployCommand).toHaveBeenCalled();
    });

    it('should write chain state file on each step', async () => {
      const fs = require('fs');
      const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});

      await workflowCommand({ name: 'core-cli' });

      const stateWrites = mockWriteFileSync.mock.calls.filter((c: any[]) =>
        String(c[0]).includes('chain.state.json')
      );
      expect(stateWrites.length).toBeGreaterThan(0);

      mockWriteFileSync.mockRestore();
    });

    it('should handle core-cli chain failure gracefully', async () => {
      const { specifyCommand } = require('@/commands/specify');
      specifyCommand.mockRejectedValueOnce(new Error('specify failed'));

      const fs = require('fs');
      const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});

      // core-cli catches errors internally and returns (doesn't rethrow)
      await expect(workflowCommand({ name: 'core-cli' })).resolves.not.toThrow();

      mockWriteFileSync.mockRestore();
    });
  });

  describe('Resume state validation', () => {
    it('should log warning when resume state file not found', async () => {
      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mockExecuteWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await workflowCommand({ name: 'planning-only', resume: true });

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('未找到恢复状态文件')
      );
      expect(mockExecuteWorkflow).toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should load completed steps from resume state file', async () => {
      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ completedSteps: ['step-1', 'step-2'], workflow: 'planning-only' })
      );
      const mockExecuteWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await workflowCommand({ name: 'planning-only', resume: true });

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('已读取完成步骤 2 个')
      );
      expect(mockExecuteWorkflow).toHaveBeenCalledWith(
        'planning-only',
        expect.objectContaining({
          projectState: expect.objectContaining({
            workflow: expect.objectContaining({
              completedSteps: ['step-1', 'step-2'],
            }),
          }),
        }),
        expect.anything()
      );

      jest.restoreAllMocks();
    });

    it('should warn when resume workflow name differs from current', async () => {
      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ completedSteps: [], workflow: 'old-workflow' })
      );
      const mockExecuteWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await workflowCommand({ name: 'new-workflow', resume: true });

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('old-workflow')
      );

      jest.restoreAllMocks();
    });
  });

  describe('Dedupe and output naming', () => {
    it('should append -1 suffix when output file already exists', async () => {
      const fs = require('fs');
      const writtenPaths: string[] = [];
      jest.spyOn(fs, 'existsSync').mockImplementation((...args: any[]) =>
        String(args[0]).endsWith('workflow.md') && !String(args[0]).includes('-1')
      );
      jest.spyOn(fs, 'writeFileSync').mockImplementation((...args: any[]) => {
        writtenPaths.push(String(args[0]));
      });
      jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const mockExecuteWorkflow = jest.fn().mockResolvedValue([testFixtures.agentResult]);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await workflowCommand({
        name: 'planning-only',
        format: 'markdown',
        reportDir: '/tmp/test-report',
        dedupe: true,
      });

      const mdWrite = writtenPaths.find((p) => p.includes('workflow'));
      expect(mdWrite).toBeDefined();
      expect(mdWrite).toContain('-1');

      jest.restoreAllMocks();
    });

    it('should add datePrefix to output filename', async () => {
      const fs = require('fs');
      const writtenPaths: string[] = [];
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      jest.spyOn(fs, 'writeFileSync').mockImplementation((...args: any[]) => {
        writtenPaths.push(String(args[0]));
      });
      jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      const mockExecuteWorkflow = jest.fn().mockResolvedValue([]);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      await workflowCommand({
        name: 'planning-only',
        format: 'json',
        reportDir: '/tmp/test-report',
        datePrefix: true,
      });

      const jsonWrite = writtenPaths.find((p) => p.includes('workflow'));
      expect(jsonWrite).toBeDefined();
      // Should match YYYYMMDD-HHMMSS- prefix pattern
      expect(jsonWrite).toMatch(/\d{8}-\d{6}-workflow/);

      jest.restoreAllMocks();
    });
  });

  describe('Output truncation', () => {
    it('should truncate long output to 30 lines when no output path', async () => {
      // Generate results that produce > 30 lines when rendered
      const longResults = Array.from({ length: 5 }, (_, i) => ({
        ...testFixtures.agentResult,
        metadata: { agent: `Agent${i}`, mode: 'interactive', sprint: i, prioritize: true },
        nextSteps: Array.from({ length: 10 }, (__, j) => `Next step ${i}-${j}`),
      }));
      const mockExecuteWorkflow = jest.fn().mockResolvedValue(longResults);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      // No output/reportDir → goes to truncation path
      await workflowCommand({ name: 'planning-only', format: 'json' });

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('输出已截断')
      );
    });

    it('should truncate yaml output to 30 lines when no output path', async () => {
      const longResults = Array.from({ length: 5 }, (_, i) => ({
        ...testFixtures.agentResult,
        metadata: { agent: `Agent${i}`, mode: 'interactive', sprint: i, prioritize: true },
        nextSteps: Array.from({ length: 10 }, (__, j) => `Next step ${i}-${j}`),
      }));
      const mockExecuteWorkflow = jest.fn().mockResolvedValue(longResults);
      Orchestrator.prototype.executeWorkflow = mockExecuteWorkflow;

      const fs = require('fs');
      jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      await workflowCommand({ name: 'planning-only', format: 'yaml' });

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('输出已截断')
      );

      jest.restoreAllMocks();
    });
  });
});
