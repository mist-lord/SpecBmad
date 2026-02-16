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

  describe('Race Condition Protection (SEC-002)', () => {
    it('should handle concurrent state transitions safely', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 10, // Very short timeout
        halfOpenMaxAttempts: 2,
      });

      // Force to open state
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe('open');

      // Wait for timeout to allow transition
      await new Promise((resolve) => setTimeout(resolve, 15));

      // Simulate concurrent calls by calling checkTool rapidly
      const results: string[] = [];
      for (let i = 0; i < 10; i++) {
        const permission = breaker.checkTool('Write');
        results.push(permission.reason);
      }

      // All results should be consistent (all same reason)
      const uniqueReasons = new Set(results);
      expect(uniqueReasons.size).toBe(1);

      // State should be half-open after timeout
      expect(breaker.getState()).toBe('half-open');
    });

    it('should not allow double transition from open to half-open', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 5,
        halfOpenMaxAttempts: 1,
      });

      // Force to open state
      breaker.recordFailure();
      expect(breaker.getState()).toBe('open');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Multiple rapid calls should all see consistent state
      const states: string[] = [];
      for (let i = 0; i < 20; i++) {
        breaker.checkTool('Read');
        states.push(breaker.getState());
      }

      // All should be half-open (no unexpected transitions)
      expect(states.every((s) => s === 'half-open')).toBe(true);
    });

    it('should maintain consistent state under rapid success/failure recording', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 100,
        halfOpenMaxAttempts: 3,
      });

      // Rapidly alternate between success and failure
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          breaker.recordFailure();
        } else {
          breaker.recordSuccess();
        }
      }

      // State should be deterministic
      const snapshot = breaker.getSnapshot();
      expect(['closed', 'open', 'half-open']).toContain(snapshot.state);
      expect(typeof snapshot.failureCount).toBe('number');
      expect(snapshot.failureCount).toBeGreaterThanOrEqual(0);
    });

    it('should prevent transition during ongoing transition', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1,
        halfOpenMaxAttempts: 1,
      });

      // Force to open
      breaker.recordFailure();

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Rapid concurrent-like calls
      const promises = Array.from({ length: 5 }, () =>
        Promise.resolve(breaker.checkTool('Read'))
      );

      const results = await Promise.all(promises);

      // All should return consistent results
      const reasons = results.map((r) => r.reason);
      expect(new Set(reasons).size).toBe(1);
    });
  });
});
