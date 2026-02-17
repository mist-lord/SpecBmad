/**
 * SDK Integration for BoundaryGuard
 *
 * This module provides the integration point for tool execution
 * in CLI/SDK environments. BaseAgent remains unchanged as it is
 * prompt-based, not tool-calling based.
 *
 * @see ADR-ARCH-004-boundary-driven-architecture.md v2.1
 * @module core/boundary/sdk-integration
 */

import {
  BoundaryGuard,
  createBoundaryGuard,
  executeWithGuard,
  SecurityEventListener,
} from './guard';
import { ContractLoader, createContractLoader } from './contract';
import {
  CircuitState,
  ContractViolation,
  Permission,
  SecurityEvent,
  ToolCall,
} from './types';

/**
 * Tool Execution Context for CLI/SDK Integration
 *
 * Provides a scoped context for executing tools with BoundaryGuard protection.
 * Each agent should have its own context instance.
 *
 * @example
 * ```typescript
 * // In CLI command handler
 * const ctx = new ToolExecutionContext('Developer');
 *
 * // Execute tool safely
 * const result = await ctx.executeToolSafely(
 *   'Write',
 *   { file_path: 'src/index.ts', content: '...' },
 *   async () => fs.writeFile(...)
 * );
 *
 * // Check circuit state
 * if (ctx.getCircuitState() === 'open') {
 *   console.warn('Circuit breaker is open');
 * }
 * ```
 */
export class ToolExecutionContext {
  private readonly guard: BoundaryGuard;
  private readonly agentName: string;
  private readonly contractLoader: ContractLoader;

  constructor(agentName: string, contractLoader?: ContractLoader) {
    this.agentName = agentName;
    this.contractLoader = contractLoader ?? createContractLoader();
    this.guard = createBoundaryGuard(this.contractLoader);
  }

  /**
   * Execute a tool with BoundaryGuard protection
   *
   * This is the main entry point for safe tool execution.
   * It performs:
   * 1. Permission check (PreToolUse)
   * 2. Tool execution
   * 3. Success/failure recording for circuit breaker
   *
   * @param toolName - The name of the tool to execute
   * @param toolInput - The input parameters for the tool
   * @param executor - The function that actually executes the tool
   * @returns The result of the tool execution
   * @throws ContractViolation if permission is denied
   */
  async executeToolSafely<T>(
    toolName: string,
    toolInput: Record<string, unknown>,
    executor: () => Promise<T>
  ): Promise<T> {
    const toolCall: ToolCall = {
      toolName,
      toolInput,
      agentName: this.agentName,
    };

    return executeWithGuard(this.guard, toolCall, executor);
  }

  /**
   * Check permission without executing the tool
   *
   * Useful for pre-flight checks or UI indicators.
   *
   * @param toolName - The tool to check
   * @param toolInput - The input parameters
   * @returns Permission decision
   */
  async checkPermission(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<Permission> {
    return this.guard.checkPermission({
      toolName,
      toolInput,
      agentName: this.agentName,
    });
  }

  /**
   * Get the current circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.guard.getCircuitState();
  }

  /**
   * Check if the circuit breaker is open (fail-closed mode)
   */
  isInSafeMode(): boolean {
    return this.guard.getCircuitState() === 'open';
  }

  /**
   * Add a security event listener
   *
   * @param listener - Callback for security events
   */
  addEventListener(listener: SecurityEventListener): void {
    this.guard.addEventListener(listener);
  }

  /**
   * Remove a security event listener
   */
  removeEventListener(listener: SecurityEventListener): void {
    this.guard.removeEventListener(listener);
  }

  /**
   * Get the agent name for this context
   */
  getAgentName(): string {
    return this.agentName;
  }

  /**
   * Reset the circuit breaker (for testing/recovery)
   */
  reset(): void {
    this.guard.reset();
  }
}

/**
 * Create a tool execution context for an agent
 *
 * Factory function for creating ToolExecutionContext instances.
 * Uses default contracts (synchronous, always available).
 *
 * @param agentName - The name of the agent
 * @returns A new ToolExecutionContext with default contracts
 */
export function createAgentContext(agentName: string): ToolExecutionContext {
  return new ToolExecutionContext(agentName);
}

/**
 * Create a tool execution context with custom contracts
 *
 * Async factory function that ensures custom contracts are loaded
 * before returning the context. This prevents policy bypass via
 * race condition with default contracts.
 *
 * @param agentName - The name of the agent
 * @param contractPath - Path to custom contract YAML
 * @returns A new ToolExecutionContext with custom contracts loaded
 */
export async function createAgentContextWithContracts(
  agentName: string,
  contractPath: string
): Promise<ToolExecutionContext> {
  const loader = createContractLoader();

  // SECURITY: Await contract loading to prevent fall-through to defaults
  // @see Codex review - HIGH finding: async loading causes policy bypass
  await loader.loadContracts(contractPath);

  return new ToolExecutionContext(agentName, loader);
}

/**
 * Batch tool execution with automatic rollback on failure
 *
 * Executes multiple tools in sequence. If any tool fails,
 * the circuit breaker is notified and subsequent tools may be blocked.
 *
 * @param ctx - The tool execution context
 * @param operations - Array of tool operations to execute
 * @returns Array of results
 */
export async function executeBatch<T>(
  ctx: ToolExecutionContext,
  operations: Array<{
    toolName: string;
    toolInput: Record<string, unknown>;
    executor: () => Promise<T>;
  }>
): Promise<T[]> {
  const results: T[] = [];

  for (const op of operations) {
    // Check if circuit breaker opened during batch
    if (ctx.isInSafeMode()) {
      throw new ContractViolation(
        'Circuit breaker opened during batch execution',
        ctx.getAgentName(),
        op.toolName,
        'circuit-breaker-open-unsafe-tool'
      );
    }

    const result = await ctx.executeToolSafely(
      op.toolName,
      op.toolInput,
      op.executor
    );
    results.push(result);
  }

  return results;
}

/**
 * Security event logger for CLI output
 *
 * Creates a listener that logs security events to console with formatting.
 *
 * @param options - Logging options
 * @returns Security event listener
 */
export function createSecurityLogger(options?: {
  verbose?: boolean;
  logBlocked?: boolean;
  logAllowed?: boolean;
}): SecurityEventListener {
  const opts = {
    verbose: false,
    logBlocked: true,
    logAllowed: false,
    ...options,
  };

  return (event: SecurityEvent) => {
    const timestamp = new Date(event.timestamp).toISOString();
    const prefix = `[${timestamp}] [${event.agentName}]`;

    if (event.type === 'tool_blocked' && opts.logBlocked) {
      console.warn(
        `${prefix} BLOCKED: ${event.toolName} - ${event.permission.reason}`
      );
      if (opts.verbose && event.permission.details) {
        console.warn('  Details:', JSON.stringify(event.permission.details));
      }
    }

    if (event.type === 'tool_allowed' && opts.logAllowed) {
      console.log(`${prefix} ALLOWED: ${event.toolName}`);
    }

    if (event.type === 'circuit_breaker_opened') {
      console.error(`${prefix} CIRCUIT BREAKER OPENED - Safe mode activated`);
    }

    if (event.type === 'circuit_breaker_closed') {
      console.log(`${prefix} CIRCUIT BREAKER CLOSED - Normal operation resumed`);
    }
  };
}

/**
 * Export types for external use
 */
export type {
  CircuitState,
  Permission,
  SecurityEvent,
  ToolCall,
  ContractViolation,
};
