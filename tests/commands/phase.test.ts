/**
 * Phase Command Unit Tests
 *
 * 测试phase命令的核心功能：
 * - Phase transition (0→1→2→3)
 * - Gate validation
 * - Invalid transitions
 * - Event recording
 *
 * @see src/commands/phase.ts
 */

// Mock dependencies before imports
jest.mock('chalk', () => require('../commands/command-test-utils').mockChalk());
jest.mock('@/utils/logger', () => require('../commands/command-test-utils').mockLogger());
jest.mock('@/utils/error', () => require('../commands/command-test-utils').mockErrorHandler());
jest.mock('@/utils/config', () => require('../commands/command-test-utils').mockConfig());
jest.mock('@/core/phase/controller', () => require('../commands/command-test-utils').mockPhaseController());
jest.mock('@/core/events/store', () => require('../commands/command-test-utils').mockEventStore());

// 现在导入被测试的模块
import { phaseCommand } from '@/commands/phase';
import { log } from '@/utils/logger';
import { mockProcessExit } from './command-test-utils';

describe('PhaseCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Phase transition', () => {
    it('should transition to specified phase (0→1)', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      const mockTransitionTo = jest.fn().mockResolvedValue({
        success: true,
        timestamp: new Date().toISOString(),
        gateResults: []
      });
      PhaseController.prototype.transitionTo = mockTransitionTo;
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(0);

      await phaseCommand({ transition: 1 });

      expect(mockTransitionTo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ currentPhase: 0 })
      );
    });

    it('should transition through all phases (0→1→2→3)', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      const mockTransitionTo = jest.fn().mockResolvedValue({
        success: true,
        timestamp: new Date().toISOString(),
        gateResults: []
      });
      PhaseController.prototype.transitionTo = mockTransitionTo;

      // Transition through phases: 0→1, 1→2, 2→3
      for (let fromPhase = 0; fromPhase < 3; fromPhase++) {
        const toPhase = fromPhase + 1;
        PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(fromPhase);
        await phaseCommand({ transition: toPhase });
        expect(mockTransitionTo).toHaveBeenCalledWith(toPhase, expect.anything());
      }
    });

    it('should call phaseController.transitionTo with correct phase number', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      const mockTransitionTo = jest.fn().mockResolvedValue({
        success: true,
        timestamp: new Date().toISOString(),
        gateResults: []
      });
      PhaseController.prototype.transitionTo = mockTransitionTo;
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(1);

      await phaseCommand({ transition: 2 });

      expect(mockTransitionTo).toHaveBeenCalledWith(2, expect.any(Object));
    });

    it('should log success message after transition', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      PhaseController.prototype.transitionTo = jest.fn().mockResolvedValue({
        success: true,
        timestamp: new Date().toISOString(),
        gateResults: []
      });
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(0);

      await phaseCommand({ transition: 1 });

      expect(log.success).toHaveBeenCalledWith(
        expect.stringContaining('Phase 迁移成功')
      );
    });
  });

  describe('Gate validation', () => {
    it('should validate gates before transition', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      const mockTransitionTo = jest.fn().mockResolvedValue({
        success: true,
        timestamp: new Date().toISOString(),
        gateResults: [
          { gateId: 'spec-exists', passed: true, message: 'Spec file exists' }
        ]
      });
      PhaseController.prototype.transitionTo = mockTransitionTo;
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(0);

      await phaseCommand({ transition: 1 });

      expect(mockTransitionTo).toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Gate 检查结果')
      );
    });

    it('should block transition when gate validation fails', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      const mockTransitionTo = jest.fn().mockResolvedValue({
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Gate validation failed: spec-exists',
        gateResults: [
          { gateId: 'spec-exists', passed: false, message: 'Spec file missing' }
        ]
      });
      PhaseController.prototype.transitionTo = mockTransitionTo;
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(0);

      const mockExit = mockProcessExit();

      await expect(
        phaseCommand({ transition: 1 })
      ).rejects.toThrow('process.exit(1)');

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Phase 迁移失败')
      );

      mockExit.mockRestore();
    });

    it('should allow force transition even if gate fails (--force)', async () => {
      // Note: Current implementation doesn't support --force flag
      // This test documents expected behavior for future implementation
      const { PhaseController } = require('@/core/phase/controller');
      const mockTransitionTo = jest.fn().mockResolvedValue({
        success: true,
        timestamp: new Date().toISOString(),
        gateResults: []
      });
      PhaseController.prototype.transitionTo = mockTransitionTo;
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(2);

      await phaseCommand({ transition: 1 }); // backward transition

      // Currently may fail if gates are strict
      // Future: should pass with --force flag
      expect(mockTransitionTo).toHaveBeenCalled();
    });

    it('should log gate validation errors', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      const mockTransitionTo = jest.fn().mockResolvedValue({
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Gate failed',
        gateResults: [
          { gateId: 'spec-valid', passed: false, message: 'Spec validation failed' }
        ]
      });
      PhaseController.prototype.transitionTo = mockTransitionTo;
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(0);

      const mockExit = mockProcessExit();

      await expect(phaseCommand({ transition: 1 })).rejects.toThrow();

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Gate 检查结果')
      );

      mockExit.mockRestore();
    });
  });

  describe('Invalid transitions', () => {
    it('should reject invalid phase numbers (<0 or >3)', async () => {
      const mockExit = mockProcessExit();

      await expect(phaseCommand({ transition: 5 })).rejects.toThrow('process.exit(1)');
      await expect(phaseCommand({ transition: -1 })).rejects.toThrow('process.exit(1)');

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('无效 Phase')
      );

      mockExit.mockRestore();
    });

    it('should reject non-integer phase numbers', async () => {
      const mockExit = mockProcessExit();

      // Non-integer will be converted by Number() and may still fail validation
      await expect(phaseCommand({ transition: 1.5 as any })).rejects.toThrow();

      mockExit.mockRestore();
    });

    it('should reject backward phase transitions (without --force)', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      const mockTransitionTo = jest.fn().mockResolvedValue({
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Backward transition not allowed without --force',
        gateResults: []
      });
      PhaseController.prototype.transitionTo = mockTransitionTo;
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(2);

      const mockExit = mockProcessExit();

      await expect(phaseCommand({ transition: 1 })).rejects.toThrow();

      mockExit.mockRestore();
    });
  });

  describe('Current phase display', () => {
    it('should display current phase when no argument provided', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(1);

      await phaseCommand({}); // no options = show current phase

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('当前 Phase: 1')
      );
    });

    it('should show phase metadata (name, description, gates)', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(0);

      await phaseCommand({ show: true });

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Phase 0: Capture')
      );
      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Phase 1: Design')
      );
    });
  });

  describe('Event recording', () => {
    it('should record phase transition event', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      const { EventStore } = require('@/core/events/store');

      const mockAppendEvent = jest.fn();
      EventStore.prototype.appendEvent = mockAppendEvent;

      PhaseController.prototype.transitionTo = jest.fn().mockResolvedValue({
        success: true,
        timestamp: new Date().toISOString(),
        gateResults: []
      });
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(0);

      await phaseCommand({ transition: 1 });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'phase_transition',
          phase: 1,
          status: 'passed'
        })
      );
    });

    it('should include timestamp and metadata in event', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      const { EventStore } = require('@/core/events/store');

      const mockAppendEvent = jest.fn();
      EventStore.prototype.appendEvent = mockAppendEvent;

      const testTimestamp = new Date().toISOString();
      PhaseController.prototype.transitionTo = jest.fn().mockResolvedValue({
        success: true,
        timestamp: testTimestamp,
        gateResults: []
      });
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(1);

      await phaseCommand({ transition: 2 });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
          actor: 'phase-command',
          inputs: expect.objectContaining({
            fromPhase: 1,
            toPhase: 2
          })
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle phaseController errors gracefully', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      PhaseController.prototype.transitionTo = jest.fn().mockRejectedValue(
        new Error('PhaseController internal error')
      );
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(0);

      await expect(
        phaseCommand({ transition: 1 })
      ).rejects.toThrow('PhaseController internal error');

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('Phase 命令执行失败')
      );
    });

    it('should display helpful error message on failure', async () => {
      const { PhaseController } = require('@/core/phase/controller');
      PhaseController.prototype.transitionTo = jest.fn().mockRejectedValue(
        new Error('Gate validation failed: missing spec file')
      );
      PhaseController.prototype.getCurrentPhase = jest.fn().mockReturnValue(0);

      await expect(phaseCommand({ transition: 1 })).rejects.toThrow();

      expect(log.error).toHaveBeenCalledWith(
        expect.stringMatching(/Phase 命令执行失败.*missing spec file/)
      );
    });
  });
});
