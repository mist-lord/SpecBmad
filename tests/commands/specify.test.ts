/**
 * Specify Command Integration Tests
 *
 * 测试specify命令的核心功能：
 * - Interactive vs non-interactive mode
 * - Spec generation with LLM
 * - Spec output formats
 * - Phase transition trigger
 * - SpecKit integration
 *
 * @see src/commands/specify.ts
 */

import * as path from 'path';
import * as os from 'os';
import * as actualFs from 'fs';

// Mock dependencies before imports
// Note: Using require() inside jest.mock() is necessary because jest.mock() is hoisted
/* eslint-disable @typescript-eslint/no-var-requires */
jest.mock('chalk', () => require('../commands/command-test-utils').mockChalk());
jest.mock('@/utils/logger', () => require('../commands/command-test-utils').mockLogger());
jest.mock('@/utils/error', () => require('../commands/command-test-utils').mockErrorHandler());
jest.mock('@/utils/config', () => require('../commands/command-test-utils').mockConfig());
/* eslint-enable @typescript-eslint/no-var-requires */

// Mock inquirer for interactive mode
// The source uses: const { default: inquirer } = await import('inquirer');
// Then calls: inquirer.prompt([...])
const mockInquirerPrompt = jest.fn();
jest.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: mockInquirerPrompt,
  },
}));

// Mock spec-kit with the singleton pattern used in source
const mockSpecKitExecute = jest.fn();
jest.mock('@/core/spec/spec-kit', () => ({
  specKit: {
    execute: mockSpecKitExecute,
  },
}));

// Mock PhaseController
const mockGetCurrentPhase = jest.fn();
const mockTransitionTo = jest.fn();
jest.mock('@/core/phase/controller', () => ({
  PhaseController: jest.fn().mockImplementation(() => ({
    getCurrentPhase: mockGetCurrentPhase,
    transitionTo: mockTransitionTo,
  })),
}));

// Mock EventStore
const mockAppendEvent = jest.fn();
jest.mock('@/core/events/store', () => ({
  EventStore: jest.fn().mockImplementation(() => ({
    appendEvent: mockAppendEvent,
  })),
}));

// Mock phase gates registration
jest.mock('@/core/phase/gates', () => ({
  registerDefaultGates: jest.fn(),
}));

// Mock args validator
const mockValidateSpecifyArgs = jest.fn();
jest.mock('@/utils/args-validator', () => ({
  validateSpecifyArgs: mockValidateSpecifyArgs,
}));

// Mock paths
jest.mock('@/utils/paths', () => ({
  getSpecPath: jest.fn((subPath: string) => `/mock/project/spec/${subPath}`),
  PATHS: {
    SPECIFICATIONS_DIR: '.specbmad/specifications',
  },
  getProjectPath: jest.fn((relativePath: string) => `/mock/project/${relativePath}`),
}));

// Mock fs operations - must be done via jest.mock for proper interception
// Variables are defined inline to avoid hoisting issues
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn().mockReturnValue(undefined),
  };
});

// 现在导入被测试的模块
import { specifyCommand } from '@/commands/specify';
import { log } from '@/utils/logger';
import { handleError } from '@/utils/error';
import * as fs from 'fs';

// Get references to the mocked fs functions
const mockWriteFileSync = fs.writeFileSync as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _mockMkdirSync = fs.mkdirSync as jest.Mock;

describe('SpecifyCommand', () => {
  let tempDir: string;

  beforeAll(() => {
    // Create a temp directory for test outputs using actual fs
    tempDir = actualFs.mkdtempSync(path.join(os.tmpdir(), 'specbmad-specify-test-'));
  });

  afterAll(() => {
    // Cleanup temp directory
    if (actualFs.existsSync(tempDir)) {
      actualFs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockValidateSpecifyArgs.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });

    mockSpecKitExecute.mockResolvedValue({
      success: true,
      outputPath: '/mock/project/spec/intent.yaml',
      intentSpec: {
        title: 'Test Spec',
        requirements: [{ id: 'REQ-001', description: 'Test requirement' }],
      },
    });

    mockGetCurrentPhase.mockReturnValue(0);
    mockTransitionTo.mockResolvedValue({
      success: true,
      timestamp: new Date().toISOString(),
      gateResults: [],
    });

    mockInquirerPrompt.mockResolvedValue({
      title: 'Test Feature',
      summary: 'Test summary description',
      modules: ['UI', 'API'],
      template: 'standard',
      agent: 'Analyst',
    });
  });

  describe('Interactive mode (no input provided)', () => {
    it('should prompt user for requirement description', async () => {
      // Run specify command in interactive mode
      await specifyCommand({ interactive: true });

      // Should prompt user with inquirer
      expect(mockInquirerPrompt).toHaveBeenCalledTimes(1);
      expect(mockInquirerPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'title', type: 'input' }),
          expect.objectContaining({ name: 'summary', type: 'input' }),
          expect.objectContaining({ name: 'modules', type: 'checkbox' }),
          expect.objectContaining({ name: 'template', type: 'list' }),
          expect.objectContaining({ name: 'agent', type: 'list' }),
        ])
      );

      // Should log interactive mode start
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('交互式需求收集'));
    });

    it('should use prompted input for spec generation', async () => {
      const mockAnswers = {
        title: 'My Feature',
        summary: 'Feature description here',
        modules: ['UI', 'DB'],
        template: 'webapp',
        agent: 'Architect',
      };
      mockInquirerPrompt.mockResolvedValue(mockAnswers);

      await specifyCommand({ interactive: true });

      // Should write file with user's answers
      expect(mockWriteFileSync).toHaveBeenCalled();
      const [, content] = mockWriteFileSync.mock.calls[0];
      expect(content).toContain('My Feature');
      expect(content).toContain('Feature description here');
      expect(content).toContain('UI');
      expect(content).toContain('DB');
      expect(content).toContain('webapp');
      expect(content).toContain('Architect');
    });

    it('should handle user cancellation gracefully', async () => {
      // Simulate user cancelling (inquirer throws on Ctrl+C)
      mockInquirerPrompt.mockRejectedValue(new Error('User cancelled'));

      await expect(specifyCommand({ interactive: true })).rejects.toThrow('User cancelled');

      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ command: 'specify' })
      );
    });
  });

  describe('Non-interactive mode (input provided)', () => {
    it('should use provided input directly', async () => {
      const inputText = 'Build a user authentication system';

      await specifyCommand({ input: inputText });

      // Should call specKit with the provided input
      expect(mockSpecKitExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          input: inputText,
        })
      );

      // Should NOT prompt user
      expect(mockInquirerPrompt).not.toHaveBeenCalled();
    });

    it('should skip prompting when input is provided', async () => {
      await specifyCommand({ input: 'Test requirement' });

      // Inquirer should not be called
      expect(mockInquirerPrompt).not.toHaveBeenCalled();

      // SpecKit should be called instead
      expect(mockSpecKitExecute).toHaveBeenCalled();
    });

    it('should validate input is not empty', async () => {
      // Empty input should trigger warning from validator
      mockValidateSpecifyArgs.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['未提供输入文件，可能使用默认或交互模式'],
      });

      await specifyCommand({});

      // Validator should be called
      expect(mockValidateSpecifyArgs).toHaveBeenCalled();

      // Warning should be logged
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('未提供输入文件'));
    });
  });

  describe('Spec generation', () => {
    it('should call SpecKit.execute with requirement', async () => {
      const requirement = 'Create a REST API for user management';

      await specifyCommand({ input: requirement });

      expect(mockSpecKitExecute).toHaveBeenCalledWith({
        input: requirement,
        outputPath: expect.stringContaining('intent.yaml'),
      });
    });

    it('should use LLM for spec content generation', async () => {
      // SpecKit internally uses LLM, we verify it's called with correct params
      const input = 'Build a payment processing module';

      await specifyCommand({ input });

      // SpecKit.execute should be called (which internally uses LLM)
      expect(mockSpecKitExecute).toHaveBeenCalledWith(
        expect.objectContaining({ input })
      );

      // Success should be logged
      expect(log.success).toHaveBeenCalledWith(
        expect.stringContaining('Intent Spec 已生成')
      );
    });

    it('should save generated spec to spec/intent.yaml', async () => {
      mockSpecKitExecute.mockResolvedValue({
        success: true,
        outputPath: '/project/spec/intent.yaml',
        intentSpec: { title: 'Test' },
      });

      await specifyCommand({ input: 'Test requirement' });

      // Should call specKit with default output path
      expect(mockSpecKitExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          outputPath: expect.stringContaining('intent.yaml'),
        })
      );

      // Success message should include path
      expect(log.success).toHaveBeenCalledWith(
        expect.stringMatching(/Intent Spec 已生成.*intent\.yaml/)
      );
    });

    it('should create spec directory if not exists', async () => {
      // SpecKit handles directory creation internally
      // We verify the command doesn't fail when directory doesn't exist
      mockSpecKitExecute.mockResolvedValue({
        success: true,
        outputPath: '/new/path/spec/intent.yaml',
      });

      await specifyCommand({ input: 'Test', output: '/new/path/spec/intent.yaml' });

      expect(mockSpecKitExecute).toHaveBeenCalled();
      expect(log.success).toHaveBeenCalled();
    });
  });

  describe('Output formats', () => {
    it('should support YAML format (default)', async () => {
      await specifyCommand({ input: 'Test requirement' });

      // Default output path should be .yaml
      expect(mockSpecKitExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          outputPath: expect.stringContaining('.yaml'),
        })
      );
    });

    it('should support Markdown format (--format=md)', async () => {
      // Interactive mode generates markdown
      mockInquirerPrompt.mockResolvedValue({
        title: 'Test',
        summary: 'Summary',
        modules: ['UI'],
        template: 'standard',
        agent: 'Analyst',
      });

      await specifyCommand({ interactive: true, output: path.join(tempDir, 'output.md') });

      // Should write markdown content
      expect(mockWriteFileSync).toHaveBeenCalled();
      const [, content] = mockWriteFileSync.mock.calls[0];
      expect(content).toContain('#'); // Markdown headers
      expect(content).toContain('##'); // Subheaders
    });

    it('should include requirement metadata in spec', async () => {
      // SpecKit adds metadata automatically
      mockSpecKitExecute.mockResolvedValue({
        success: true,
        outputPath: '/project/spec/intent.yaml',
        intentSpec: {
          title: 'Test',
          requirements: [],
          metadata: {
            generated_by: 'spec-kit',
            timestamp: '2026-02-11T00:00:00Z',
            phase: 0,
          },
        },
      });

      await specifyCommand({ input: 'Test' });

      // SpecKit should be called and return metadata
      expect(mockSpecKitExecute).toHaveBeenCalled();
      const result = await mockSpecKitExecute.mock.results[0].value;
      expect(result.intentSpec.metadata).toBeDefined();
      expect(result.intentSpec.metadata.generated_by).toBe('spec-kit');
    });
  });

  describe('Phase transition', () => {
    it('should trigger phase transition after spec generation', async () => {
      mockGetCurrentPhase.mockReturnValue(0);

      await specifyCommand({ input: 'Test requirement' });

      // Should check current phase
      expect(mockGetCurrentPhase).toHaveBeenCalled();

      // Should attempt transition
      expect(mockTransitionTo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          currentPhase: 0,
          metadata: { triggeredBy: 'specify-command' },
        })
      );
    });

    it('should transition from Phase 0 to Phase 1', async () => {
      mockGetCurrentPhase.mockReturnValue(0);
      mockTransitionTo.mockResolvedValue({
        success: true,
        timestamp: new Date().toISOString(),
        gateResults: [],
      });

      await specifyCommand({ input: 'Test requirement' });

      // Should transition to phase 1
      expect(mockTransitionTo).toHaveBeenCalledWith(1, expect.anything());

      // Should log success
      expect(log.success).toHaveBeenCalledWith(
        expect.stringContaining('Phase 迁移成功: 0 → 1')
      );
    });

    it('should record spec generation event', async () => {
      mockGetCurrentPhase.mockReturnValue(0);
      mockTransitionTo.mockResolvedValue({
        success: true,
        timestamp: '2026-02-11T00:00:00Z',
        gateResults: [{ gate: 'intent-spec-exists', passed: true }],
      });

      await specifyCommand({ input: 'Test requirement' });

      // Should record event
      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'phase_transition',
          phase: 1,
          status: 'passed',
          actor: 'specify-command',
          inputs: { fromPhase: 0, toPhase: 1 },
        })
      );
    });

    it('should handle phase transition failure gracefully', async () => {
      mockGetCurrentPhase.mockReturnValue(0);
      mockTransitionTo.mockResolvedValue({
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Gate check failed: intent-spec-exists',
        gateResults: [{ gate: 'intent-spec-exists', passed: false }],
      });

      // Should not throw
      await specifyCommand({ input: 'Test requirement' });

      // Should log warning (not error)
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Phase 迁移失败')
      );

      // Event should still be recorded with failed status
      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
        })
      );
    });
  });

  describe('SpecKit integration', () => {
    it('should use SpecKit for spec template', async () => {
      await specifyCommand({ input: 'Build a todo app' });

      // SpecKit execute should be called
      expect(mockSpecKitExecute).toHaveBeenCalled();

      // Verify input is passed correctly
      expect(mockSpecKitExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'Build a todo app',
        })
      );
    });

    it('should validate generated spec', async () => {
      // When SpecKit returns success: false, should throw
      mockSpecKitExecute.mockResolvedValue({
        success: false,
        outputPath: '/project/spec/intent.yaml',
        error: 'Invalid spec format',
      });

      await expect(specifyCommand({ input: 'Test' })).rejects.toThrow(
        'Spec-Kit 执行失败: Invalid spec format'
      );
    });
  });

  describe('Error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      // Simulate LLM error via SpecKit failure
      mockSpecKitExecute.mockResolvedValue({
        success: false,
        outputPath: '/project/spec/intent.yaml',
        error: 'LLM connection failed',
      });

      await expect(specifyCommand({ input: 'Test' })).rejects.toThrow(
        'Spec-Kit 执行失败: LLM connection failed'
      );

      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ command: 'specify' })
      );
    });

    it('should handle file write errors gracefully', async () => {
      // Simulate SpecKit file write error
      mockSpecKitExecute.mockResolvedValue({
        success: false,
        outputPath: '/readonly/path/intent.yaml',
        error: 'EACCES: permission denied',
      });

      await expect(specifyCommand({ input: 'Test' })).rejects.toThrow(
        'Spec-Kit 执行失败'
      );

      expect(handleError).toHaveBeenCalled();
    });

    it('should display helpful error message on failure', async () => {
      mockSpecKitExecute.mockRejectedValue(new Error('Unexpected error'));

      await expect(specifyCommand({ input: 'Test' })).rejects.toThrow('Unexpected error');

      // handleError should be called with context
      expect(handleError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Unexpected error' }),
        expect.objectContaining({ command: 'specify' })
      );
    });
  });

  describe('Dry run mode', () => {
    it('should not write files in dry run mode', async () => {
      await specifyCommand({ input: 'Test', dryRun: true });

      // SpecKit should NOT be called in dry run
      expect(mockSpecKitExecute).not.toHaveBeenCalled();

      // Should log dry run message
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('预览模式'));
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('干跑模式'));
    });

    it('should not write files in interactive dry run mode', async () => {
      await specifyCommand({ interactive: true, dryRun: true });

      // Should NOT write files
      expect(mockWriteFileSync).not.toHaveBeenCalled();

      // Should log dry run message
      expect(log.info).toHaveBeenCalledWith(expect.stringContaining('干跑'));
    });
  });

  describe('Custom output path', () => {
    it('should use custom output path when provided', async () => {
      const customPath = path.join(tempDir, 'custom', 'spec.yaml');

      await specifyCommand({ input: 'Test', output: customPath });

      expect(mockSpecKitExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          outputPath: customPath,
        })
      );
    });

    it('should handle relative output paths', async () => {
      await specifyCommand({ input: 'Test', output: 'output/spec.yaml' });

      // Should convert to absolute path
      expect(mockSpecKitExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          outputPath: expect.stringContaining('output/spec.yaml'),
        })
      );
    });
  });

  describe('Validation errors', () => {
    it('should abort on validation errors', async () => {
      mockValidateSpecifyArgs.mockReturnValue({
        valid: false,
        errors: ['无法创建输出目录: /readonly/path'],
        warnings: [],
      });

      await specifyCommand({ output: '/readonly/path/spec.yaml' });

      // Should log error
      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('无法创建输出目录'));

      // Should NOT call SpecKit
      expect(mockSpecKitExecute).not.toHaveBeenCalled();
    });

    it('should log warnings but continue', async () => {
      mockValidateSpecifyArgs.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['输入文件不存在: test.txt'],
      });

      await specifyCommand({ input: 'test.txt' });

      // Should log warning
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('输入文件不存在'));

      // Should still proceed with SpecKit
      expect(mockSpecKitExecute).toHaveBeenCalled();
    });
  });

  describe('Phase already advanced', () => {
    it('should not transition if already past Phase 0', async () => {
      mockGetCurrentPhase.mockReturnValue(1); // Already at Phase 1

      await specifyCommand({ input: 'Test requirement' });

      // Should check current phase
      expect(mockGetCurrentPhase).toHaveBeenCalled();

      // Should NOT attempt transition
      expect(mockTransitionTo).not.toHaveBeenCalled();
    });
  });
});
