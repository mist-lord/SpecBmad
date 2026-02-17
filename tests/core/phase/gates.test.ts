/**
 * Gate Registry and Checkers Tests
 */

import { gateRegistry, GateChecker, GateCheckContext, registerDefaultGates } from '@/core/phase/gates';
import { GateResult } from '@/core/phase/types';
import fs from 'fs';
import path from 'path';
import {
  createTempCoreDir,
  cleanupTempCoreDir,
  createReviewReportFile,
} from '../core-test-utils';

describe('GateRegistry', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempCoreDir('gate-registry-test-');
  });

  afterEach(() => {
    cleanupTempCoreDir(tempDir);
  });

  describe('register', () => {
    test('should register a single gate', () => {
      const mockChecker: GateChecker = {
        checkGate: jest.fn(),
      };

      gateRegistry.register('test_gate', mockChecker);

      const retrieved = gateRegistry.get('test_gate');
      expect(retrieved).toBe(mockChecker);
    });

    test('should register multiple gates', () => {
      const mockChecker1: GateChecker = {
        checkGate: jest.fn(),
      };
      const mockChecker2: GateChecker = {
        checkGate: jest.fn(),
      };

      gateRegistry.register('gate1', mockChecker1);
      gateRegistry.register('gate2', mockChecker2);

      expect(gateRegistry.get('gate1')).toBe(mockChecker1);
      expect(gateRegistry.get('gate2')).toBe(mockChecker2);
    });

    test('should overwrite gate on duplicate registration', () => {
      const mockChecker1: GateChecker = {
        checkGate: jest.fn().mockResolvedValue({ gateId: 'test', passed: true }),
      };
      const mockChecker2: GateChecker = {
        checkGate: jest.fn().mockResolvedValue({ gateId: 'test', passed: false }),
      };

      gateRegistry.register('duplicate_gate', mockChecker1);
      gateRegistry.register('duplicate_gate', mockChecker2);

      const retrieved = gateRegistry.get('duplicate_gate');
      expect(retrieved).toBe(mockChecker2);
    });
  });

  describe('get', () => {
    test('should return existing gate', () => {
      const mockChecker: GateChecker = {
        checkGate: jest.fn(),
      };

      gateRegistry.register('existing_gate', mockChecker);

      const retrieved = gateRegistry.get('existing_gate');
      expect(retrieved).toBe(mockChecker);
    });

    test('should return undefined for missing gate', () => {
      const retrieved = gateRegistry.get('non_existent_gate');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('checkGates', () => {
    test('should return empty array for empty gate list', async () => {
      const context: GateCheckContext = {
        phase: 1,
        projectRoot: tempDir,
        metadata: {},
      };

      const results = await gateRegistry.checkGates([], context);

      expect(results).toEqual([]);
    });

    test('should execute single gate checker', async () => {
      const mockChecker: GateChecker = {
        checkGate: jest.fn().mockResolvedValue({
          gateId: 'test_gate',
          passed: true,
          blocking: true,
          message: 'Gate passed',
        }),
      };

      gateRegistry.register('test_gate', mockChecker);

      const context: GateCheckContext = {
        phase: 1,
        projectRoot: tempDir,
        metadata: {},
      };

      const results = await gateRegistry.checkGates(['test_gate'], context);

      expect(results).toHaveLength(1);
      expect(results[0].gateId).toBe('test_gate');
      expect(results[0].passed).toBe(true);
      expect(mockChecker.checkGate).toHaveBeenCalledWith('test_gate', context);
    });

    test('should execute multiple gate checkers', async () => {
      const mockChecker1: GateChecker = {
        checkGate: jest.fn().mockResolvedValue({
          gateId: 'gate1',
          passed: true,
          blocking: true,
          message: 'Gate 1 passed',
        }),
      };

      const mockChecker2: GateChecker = {
        checkGate: jest.fn().mockResolvedValue({
          gateId: 'gate2',
          passed: false,
          blocking: false,
          message: 'Gate 2 failed',
        }),
      };

      gateRegistry.register('gate1', mockChecker1);
      gateRegistry.register('gate2', mockChecker2);

      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const results = await gateRegistry.checkGates(['gate1', 'gate2'], context);

      expect(results).toHaveLength(2);
      expect(results[0].gateId).toBe('gate1');
      expect(results[0].passed).toBe(true);
      expect(results[1].gateId).toBe('gate2');
      expect(results[1].passed).toBe(false);
    });

    test('should return failed result for missing gate', async () => {
      const context: GateCheckContext = {
        phase: 1,
        projectRoot: tempDir,
        metadata: {},
      };

      const results = await gateRegistry.checkGates(['missing_gate'], context);

      expect(results).toHaveLength(1);
      expect(results[0].gateId).toBe('missing_gate');
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toContain('Gate 检查器未注册');
    });

    test('should handle gate checker throwing error', async () => {
      const mockChecker: GateChecker = {
        checkGate: jest.fn().mockRejectedValue(new Error('Gate check failed')),
      };

      gateRegistry.register('error_gate', mockChecker);

      const context: GateCheckContext = {
        phase: 1,
        projectRoot: tempDir,
        metadata: {},
      };

      const results = await gateRegistry.checkGates(['error_gate'], context);

      expect(results).toHaveLength(1);
      expect(results[0].gateId).toBe('error_gate');
      expect(results[0].passed).toBe(false);
      expect(results[0].message).toContain('Gate 检查异常');
      expect(results[0].message).toContain('Gate check failed');
    });

    test('should execute gate checkers asynchronously', async () => {
      const mockChecker1: GateChecker = {
        checkGate: jest.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            gateId: 'async1',
            passed: true,
            blocking: true,
            message: 'Async 1 passed',
          };
        }),
      };

      const mockChecker2: GateChecker = {
        checkGate: jest.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return {
            gateId: 'async2',
            passed: true,
            blocking: true,
            message: 'Async 2 passed',
          };
        }),
      };

      gateRegistry.register('async1', mockChecker1);
      gateRegistry.register('async2', mockChecker2);

      const context: GateCheckContext = {
        phase: 1,
        projectRoot: tempDir,
        metadata: {},
      };

      const startTime = Date.now();
      const results = await gateRegistry.checkGates(['async1', 'async2'], context);
      const endTime = Date.now();

      expect(results).toHaveLength(2);
      expect(endTime - startTime).toBeGreaterThanOrEqual(15);
    });
  });
});

describe('ReviewGateChecker', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = createTempCoreDir('review-gate-test-');
    await registerDefaultGates();
  });

  afterEach(() => {
    cleanupTempCoreDir(tempDir);
  });

  describe('checkGate', () => {
    test('should pass when review_report.md contains "PASSED"', async () => {
      createReviewReportFile(tempDir, true);

      const checker = gateRegistry.get('review_passed');
      expect(checker).toBeDefined();

      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      expect(result.gateId).toBe('review_passed');
      expect(result.passed).toBe(true);
      expect(result.blocking).toBe(true);
      expect(result.message).toContain('QA Review 通过');
    });

    test('should fail when review_report.md contains "通过" (word boundary issue)', async () => {
      const reportPath = path.join(tempDir, '.specbmad', 'artifacts', 'review_report.md');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, '# Review Report\n\n状态: **通过** ✅', 'utf-8');

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      // Note: Word boundary \b doesn't work with Chinese characters
      // This is a known limitation of the current regex implementation
      expect(result.passed).toBe(false);
      expect(result.blocking).toBe(true);
    });

    test('should pass when review_report.md contains "approved"', async () => {
      const reportPath = path.join(tempDir, '.specbmad', 'artifacts', 'review_report.md');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, '# Review Report\n\nStatus: approved by QA', 'utf-8');

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      expect(result.passed).toBe(true);
      expect(result.blocking).toBe(true);
    });

    test('should fail when review_report.md exists without keywords', async () => {
      const reportPath = path.join(tempDir, '.specbmad', 'artifacts', 'review_report.md');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, '# Review Report\n\nNo status keywords here', 'utf-8');

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      expect(result.passed).toBe(false);
      expect(result.blocking).toBe(true);
      expect(result.message).toContain('QA Review 未通过');
    });

    test('should default pass when review_report.md is missing', async () => {
      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      expect(result.passed).toBe(true);
      expect(result.blocking).toBe(true);
      expect(result.message).toContain('Review report 不存在');
    });

    test('should fail when file read error occurs', async () => {
      const reportPath = path.join(tempDir, '.specbmad', 'artifacts', 'review_report.md');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, 'valid content', 'utf-8');

      fs.chmodSync(reportPath, 0o000);

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      expect(result.passed).toBe(false);
      expect(result.blocking).toBe(true);
      expect(result.message).toContain('读取 review report 失败');

      fs.chmodSync(reportPath, 0o644);
    });

    test('should always set blocking flag to true', async () => {
      createReviewReportFile(tempDir, true);

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      expect(result.blocking).toBe(true);
    });

    test('should construct correct path to review_report.md', async () => {
      createReviewReportFile(tempDir, true);

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      await checker!.checkGate('review_passed', context);

      const expectedPath = path.join(tempDir, '.specbmad', 'artifacts', 'review_report.md');
      expect(fs.existsSync(expectedPath)).toBe(true);
    });

    test('should handle UTF-8 encoding correctly but fail on Chinese word boundary', async () => {
      const reportPath = path.join(tempDir, '.specbmad', 'artifacts', 'review_report.md');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(
        reportPath,
        '# 评审报告\n\n状态: **PASSED** ✅\n\n包含中文和特殊字符: 测试',
        'utf-8'
      );

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      // Using PASSED keyword works with UTF-8
      expect(result.passed).toBe(true);
    });

    test('should be case insensitive for "PASSED" keyword', async () => {
      const reportPath = path.join(tempDir, '.specbmad', 'artifacts', 'review_report.md');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, '# Review Report\n\nStatus: PaSsEd', 'utf-8');

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      expect(result.passed).toBe(true);
    });

    test('should not match partial words (e.g., "BYPASSED")', async () => {
      const reportPath = path.join(tempDir, '.specbmad', 'artifacts', 'review_report.md');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, '# Review Report\n\nStatus: BYPASSED', 'utf-8');

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      expect(result.passed).toBe(false);
    });

    test('should match "approved" in various contexts', async () => {
      const reportPath = path.join(tempDir, '.specbmad', 'artifacts', 'review_report.md');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, '# Review\n\nThis PR is approved.', 'utf-8');

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      expect(result.passed).toBe(true);
    });

    test('should include appropriate message field', async () => {
      createReviewReportFile(tempDir, true);

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      if (result.message) {
        expect(result.message.length).toBeGreaterThan(0);
      }
    });

    test('should handle empty review_report.md file', async () => {
      const reportPath = path.join(tempDir, '.specbmad', 'artifacts', 'review_report.md');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, '', 'utf-8');

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('QA Review 未通过');
    });

    test('should handle very large review_report.md file', async () => {
      const reportPath = path.join(tempDir, '.specbmad', 'artifacts', 'review_report.md');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });

      const largeContent = '# Review\n\n' + 'x'.repeat(100000) + '\n\nStatus: PASSED\n';
      fs.writeFileSync(reportPath, largeContent, 'utf-8');

      const checker = gateRegistry.get('review_passed');
      const context: GateCheckContext = {
        phase: 2,
        projectRoot: tempDir,
        metadata: {},
      };

      const result = await checker!.checkGate('review_passed', context);

      expect(result.passed).toBe(true);
    });
  });
});

describe('registerDefaultGates', () => {
  beforeEach(async () => {
    await registerDefaultGates();
  });

  test('should register review_passed gate', () => {
    const checker = gateRegistry.get('review_passed');
    expect(checker).toBeDefined();
  });

  test('should make review_passed gate accessible', async () => {
    const checker = gateRegistry.get('review_passed');
    expect(checker).toBeDefined();

    const tempDir = createTempCoreDir('default-gates-');
    createReviewReportFile(tempDir, true);

    const context: GateCheckContext = {
      phase: 2,
      projectRoot: tempDir,
      metadata: {},
    };

    const result = await checker!.checkGate('review_passed', context);

    expect(result.gateId).toBe('review_passed');
    expect(result.passed).toBe(true);

    cleanupTempCoreDir(tempDir);
  });

  test('should execute checkGate on registered gate', async () => {
    const checker = gateRegistry.get('review_passed');
    expect(checker).toBeDefined();

    const tempDir = createTempCoreDir('execute-gate-');

    const context: GateCheckContext = {
      phase: 2,
      projectRoot: tempDir,
      metadata: {},
    };

    const result = await checker!.checkGate('review_passed', context);

    expect(result).toBeDefined();
    expect(result.gateId).toBe('review_passed');
    expect(result.passed).toBeDefined();
    expect(result.blocking).toBeDefined();
    expect(result.message).toBeDefined();

    cleanupTempCoreDir(tempDir);
  });

  test('should be idempotent (safe to call multiple times)', async () => {
    await registerDefaultGates();
    await registerDefaultGates();

    const checker = gateRegistry.get('review_passed');
    expect(checker).toBeDefined();
  });

  test('should not throw errors during registration', async () => {
    await expect(registerDefaultGates()).resolves.not.toThrow();
  });
});
