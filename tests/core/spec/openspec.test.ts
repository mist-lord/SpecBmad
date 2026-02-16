/**
 * OpenSpec Integration Unit Tests
 *
 * Tests for the OpenSpec integration module (deprecated for 4-Phase MVP).
 * @see src/core/spec/openspec.ts
 */

import fs from 'fs';
import path from 'path';

// Mock dependencies before importing the module
jest.mock('fs');
jest.mock('yaml');
jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/utils/paths', () => ({
  getSpecPath: jest.fn((file?: string) => `/test/spec/${file || ''}`),
}));

jest.mock('@/core/bridge/python', () => ({
  pythonBridge: {
    execute: jest.fn(),
  },
}));

// Import after mocks
import { OpenSpecIntegration, OpenSpecGateChecker, openSpec } from '@/core/spec/openspec';
import { pythonBridge } from '@/core/bridge/python';
import { log } from '@/utils/logger';
import { getSpecPath } from '@/utils/paths';
import yaml from 'yaml';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockYaml = yaml as jest.Mocked<typeof yaml>;
const mockPythonBridge = pythonBridge as jest.Mocked<typeof pythonBridge>;

describe('OpenSpecIntegration', () => {
  let integration: OpenSpecIntegration;

  beforeEach(() => {
    jest.clearAllMocks();
    integration = new OpenSpecIntegration();

    // Default fs mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.readFileSync.mockReturnValue('schema_version: 1');
    mockFs.writeFileSync.mockReturnValue(undefined);
  });

  describe('execute()', () => {
    describe('input validation', () => {
      it('should return error when intent spec file does not exist', async () => {
        mockFs.existsSync.mockReturnValue(false);

        const result = await integration.execute({
          intentSpecPath: '/test/intent.yaml',
        });

        expect(result.success).toBe(false);
        expect(result.gateResult.passed).toBe(false);
        expect(result.gateResult.gateId).toBe('openspec_passed');
        expect(result.error).toContain('Intent Spec 文件不存在');
        expect(log.error).toHaveBeenCalled();
      });

      it('should use default paths when no options provided', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          // Intent exists, script does not
          return p === '/test/spec/intent.yaml';
        });
        mockYaml.parse.mockReturnValue({ intent: 'test' });
        mockYaml.stringify.mockReturnValue('mock: yaml');

        await integration.execute();

        expect(getSpecPath).toHaveBeenCalledWith('intent.yaml');
        expect(getSpecPath).toHaveBeenCalledWith('formal_spec.yaml');
      });
    });

    describe('directory creation', () => {
      it('should create output directory recursively', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          return p === '/test/intent.yaml';
        });
        mockYaml.parse.mockReturnValue({ intent: 'test' });
        mockYaml.stringify.mockReturnValue('mock: yaml');

        await integration.execute({
          intentSpecPath: '/test/intent.yaml',
          outputPath: '/test/output/formal_spec.yaml',
        });

        expect(mockFs.mkdirSync).toHaveBeenCalledWith('/test/output', { recursive: true });
      });
    });

    describe('mock fallback', () => {
      it('should use mock when OpenSpec script does not exist', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          // Intent exists, script does not
          if (String(p).includes('intent.yaml')) return true;
          if (String(p).includes('validate.py')) return false;
          return false;
        });
        mockYaml.parse.mockReturnValue({ project: 'test' });
        mockYaml.stringify.mockReturnValue('schema_version: 1');

        const result = await integration.execute({
          intentSpecPath: '/test/intent.yaml',
        });

        expect(result.success).toBe(true);
        expect(result.gateResult.passed).toBe(true);
        expect(result.gateResult.message).toContain('Mock');
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('使用 Mock 实现'));
        expect(mockPythonBridge.execute).not.toHaveBeenCalled();
      });

      it('should generate valid FormalSpec structure in mock mode', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          if (String(p).includes('intent.yaml')) return true;
          return false;
        });
        mockYaml.parse.mockReturnValue({ project: 'test' });
        mockYaml.stringify.mockReturnValue('schema_version: 1');

        const result = await integration.execute({
          intentSpecPath: '/test/intent.yaml',
        });

        expect(result.formalSpec).toBeDefined();
        expect(result.formalSpec?.schema_version).toBe(1);
        expect(result.formalSpec?.invariants).toHaveLength(1);
        expect(result.formalSpec?.metadata?.generated_by).toBe('mock-openspec');
      });

      it('should handle file read errors in mock mode', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          if (String(p).includes('intent.yaml')) return true;
          return false;
        });
        mockFs.readFileSync.mockImplementation(() => {
          throw new Error('File read error');
        });

        const result = await integration.execute({
          intentSpecPath: '/test/intent.yaml',
        });

        expect(result.success).toBe(false);
        expect(result.gateResult.passed).toBe(false);
        expect(result.error).toContain('File read error');
      });
    });

    describe('Python bridge execution', () => {
      beforeEach(() => {
        mockFs.existsSync.mockReturnValue(true);
      });

      it('should call pythonBridge with correct arguments', async () => {
        mockPythonBridge.execute.mockResolvedValue({
          success: true,
          stdout: '',
          stderr: '',
          exitCode: 0,
        });
        mockYaml.parse.mockReturnValue({ schema_version: 1 });

        await integration.execute({
          intentSpecPath: '/test/intent.yaml',
          outputPath: '/test/output.yaml',
          openSpecScriptPath: '/test/validate.py',
        });

        expect(mockPythonBridge.execute).toHaveBeenCalledWith({
          scriptPath: '/test/validate.py',
          args: ['--input', '/test/intent.yaml', '--output', '/test/output.yaml'],
          cwd: process.cwd(),
          timeout: 60000,
        });
      });

      it('should return success when Python script succeeds', async () => {
        mockPythonBridge.execute.mockResolvedValue({
          success: true,
          stdout: 'success',
          stderr: '',
          exitCode: 0,
        });
        mockYaml.parse.mockReturnValue({ schema_version: 1 });

        const result = await integration.execute({
          intentSpecPath: '/test/intent.yaml',
          openSpecScriptPath: '/test/validate.py',
        });

        expect(result.success).toBe(true);
        expect(result.gateResult.passed).toBe(true);
        expect(result.gateResult.message).toBe('OpenSpec 校验通过');
        expect(log.success).toHaveBeenCalled();
      });

      it('should return failure when Python script fails', async () => {
        mockPythonBridge.execute.mockResolvedValue({
          success: false,
          stdout: '',
          stderr: 'validation error',
          exitCode: 1,
        });

        const result = await integration.execute({
          intentSpecPath: '/test/intent.yaml',
          openSpecScriptPath: '/test/validate.py',
        });

        expect(result.success).toBe(false);
        expect(result.gateResult.passed).toBe(false);
        expect(result.gateResult.details).toEqual({
          exitCode: 1,
          stderr: 'validation error',
        });
      });

      it('should handle Python bridge exceptions', async () => {
        mockPythonBridge.execute.mockRejectedValue(new Error('Python not found'));

        const result = await integration.execute({
          intentSpecPath: '/test/intent.yaml',
          openSpecScriptPath: '/test/validate.py',
        });

        expect(result.success).toBe(false);
        expect(result.gateResult.passed).toBe(false);
        expect(result.error).toContain('Python not found');
        expect(log.error).toHaveBeenCalled();
      });
    });

    describe('output parsing', () => {
      beforeEach(() => {
        mockFs.existsSync.mockReturnValue(true);
        mockPythonBridge.execute.mockResolvedValue({
          success: true,
          stdout: '',
          stderr: '',
          exitCode: 0,
        });
      });

      it('should parse output YAML when file exists', async () => {
        const mockSpec = { schema_version: 1, invariants: [] };
        mockYaml.parse.mockReturnValue(mockSpec);

        const result = await integration.execute({
          intentSpecPath: '/test/intent.yaml',
          outputPath: '/test/output.yaml',
          openSpecScriptPath: '/test/validate.py',
        });

        expect(result.formalSpec).toEqual(mockSpec);
      });

      it('should continue without formalSpec when YAML parse fails', async () => {
        mockYaml.parse.mockImplementation(() => {
          throw new Error('YAML parse error');
        });

        const result = await integration.execute({
          intentSpecPath: '/test/intent.yaml',
          openSpecScriptPath: '/test/validate.py',
        });

        expect(result.success).toBe(true);
        expect(result.formalSpec).toBeUndefined();
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('解析 formal_spec.yaml 失败'));
      });

      it('should skip parsing when output file does not exist', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          // Intent and script exist, output does not
          if (String(p).includes('intent.yaml')) return true;
          if (String(p).includes('validate.py')) return true;
          if (String(p).includes('formal_spec')) return false;
          return true;
        });

        const result = await integration.execute({
          intentSpecPath: '/test/intent.yaml',
          openSpecScriptPath: '/test/validate.py',
        });

        expect(result.success).toBe(true);
        expect(result.formalSpec).toBeUndefined();
      });
    });
  });
});

describe('OpenSpecGateChecker', () => {
  let checker: OpenSpecGateChecker;
  const mockContext = { phase: 1, projectRoot: '/test/project' };

  beforeEach(() => {
    jest.clearAllMocks();
    checker = new OpenSpecGateChecker();

    // Setup default mocks for gate checks
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p).includes('intent.yaml')) return true;
      return false;
    });
    mockYaml.parse.mockReturnValue({ project: 'test' });
    mockYaml.stringify.mockReturnValue('schema_version: 1');
  });

  describe('checkGate()', () => {
    it('should accept openspec_passed gate ID', async () => {
      const result = await checker.checkGate('openspec_passed', mockContext);

      expect(result.gateId).toBe('openspec_passed');
    });

    it('should reject unknown gate IDs', async () => {
      const result = await checker.checkGate('unknown_gate', mockContext);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('未知的 Gate ID');
    });

    it('should call execute with correct paths', async () => {
      await checker.checkGate('openspec_passed', mockContext);

      expect(getSpecPath).toHaveBeenCalledWith('intent.yaml');
      expect(getSpecPath).toHaveBeenCalledWith('formal_spec.yaml');
    });

    it('should return gate result from execute', async () => {
      const result = await checker.checkGate('openspec_passed', mockContext);

      expect(result.gateId).toBe('openspec_passed');
      expect(typeof result.passed).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });
  });
});

describe('openSpec singleton', () => {
  it('should be an instance of OpenSpecIntegration', () => {
    expect(openSpec).toBeInstanceOf(OpenSpecIntegration);
  });
});
