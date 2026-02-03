/**
 * Circuit Breaker Unit Tests
 *
 * Tests the Fail-Closed security mechanism for BoundaryGuard.
 * @see ADR-ARCH-004-boundary-driven-architecture.md v2.1 Change 1
 */

import {
  CircuitBreaker,
  createCircuitBreaker,
  getSharedCircuitBreaker,
  resetSharedCircuitBreaker,
} from '@/core/boundary/circuit-breaker';
import { SAFE_MODE_TOOLS } from '@/core/boundary/types';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      halfOpenMaxAttempts: 2,
    });
  });

  describe('Initial State', () => {
    it('should start in closed state', () => {
      expect(breaker.getState()).toBe('closed');
      expect(breaker.isClosed()).toBe(true);
      expect(breaker.isOpen()).toBe(false);
    });

    it('should allow all tools in closed state', () => {
      const tools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Delete'];
      for (const tool of tools) {
        const permission = breaker.checkTool(tool);
        expect(permission.allowed).toBe(true);
        expect(permission.reason).toBe('allowed');
      }
    });
  });

  describe('Failure Recording', () => {
    it('should remain closed below failure threshold', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('closed');
    });

    it('should open after reaching failure threshold', () => {
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe('open');
      expect(breaker.isOpen()).toBe(true);
    });
  });

  describe('Open State (Fail-Closed)', () => {
    beforeEach(() => {
      // Force open state
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure();
      }
    });

    it('should only allow safe mode tools when open', () => {
      for (const tool of SAFE_MODE_TOOLS) {
        const permission = breaker.checkTool(tool);
        expect(permission.allowed).toBe(true);
        expect(permission.reason).toBe('safe-mode');
      }
    });

    it('should block unsafe tools when open', () => {
      const unsafeTools = ['Write', 'Edit', 'Bash', 'Delete'];
      for (const tool of unsafeTools) {
        const permission = breaker.checkTool(tool);
        expect(permission.allowed).toBe(false);
        expect(permission.reason).toBe('circuit-breaker-open-unsafe-tool');
      }
    });

    it('should include safe tools list in blocked response details', () => {
      const permission = breaker.checkTool('Write');
      expect(permission.details).toBeDefined();
      expect(permission.details?.safeTools).toEqual([...SAFE_MODE_TOOLS]);
    });
  });

  describe('Half-Open State (Recovery)', () => {
    beforeEach(() => {
      // Force open state
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure();
      }
    });

    it('should transition to half-open after timeout', async () => {
      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Check state - should be half-open now
      expect(breaker.getState()).toBe('half-open');
      expect(breaker.isHalfOpen()).toBe(true);
    });

    it('should still allow only safe tools in half-open state', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const permission = breaker.checkTool('Write');
      expect(permission.allowed).toBe(false);

      const safePermission = breaker.checkTool('Read');
      expect(safePermission.allowed).toBe(true);
    });

    it('should close after sufficient successful attempts in half-open', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Verify we're in half-open state
      expect(breaker.isHalfOpen()).toBe(true);

      // Record enough successful attempts (configured as 2)
      breaker.recordSuccess();
      expect(breaker.isHalfOpen()).toBe(true); // Still half-open after first

      breaker.recordSuccess();
      expect(breaker.isClosed()).toBe(true); // Now closed
    });

    it('should re-open on failure during half-open', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(breaker.isHalfOpen()).toBe(true);

      // Record failure during recovery
      breaker.recordFailure();

      expect(breaker.getState()).toBe('open');
    });
  });

  describe('Success Recording', () => {
    it('should decrease failure count on success in closed state', () => {
      breaker.recordFailure();
      breaker.recordFailure();

      const snapshotBefore = breaker.getSnapshot();
      expect(snapshotBefore.failureCount).toBe(2);

      breaker.recordSuccess();

      const snapshotAfter = breaker.getSnapshot();
      expect(snapshotAfter.failureCount).toBe(1);
    });

    it('should not go below zero failure count', () => {
      breaker.recordSuccess();
      breaker.recordSuccess();

      const snapshot = breaker.getSnapshot();
      expect(snapshot.failureCount).toBe(0);
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', () => {
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure();
      }
      expect(breaker.isOpen()).toBe(true);

      breaker.reset();

      expect(breaker.isClosed()).toBe(true);
      const snapshot = breaker.getSnapshot();
      expect(snapshot.failureCount).toBe(0);
    });
  });

  describe('Force State (Testing)', () => {
    it('should allow forcing state for testing', () => {
      breaker.forceState('open');
      expect(breaker.isOpen()).toBe(true);

      breaker.forceState('half-open');
      expect(breaker.isHalfOpen()).toBe(true);

      breaker.forceState('closed');
      expect(breaker.isClosed()).toBe(true);
    });
  });

  describe('Snapshot', () => {
    it('should return complete state snapshot', () => {
      breaker.recordFailure();

      const snapshot = breaker.getSnapshot();

      expect(snapshot.state).toBe('closed');
      expect(snapshot.failureCount).toBe(1);
      expect(snapshot.lastFailureTime).toBeGreaterThan(0);
      expect(snapshot.halfOpenAttempts).toBe(0);
    });
  });

  describe('Factory Functions', () => {
    it('should create circuit breaker with custom config', () => {
      const custom = createCircuitBreaker({
        failureThreshold: 10,
        resetTimeout: 5000,
      });

      // Should need 10 failures to open
      for (let i = 0; i < 9; i++) {
        custom.recordFailure();
      }
      expect(custom.isClosed()).toBe(true);

      custom.recordFailure();
      expect(custom.isOpen()).toBe(true);
    });

    it('should provide shared instance', () => {
      resetSharedCircuitBreaker();

      const shared1 = getSharedCircuitBreaker();
      const shared2 = getSharedCircuitBreaker();

      expect(shared1).toBe(shared2);
    });

    it('should reset shared instance', () => {
      const shared1 = getSharedCircuitBreaker();
      resetSharedCircuitBreaker();
      const shared2 = getSharedCircuitBreaker();

      expect(shared1).not.toBe(shared2);
    });
  });
});
