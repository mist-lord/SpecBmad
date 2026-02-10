/**
 * Go Command Unit Tests
 *
 * Tests the one-click project generation command.
 * @see src/commands/go.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock chalk to avoid color formatting issues in tests
jest.mock('chalk', () => ({
  cyan: Object.assign(jest.fn((s: string) => s), { bold: jest.fn((s: string) => s) }),
  yellow: Object.assign(jest.fn((s: string) => s), { bold: jest.fn((s: string) => s) }),
  green: Object.assign(jest.fn((s: string) => s), { bold: jest.fn((s: string) => s) }),
  gray: jest.fn((s: string) => s),
  red: jest.fn((s: string) => s),
}));

// Mock dependencies before importing the module
jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/utils/perf', () => ({
  PerfTracer: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    end: jest.fn().mockReturnValue({ durationMs: 100 }),
  })),
}));

jest.mock('@/utils/error', () => ({
  handleError: jest.fn(),
}));

jest.mock('@/utils/auto-init', () => ({
  ensureProjectInitialized: jest.fn().mockResolvedValue(undefined),
  autoConfigureLLM: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/commands/workflow', () => ({
  workflowCommand: jest.fn().mockResolvedValue(undefined),
}));

// Mock getRunPath to use temp directory
const mockTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specbmad-go-test-'));
jest.mock('@/utils/paths', () => ({
  getRunPath: jest.fn().mockImplementation((runId: string) => path.join(mockTmpDir, runId)),
}));

// Now import the module under test
import { goCommand } from '@/commands/go';
import { log } from '@/utils/logger';
import { workflowCommand } from '@/commands/workflow';
import { ensureProjectInitialized, autoConfigureLLM } from '@/utils/auto-init';

describe('goCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Cleanup temp directory
    fs.rmSync(mockTmpDir, { recursive: true, force: true });
  });

  describe('Input Validation', () => {
    it('should reject empty text input', async () => {
      await goCommand('', {});

      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('请提供项目需求描述'));
      expect(workflowCommand).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only text input', async () => {
      await goCommand('   ', {});

      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('请提供项目需求描述'));
      expect(workflowCommand).not.toHaveBeenCalled();
    });

    it('should accept valid text input', async () => {
      await goCommand('创建一个待办事项应用', {});

      expect(log.error).not.toHaveBeenCalled();
      expect(ensureProjectInitialized).toHaveBeenCalled();
      expect(autoConfigureLLM).toHaveBeenCalled();
    });
  });

  describe('Directory Structure', () => {
    it('should create required subdirectories', async () => {
      await goCommand('Test project', {});

      // Find the created run directory
      const dirs = fs.readdirSync(mockTmpDir);
      expect(dirs.length).toBeGreaterThan(0);

      const runDir = path.join(mockTmpDir, dirs[dirs.length - 1]);
      expect(fs.existsSync(path.join(runDir, 'specs'))).toBe(true);
      expect(fs.existsSync(path.join(runDir, 'artifacts'))).toBe(true);
      expect(fs.existsSync(path.join(runDir, 'code'))).toBe(true);
      expect(fs.existsSync(path.join(runDir, 'logs'))).toBe(true);
    });

    it('should save requirements to specs/requirements.md', async () => {
      const testText = 'Unique API Test 12345';
      await goCommand(testText, {});

      // Find the directory containing our unique test text
      const dirs = fs.readdirSync(mockTmpDir);
      const matchingDir = dirs.find((d) => d.includes('unique-api-test'));
      expect(matchingDir).toBeDefined();

      const runDir = path.join(mockTmpDir, matchingDir!);
      const reqPath = path.join(runDir, 'specs', 'requirements.md');

      expect(fs.existsSync(reqPath)).toBe(true);
      const content = fs.readFileSync(reqPath, 'utf-8');
      expect(content).toContain(testText);
    });
  });

  describe('Workflow Execution', () => {
    it('should use full-development workflow by default', async () => {
      await goCommand('Test project', {});

      expect(workflowCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'full-development',
        })
      );
    });

    it('should use deep-development workflow when deep option is true', async () => {
      await goCommand('Test project', { deep: true });

      expect(workflowCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'deep-development',
        })
      );
    });

    it('should pass autoRun option to workflow', async () => {
      await goCommand('Test project', { run: true });

      expect(workflowCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          autoRun: true,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors from workflowCommand', async () => {
      const testError = new Error('Workflow failed');
      (workflowCommand as jest.Mock).mockRejectedValueOnce(testError);

      await expect(goCommand('Test project', {})).rejects.toThrow('Workflow failed');
    });

    it('should propagate errors from ensureProjectInitialized', async () => {
      const testError = new Error('Init failed');
      (ensureProjectInitialized as jest.Mock).mockRejectedValueOnce(testError);

      await expect(goCommand('Test project', {})).rejects.toThrow('Init failed');
    });
  });
});

describe('slugify', () => {
  // Access slugify through module internals or test via goCommand behavior
  // Since slugify is internal, we test its behavior through directory naming

  it('should create slug-based directory names', async () => {
    await goCommand('Hello World Project', {});

    const dirs = fs.readdirSync(mockTmpDir);
    const latestDir = dirs[dirs.length - 1];

    // Should contain the slugified text
    expect(latestDir).toMatch(/hello-world-project/i);
  });

  it('should handle Chinese characters in slug', async () => {
    await goCommand('测试项目', {});

    const dirs = fs.readdirSync(mockTmpDir);
    const latestDir = dirs[dirs.length - 1];

    // Should preserve Chinese characters
    expect(latestDir).toMatch(/测试项目/);
  });

  it('should truncate long slugs', async () => {
    const longText = 'This is a very long project description that should be truncated';
    await goCommand(longText, {});

    const dirs = fs.readdirSync(mockTmpDir);
    const latestDir = dirs[dirs.length - 1];

    // The slug part should be max 20 chars
    const slugPart = latestDir.split('-').slice(3).join('-'); // Skip timestamp parts
    expect(slugPart.length).toBeLessThanOrEqual(20);
  });
});
