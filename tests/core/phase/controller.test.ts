/**
 * Phase Controller 测试
 */

import { PhaseController } from '@/core/phase/controller';
import { PhaseContext } from '@/core/phase/types';
import fs from 'fs';
import path from 'path';
import {
  createTempCoreDir,
  cleanupTempCoreDir,
  createPhaseConfigFile,
  createReviewReportFile,
  assertPhaseStateFile,
} from '../core-test-utils';
import { gateRegistry } from '@/core/phase/gates';

describe('PhaseController', () => {
  let tempDir: string;
  let controller: PhaseController;

  beforeEach(() => {
    tempDir = createTempCoreDir('phase-controller-test-');
    createPhaseConfigFile(tempDir);
    controller = new PhaseController(tempDir);
  });

  afterEach(() => {
    cleanupTempCoreDir(tempDir);
  });

  describe('Initialization', () => {
    test('should start at Phase 0 by default', () => {
      expect(controller.getCurrentPhase()).toBe(0);
    });

    test('should use default config when config file does not exist', () => {
      const noConfigDir = createTempCoreDir('no-config-');
      const ctrl = new PhaseController(noConfigDir);

      expect(ctrl.getCurrentPhase()).toBe(0);
      expect(ctrl.canTransitionTo(1)).toBe(true);

      cleanupTempCoreDir(noConfigDir);
    });

    test('should handle malformed YAML config and fall back to defaults', () => {
      const badConfigDir = createTempCoreDir('bad-config-');
      const configPath = path.join(badConfigDir, 'spec', 'phase_transitions.yaml');

      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, 'invalid: yaml: content: [\n', 'utf-8');

      const ctrl = new PhaseController(badConfigDir);
      expect(ctrl.getCurrentPhase()).toBe(0);
      expect(ctrl.canTransitionTo(1)).toBe(true);

      cleanupTempCoreDir(badConfigDir);
    });

    test('should initialize circuit breaker in closed state', () => {
      expect(controller.isCircuitOpen()).toBe(false);
      expect(controller.getCircuitState()).toBe('closed');
    });

    test('should accept custom circuit breaker config', () => {
      const customDir = createTempCoreDir('custom-cb-');
      createPhaseConfigFile(customDir);

      const customController = new PhaseController(customDir, {
        failureThreshold: 10,
        resetTimeout: 120000,
      });

      expect(customController.isCircuitOpen()).toBe(false);

      cleanupTempCoreDir(customDir);
    });
  });

  describe('State Persistence', () => {
    test('should save state after transition', async () => {
      const context: PhaseContext = {
        projectRoot: tempDir,
        currentPhase: 0,
        metadata: {},
      };

      await controller.transitionTo(1, context);

      const stateFile = path.join(tempDir, '.specbmad', 'phase.state.json');
      assertPhaseStateFile(stateFile, 1);
    });

    test('should load existing state on initialization', async () => {
      const context: PhaseContext = {
        projectRoot: tempDir,
        currentPhase: 0,
        metadata: {},
      };

      await controller.transitionTo(1, context);

      const newController = new PhaseController(tempDir);
      expect(newController.getCurrentPhase()).toBe(1);
    });

    test('should handle missing state file gracefully', () => {
      const noStateDir = createTempCoreDir('no-state-');
      createPhaseConfigFile(noStateDir);

      const ctrl = new PhaseController(noStateDir);
      expect(ctrl.getCurrentPhase()).toBe(0);

      cleanupTempCoreDir(noStateDir);
    });

    test('should handle corrupted state file and default to Phase 0', () => {
      const corruptedDir = createTempCoreDir('corrupted-');
      createPhaseConfigFile(corruptedDir);

      const stateFile = path.join(corruptedDir, '.specbmad', 'phase.state.json');
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, '{ invalid json', 'utf-8');

      const ctrl = new PhaseController(corruptedDir);
      expect(ctrl.getCurrentPhase()).toBe(0);

      cleanupTempCoreDir(corruptedDir);
    });
  });

  describe('Phase Transitions', () => {
    test('should allow transition from Phase 0 to Phase 1', () => {
      expect(controller.canTransitionTo(1)).toBe(true);
    });

    test('should not allow transition from Phase 0 directly to Phase 2', () => {
      expect(controller.canTransitionTo(2)).toBe(false);
    });

    test('should successfully transition to next phase', async () => {
      const context: PhaseContext = {
        projectRoot: tempDir,
        currentPhase: 0,
        metadata: {},
      };

      const result = await controller.transitionTo(1, context);

      expect(result.success).toBe(true);
      expect(result.fromPhase).toBe(0);
      expect(result.toPhase).toBe(1);
      expect(controller.getCurrentPhase()).toBe(1);
    });

    test('should fail transition to invalid phase', async () => {
      const context: PhaseContext = {
        projectRoot: tempDir,
        currentPhase: 0,
        metadata: {},
      };

      const result = await controller.transitionTo(2, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('不允许从 Phase 0 迁移到 Phase 2');
      expect(controller.getCurrentPhase()).toBe(0);
    });

    test('should return circuit state in transition result', async () => {
      const context: PhaseContext = {
        projectRoot: tempDir,
        currentPhase: 0,
        metadata: {},
      };

      const result = await controller.transitionTo(1, context);

      expect(result.circuitState).toBeDefined();
      expect(result.circuitState).toBe('closed');
    });

    test('should include timestamp in transition result', async () => {
      const context: PhaseContext = {
        projectRoot: tempDir,
        currentPhase: 0,
        metadata: {},
      };

      const result = await controller.transitionTo(1, context);

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('Gate Checking', () => {
    test('should return empty array when no gates configured', async () => {
      const context: PhaseContext = {
        projectRoot: tempDir,
        currentPhase: 0,
        metadata: {},
      };

      const gateResults = await controller.checkGates(0, context);
      expect(gateResults).toEqual([]);
    });

    test('should check multiple gates', async () => {
      const multiGateDir = createTempCoreDir('multi-gate-');
      createPhaseConfigFile(multiGateDir, {
        phases: {
          0: { next: [1], gates: [] },
          1: { next: [2], gates: ['gate1', 'gate2'] },
          2: { next: [3], gates: [] },
          3: { next: [], gates: [] },
        },
      });

      const mockChecker1 = {
        checkGate: jest.fn().mockResolvedValue({
          gateId: 'gate1',
          passed: true,
          blocking: true,
          message: 'Gate 1 passed',
        }),
      };

      const mockChecker2 = {
        checkGate: jest.fn().mockResolvedValue({
          gateId: 'gate2',
          passed: true,
          blocking: false,
          message: 'Gate 2 passed',
        }),
      };

      gateRegistry.register('gate1', mockChecker1);
      gateRegistry.register('gate2', mockChecker2);

      const ctrl = new PhaseController(multiGateDir);
      const context: PhaseContext = {
        projectRoot: multiGateDir,
        currentPhase: 1,
        metadata: {},
      };

      const results = await ctrl.checkGates(1, context);

      expect(results).toHaveLength(2);
      expect(mockChecker1.checkGate).toHaveBeenCalled();
      expect(mockChecker2.checkGate).toHaveBeenCalled();

      cleanupTempCoreDir(multiGateDir);
    });

    test('should construct GateCheckContext correctly', async () => {
      const gateDir = createTempCoreDir('gate-context-');
      createPhaseConfigFile(gateDir, {
        phases: {
          0: { next: [1], gates: [] },
          1: { next: [2], gates: ['test_gate'] },
          2: { next: [3], gates: [] },
          3: { next: [], gates: [] },
        },
      });

      const mockChecker = {
        checkGate: jest.fn().mockResolvedValue({
          gateId: 'test_gate',
          passed: true,
          blocking: true,
          message: 'Passed',
        }),
      };

      gateRegistry.register('test_gate', mockChecker);

      const ctrl = new PhaseController(gateDir);
      const context: PhaseContext = {
        projectRoot: gateDir,
        currentPhase: 1,
        metadata: { foo: 'bar' },
      };

      await ctrl.checkGates(1, context);

      expect(mockChecker.checkGate).toHaveBeenCalledWith('test_gate', {
        phase: 1,
        projectRoot: gateDir,
        metadata: { foo: 'bar' },
      });

      cleanupTempCoreDir(gateDir);
    });

    test('should block transition when blocking gate fails', async () => {
      const gateDir = createTempCoreDir('blocking-gate-');
      createPhaseConfigFile(gateDir, {
        phases: {
          0: { next: [1], gates: [] },
          1: { next: [2], gates: ['blocking_gate'] },
          2: { next: [3], gates: [] },
          3: { next: [], gates: [] },
        },
      });

      const mockChecker = {
        checkGate: jest.fn().mockResolvedValue({
          gateId: 'blocking_gate',
          passed: false,
          blocking: true,
          message: 'Blocking gate failed',
        }),
      };

      gateRegistry.register('blocking_gate', mockChecker);

      const ctrl = new PhaseController(gateDir);

      // Try to transition to Phase 1 (target has blocking gate that fails)
      const result = await ctrl.transitionTo(1, {
        projectRoot: gateDir,
        currentPhase: 0,
        metadata: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Gate 检查失败');
      expect(ctrl.getCurrentPhase()).toBe(0);

      cleanupTempCoreDir(gateDir);
    });

    test('should not block transition when non-blocking gate fails', async () => {
      const gateDir = createTempCoreDir('non-blocking-gate-');
      createPhaseConfigFile(gateDir, {
        phases: {
          0: { next: [1], gates: [] },
          1: { next: [2], gates: ['non_blocking_gate'] },
          2: { next: [3], gates: [] },
          3: { next: [], gates: [] },
        },
      });

      const mockChecker = {
        checkGate: jest.fn().mockResolvedValue({
          gateId: 'non_blocking_gate',
          passed: false,
          blocking: false,
          message: 'Non-blocking gate failed',
        }),
      };

      gateRegistry.register('non_blocking_gate', mockChecker);

      const ctrl = new PhaseController(gateDir);

      await ctrl.transitionTo(1, {
        projectRoot: gateDir,
        currentPhase: 0,
        metadata: {},
      });

      const result = await ctrl.transitionTo(2, {
        projectRoot: gateDir,
        currentPhase: 1,
        metadata: {},
      });

      expect(result.success).toBe(true);
      expect(ctrl.getCurrentPhase()).toBe(2);

      cleanupTempCoreDir(gateDir);
    });
  });

  describe('CircuitBreaker Integration', () => {
    test('should record success on successful transition', async () => {
      const context: PhaseContext = {
        projectRoot: tempDir,
        currentPhase: 0,
        metadata: {},
      };

      await controller.transitionTo(1, context);

      expect(controller.getCircuitState()).toBe('closed');
      expect(controller.isCircuitOpen()).toBe(false);
    });

    test('should record failure when gate fails', async () => {
      const gateDir = createTempCoreDir('circuit-failure-');
      createPhaseConfigFile(gateDir, {
        phases: {
          0: { next: [1], gates: [] },
          1: { next: [2], gates: ['fail_gate'] },
          2: { next: [3], gates: [] },
          3: { next: [], gates: [] },
        },
      });

      const mockChecker = {
        checkGate: jest.fn().mockResolvedValue({
          gateId: 'fail_gate',
          passed: false,
          blocking: true,
          message: 'Failed',
        }),
      };

      gateRegistry.register('fail_gate', mockChecker);

      const ctrl = new PhaseController(gateDir, { failureThreshold: 1 });

      await ctrl.transitionTo(1, {
        projectRoot: gateDir,
        currentPhase: 0,
        metadata: {},
      });

      await ctrl.transitionTo(2, {
        projectRoot: gateDir,
        currentPhase: 1,
        metadata: {},
      });

      expect(ctrl.isCircuitOpen()).toBe(true);

      cleanupTempCoreDir(gateDir);
    });

    test('should block transition when circuit breaker is open', async () => {
      const gateDir = createTempCoreDir('circuit-open-');
      createPhaseConfigFile(gateDir, {
        phases: {
          0: { next: [1], gates: [] },
          1: { next: [2], gates: ['fail_gate'] },
          2: { next: [3], gates: [] },
          3: { next: [], gates: [] },
        },
      });

      const mockChecker = {
        checkGate: jest.fn().mockResolvedValue({
          gateId: 'fail_gate',
          passed: false,
          blocking: true,
          message: 'Failed',
        }),
      };

      gateRegistry.register('fail_gate', mockChecker);

      const ctrl = new PhaseController(gateDir, { failureThreshold: 1 });

      await ctrl.transitionTo(1, {
        projectRoot: gateDir,
        currentPhase: 0,
        metadata: {},
      });

      const failResult = await ctrl.transitionTo(2, {
        projectRoot: gateDir,
        currentPhase: 1,
        metadata: {},
      });

      expect(failResult.success).toBe(false);
      expect(ctrl.isCircuitOpen()).toBe(true);

      const blockedResult = await ctrl.transitionTo(2, {
        projectRoot: gateDir,
        currentPhase: 1,
        metadata: {},
      });

      expect(blockedResult.success).toBe(false);
      expect(blockedResult.error).toContain('Circuit breaker is open');
      expect(blockedResult.circuitState).toBe('open');

      cleanupTempCoreDir(gateDir);
    });

    test('should reset circuit breaker', async () => {
      const gateDir = createTempCoreDir('circuit-reset-');
      createPhaseConfigFile(gateDir, {
        phases: {
          0: { next: [1], gates: [] },
          1: { next: [2], gates: ['fail_gate'] },
          2: { next: [3], gates: [] },
          3: { next: [], gates: [] },
        },
      });

      const mockChecker = {
        checkGate: jest.fn().mockResolvedValue({
          gateId: 'fail_gate',
          passed: false,
          blocking: true,
          message: 'Failed',
        }),
      };

      gateRegistry.register('fail_gate', mockChecker);

      const ctrl = new PhaseController(gateDir, { failureThreshold: 1 });

      await ctrl.transitionTo(1, {
        projectRoot: gateDir,
        currentPhase: 0,
        metadata: {},
      });

      await ctrl.transitionTo(2, {
        projectRoot: gateDir,
        currentPhase: 1,
        metadata: {},
      });

      expect(ctrl.isCircuitOpen()).toBe(true);

      ctrl.resetCircuitBreaker();

      expect(ctrl.isCircuitOpen()).toBe(false);
      expect(ctrl.getCircuitState()).toBe('closed');

      cleanupTempCoreDir(gateDir);
    });
  });
});

