/**
 * Circuit Breaker Implementation for Fail-Closed Security
 *
 * Implements the circuit breaker pattern to ensure system safety when
 * security checks fail. When the circuit is open, only safe read-only
 * tools are allowed (Fail-Closed behavior).
 *
 * @see ADR-ARCH-004-boundary-driven-architecture.md v2.1 Change 1
 * @module core/boundary/circuit-breaker
 */

import {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerState,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  Permission,
  SAFE_MODE_TOOLS,
  SafeModeTool,
} from './types';

/**
 * Circuit Breaker for Fail-Closed Security
 *
 * State Machine:
 * - Closed: Normal operation, all tools allowed per contract
 * - Open: Safety mode triggered after failure threshold, only SAFE_MODE_TOOLS allowed
 * - Half-Open: Recovery probe after timeout, limited attempts to test recovery
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker();
 *
 * // Normal operation
 * breaker.checkTool('Write'); // { allowed: true, reason: 'allowed' }
 *
 * // After multiple failures
 * for (let i = 0; i < 5; i++) breaker.recordFailure();
 * breaker.checkTool('Write'); // { allowed: false, reason: 'circuit-breaker-open-unsafe-tool' }
 * breaker.checkTool('Read');  // { allowed: true, reason: 'safe-mode' }
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private readonly config: CircuitBreakerConfig;
  // SEC-002 fix: Guard against re-entrant state transitions
  private transitionInProgress = false;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...config,
    };
  }

  /**
   * Check if a tool is allowed based on current circuit state
   *
   * @param toolName - The tool being requested
   * @returns Permission decision with reason
   */
  checkTool(toolName: string): Permission {
    this.updateState();

    if (this.state === 'closed') {
      return { allowed: true, reason: 'allowed' };
    }

    // In open or half-open state, only safe tools are allowed
    if (this.isSafeModeTool(toolName)) {
      return { allowed: true, reason: 'safe-mode' };
    }

    return {
      allowed: false,
      reason: 'circuit-breaker-open-unsafe-tool',
      details: {
        currentState: this.state,
        failureCount: this.failureCount,
        safeTools: [...SAFE_MODE_TOOLS],
      },
    };
  }

  /**
   * Record a failure, potentially opening the circuit
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Failure during recovery attempt, re-open the circuit
      this.state = 'open';
      this.halfOpenAttempts = 0;
    } else if (
      this.state === 'closed' &&
      this.failureCount >= this.config.failureThreshold
    ) {
      // Threshold exceeded, open the circuit
      this.state = 'open';
    }
  }

  /**
   * Record a success, potentially closing the circuit
   */
  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.halfOpenAttempts++;

      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        // Enough successful attempts, close the circuit
        this.reset();
      }
    } else if (this.state === 'closed' && this.failureCount > 0) {
      // Gradual recovery in closed state
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Get the current circuit state
   */
  getState(): CircuitState {
    this.updateState();
    return this.state;
  }

  /**
   * Check if the circuit is currently open (in safety mode)
   */
  isOpen(): boolean {
    this.updateState();
    return this.state === 'open';
  }

  /**
   * Check if the circuit is in half-open recovery state
   */
  isHalfOpen(): boolean {
    this.updateState();
    return this.state === 'half-open';
  }

  /**
   * Check if the circuit is closed (normal operation)
   */
  isClosed(): boolean {
    this.updateState();
    return this.state === 'closed';
  }

  /**
   * Get a snapshot of the current state
   */
  getSnapshot(): CircuitBreakerState {
    this.updateState();
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      halfOpenAttempts: this.halfOpenAttempts,
    };
  }

  /**
   * Force the circuit to a specific state (for testing only)
   * @internal
   */
  forceState(state: CircuitState): void {
    this.state = state;
    if (state === 'closed') {
      this.reset();
    } else if (state === 'open') {
      // Set lastFailureTime to now to prevent immediate transition to half-open
      this.lastFailureTime = Date.now();
      this.failureCount = this.config.failureThreshold;
    } else if (state === 'half-open') {
      // Set lastFailureTime to past to allow half-open state
      this.lastFailureTime = Date.now() - this.config.resetTimeout - 1;
      this.halfOpenAttempts = 0;
    }
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
    this.transitionInProgress = false;
  }

  /**
   * Update state based on timeout (transition from open to half-open)
   *
   * SEC-002 fix: Uses transitionInProgress guard to prevent race conditions
   * in concurrent async contexts where multiple calls could trigger simultaneous
   * state transitions.
   */
  private updateState(): void {
    // Prevent re-entrant transitions (SEC-002 race condition fix)
    if (this.transitionInProgress) {
      return;
    }

    if (this.state === 'open') {
      this.transitionInProgress = true;
      try {
        const elapsed = Date.now() - this.lastFailureTime;

        if (elapsed >= this.config.resetTimeout) {
          // Double-check pattern: verify state hasn't changed
          if (this.state === 'open') {
            // Timeout exceeded, transition to half-open for recovery probe
            this.state = 'half-open';
            this.halfOpenAttempts = 0;
          }
        }
      } finally {
        this.transitionInProgress = false;
      }
    }
  }

  /**
   * Check if a tool is in the safe mode tools list
   */
  private isSafeModeTool(toolName: string): toolName is SafeModeTool {
    return SAFE_MODE_TOOLS.includes(toolName as SafeModeTool);
  }
}

/**
 * Create a circuit breaker with custom configuration
 */
export function createCircuitBreaker(
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  return new CircuitBreaker(config);
}

/**
 * Singleton instance for shared circuit breaker state
 */
let sharedInstance: CircuitBreaker | null = null;

/**
 * Get the shared circuit breaker instance
 */
export function getSharedCircuitBreaker(): CircuitBreaker {
  if (!sharedInstance) {
    sharedInstance = new CircuitBreaker();
  }
  return sharedInstance;
}

/**
 * Reset the shared circuit breaker instance (for testing)
 * @internal
 */
export function resetSharedCircuitBreaker(): void {
  sharedInstance = null;
}

/**
 * Re-export CircuitBreakerConfig for convenience
 */
export type { CircuitBreakerConfig } from './types';
