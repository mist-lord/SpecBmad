/**
 * DeepCode Integration Unit Tests
 *
 * Tests for the DeepCode verification module (deprecated for 4-Phase MVP).
 * @see src/core/verification/deepcode.ts
 */

import fs from 'fs';
import path from 'path';

// Mock dependencies before importing the module
jest.mock('fs');
jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/utils/paths', () => ({
  getCodePath: jest.fn(() => '/test/code'),
  getSpecPath: jest.fn((file?: string) => `/test/spec/${file || ''}`),
  getVerificationPath: jest.fn((file?: string) => `/test/verification/${file || ''}`),
}));

jest.mock('@/core/bridge/python', () => ({
  pythonBridge: {
    execute: jest.fn(),
  },
}));

jest.mock('@/core/spec/openspec', () => ({
  OpenSpecIntegration: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({
      success: true,
      outputPath: '/test/spec/formal_spec.yaml',
      gateResult: {
        gateId: 'openspec_passed',
        passed: true,
        message: 'OpenSpec 校验通过',
      },
    }),
  })),
}));

// Import after mocks
import {
  DeepCodeIntegration,
  DeepCodeGateChecker,
  VerificationGateChecker,
  deepCode,
} from '@/core/verification/deepcode';
import { pythonBridge } from '@/core/bridge/python';
import { log } from '@/utils/logger';
import { getCodePath, getSpecPath, getVerificationPath } from '@/utils/paths';
import { OpenSpecIntegration } from '@/core/spec/openspec';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPythonBridge = pythonBridge as jest.Mocked<typeof pythonBridge>;

describe('DeepCodeIntegration', () => {
  let integration: DeepCodeIntegration;

  beforeEach(() => {
    jest.clearAllMocks();
    integration = new DeepCodeIntegration();

    // Default fs mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);
  });

  describe('execute()', () => {
    describe('input validation', () => {
      it('should return error when formal spec file does not exist', async () => {
        mockFs.existsSync.mockReturnValue(false);

        const result = await integration.execute({
          formalSpecPath: '/test/formal_spec.yaml',
        });

        expect(result.success).toBe(false);
        expect(result.gateResult.passed).toBe(false);
        expect(result.gateResult.gateId).toBe('deepcode_passed');
        expect(result.error).toContain('Formal Spec 文件不存在');
        expect(log.error).toHaveBeenCalled();
      });

      it('should use default paths when no options provided', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          // Formal spec exists, script does not
          return String(p).includes('formal_spec.yaml');
        });

        await integration.execute();

        expect(getCodePath).toHaveBeenCalled();
        expect(getSpecPath).toHaveBeenCalledWith('formal_spec.yaml');
        expect(getVerificationPath).toHaveBeenCalledWith('deepcode_report.md');
      });
    });

    describe('directory creation', () => {
      it('should create output directory recursively', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          return String(p).includes('formal_spec.yaml');
        });

        await integration.execute({
          formalSpecPath: '/test/formal_spec.yaml',
          outputPath: '/test/verification/deepcode_report.md',
        });

        expect(mockFs.mkdirSync).toHaveBeenCalledWith('/test/verification', { recursive: true });
      });
    });

    describe('mock fallback', () => {
      it('should use mock when DeepCode script does not exist', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          // Formal spec exists, script does not
          if (String(p).includes('formal_spec.yaml')) return true;
          if (String(p).includes('verify.py')) return false;
          return false;
        });

        const result = await integration.execute({
          formalSpecPath: '/test/formal_spec.yaml',
        });

        expect(result.success).toBe(true);
        expect(result.gateResult.passed).toBe(true);
        expect(result.gateResult.message).toContain('Mock');
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('使用 Mock 实现'));
        expect(mockPythonBridge.execute).not.toHaveBeenCalled();
      });

      it('should generate markdown report in mock mode', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          if (String(p).includes('formal_spec.yaml')) return true;
          return false;
        });

        const result = await integration.execute({
          codePath: '/test/code',
          formalSpecPath: '/test/formal_spec.yaml',
          outputPath: '/test/report.md',
        });

        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          '/test/report.md',
          expect.stringContaining('DeepCode 验证报告'),
          'utf-8'
        );
        expect(result.reportPath).toBe('/test/report.md');
      });

      it('should include timestamp in mock report', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          if (String(p).includes('formal_spec.yaml')) return true;
          return false;
        });

        await integration.execute({
          formalSpecPath: '/test/formal_spec.yaml',
        });

        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringMatching(/\d{4}-\d{2}-\d{2}T/),
          'utf-8'
        );
      });

      it('should handle file write errors in mock mode', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          if (String(p).includes('formal_spec.yaml')) return true;
          return false;
        });
        mockFs.writeFileSync.mockImplementation(() => {
          throw new Error('Write error');
        });

        const result = await integration.execute({
          formalSpecPath: '/test/formal_spec.yaml',
        });

        expect(result.success).toBe(false);
        expect(result.gateResult.passed).toBe(false);
        expect(result.error).toContain('Write error');
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

        await integration.execute({
          codePath: '/test/code',
          formalSpecPath: '/test/spec.yaml',
          outputPath: '/test/report.md',
          deepCodeScriptPath: '/test/verify.py',
        });

        expect(mockPythonBridge.execute).toHaveBeenCalledWith({
          scriptPath: '/test/verify.py',
          args: ['--code', '/test/code', '--spec', '/test/spec.yaml', '--output', '/test/report.md'],
          cwd: process.cwd(),
          timeout: 120000,
        });
      });

      it('should use 120 second timeout', async () => {
        mockPythonBridge.execute.mockResolvedValue({
          success: true,
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

        await integration.execute({
          deepCodeScriptPath: '/test/verify.py',
        });

        expect(mockPythonBridge.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            timeout: 120000,
          })
        );
      });

      it('should return success when Python script succeeds', async () => {
        mockPythonBridge.execute.mockResolvedValue({
          success: true,
          stdout: 'verified',
          stderr: '',
          exitCode: 0,
        });

        const result = await integration.execute({
          deepCodeScriptPath: '/test/verify.py',
        });

        expect(result.success).toBe(true);
        expect(result.gateResult.passed).toBe(true);
        expect(result.gateResult.message).toBe('DeepCode 验证通过');
        expect(log.success).toHaveBeenCalled();
      });

      it('should return failure when Python script fails', async () => {
        mockPythonBridge.execute.mockResolvedValue({
          success: false,
          stdout: '',
          stderr: 'verification failed',
          exitCode: 1,
        });

        const result = await integration.execute({
          deepCodeScriptPath: '/test/verify.py',
        });

        expect(result.success).toBe(false);
        expect(result.gateResult.passed).toBe(false);
        expect(result.gateResult.details).toEqual({
          exitCode: 1,
          stderr: 'verification failed',
        });
      });

      it('should handle Python bridge exceptions', async () => {
        mockPythonBridge.execute.mockRejectedValue(new Error('Python timeout'));

        const result = await integration.execute({
          deepCodeScriptPath: '/test/verify.py',
        });

        expect(result.success).toBe(false);
        expect(result.gateResult.passed).toBe(false);
        expect(result.error).toContain('Python timeout');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });
});

describe('DeepCodeGateChecker', () => {
  let checker: DeepCodeGateChecker;
  const mockContext = { phase: 3, projectRoot: '/test/project' };

  beforeEach(() => {
    jest.clearAllMocks();
    checker = new DeepCodeGateChecker();

    // Setup default mocks for gate checks (mock fallback)
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p).includes('formal_spec.yaml')) return true;
      return false;
    });
  });

  describe('checkGate()', () => {
    it('should accept deepcode_passed gate ID', async () => {
      const result = await checker.checkGate('deepcode_passed', mockContext);

      expect(result.gateId).toBe('deepcode_passed');
    });

    it('should reject unknown gate IDs', async () => {
      const result = await checker.checkGate('unknown_gate', mockContext);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('未知的 Gate ID');
    });

    it('should call path utilities with correct arguments', async () => {
      await checker.checkGate('deepcode_passed', mockContext);

      expect(getCodePath).toHaveBeenCalled();
      expect(getSpecPath).toHaveBeenCalledWith('formal_spec.yaml');
      expect(getVerificationPath).toHaveBeenCalledWith('deepcode_report.md');
    });

    it('should return gate result from execute', async () => {
      const result = await checker.checkGate('deepcode_passed', mockContext);

      expect(result.gateId).toBe('deepcode_passed');
      expect(typeof result.passed).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });
  });
});

describe('VerificationGateChecker', () => {
  let checker: VerificationGateChecker;
  let mockOpenSpecExecute: jest.Mock;
  const mockContext = { phase: 4, projectRoot: '/test/project' };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the OpenSpecIntegration mock
    mockOpenSpecExecute = jest.fn().mockResolvedValue({
      success: true,
      outputPath: '/test/spec/formal_spec.yaml',
      gateResult: {
        gateId: 'openspec_passed',
        passed: true,
        message: 'OpenSpec 校验通过',
      },
    });
    (OpenSpecIntegration as jest.Mock).mockImplementation(() => ({
      execute: mockOpenSpecExecute,
    }));

    checker = new VerificationGateChecker();

    // Setup default mocks (mock fallback for DeepCode)
    mockFs.existsSync.mockImplementation((p) => {
      if (String(p).includes('formal_spec.yaml')) return true;
      return false;
    });
  });

  describe('checkGate()', () => {
    it('should accept verification_passed gate ID', async () => {
      const result = await checker.checkGate('verification_passed', mockContext);

      expect(result.gateId).toBe('verification_passed');
    });

    it('should reject unknown gate IDs', async () => {
      const result = await checker.checkGate('unknown_gate', mockContext);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('未知的 Gate ID');
    });

    describe('chain execution', () => {
      it('should execute DeepCode first', async () => {
        await checker.checkGate('verification_passed', mockContext);

        // DeepCode should have run (checking mock fallback was used)
        expect(log.info).toHaveBeenCalledWith(expect.stringContaining('DeepCode'));
      });

      it('should execute OpenSpec after DeepCode passes', async () => {
        await checker.checkGate('verification_passed', mockContext);

        expect(mockOpenSpecExecute).toHaveBeenCalled();
      });

      it('should return combined success when both pass', async () => {
        const result = await checker.checkGate('verification_passed', mockContext);

        expect(result.passed).toBe(true);
        expect(result.message).toContain('DeepCode 和 OpenSpec 验证都通过');
        expect(result.details).toEqual(
          expect.objectContaining({
            verificationType: 'full_verification',
          })
        );
      });

      it('should short-circuit when DeepCode fails', async () => {
        // Make formal spec not exist to cause DeepCode failure
        mockFs.existsSync.mockReturnValue(false);

        const result = await checker.checkGate('verification_passed', mockContext);

        expect(result.passed).toBe(false);
        expect(result.details?.failureType).toBe('deepcode_failure');
        expect(mockOpenSpecExecute).not.toHaveBeenCalled();
      });

      it('should return openspec_failure when OpenSpec fails', async () => {
        mockOpenSpecExecute.mockResolvedValue({
          success: false,
          outputPath: '/test/spec/formal_spec.yaml',
          gateResult: {
            gateId: 'openspec_passed',
            passed: false,
            message: 'OpenSpec 校验失败',
          },
        });

        const result = await checker.checkGate('verification_passed', mockContext);

        expect(result.passed).toBe(false);
        expect(result.details?.failureType).toBe('openspec_failure');
      });

      it('should include both gate results in success details', async () => {
        const result = await checker.checkGate('verification_passed', mockContext);

        expect(result.details?.deepCodeResult).toBeDefined();
        expect(result.details?.openSpecResult).toBeDefined();
      });
    });
  });
});

describe('deepCode singleton', () => {
  it('should be an instance of DeepCodeIntegration', () => {
    expect(deepCode).toBeInstanceOf(DeepCodeIntegration);
  });
});
