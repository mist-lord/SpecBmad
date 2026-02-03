/**
 * BoundaryGuard - Main Security Controller
 *
 * Implements the Fail-Closed Security model by coordinating:
 * - Circuit Breaker for system-wide safety
 * - Tool Validator for parameter-level security
 * - Contract Loader for agent permissions
 * - Security Event logging for audit
 *
 * @see ADR-ARCH-004-boundary-driven-architecture.md v2.1
 * @module core/boundary/guard
 */

import {
  AgentContract,
  BoundaryGuardConfig,
  CircuitState,
  ContractViolation,
  DEFAULT_BOUNDARY_GUARD_CONFIG,
  IBoundaryGuard,
  IContractLoader,
  IToolValidator,
  Permission,
  SecurityEvent,
  SecurityEventType,
  ToolCall,
  ValidationResult,
} from './types';
import { CircuitBreaker, createCircuitBreaker } from './circuit-breaker';
import { ToolValidator, createToolValidator } from './tool-validator';

/**
 * Check if an object has getters, toJSON, or other properties that could
 * return inconsistent values between validation and execution.
 *
 * SECURITY: Objects with getters, custom toJSON, or Proxy characteristics
 * can return different values on each access, bypassing validation.
 *
 * Note: Full Proxy detection is not possible in JavaScript, but we detect
 * common patterns. For maximum security, use executeWithGuardSafe which
 * passes a plain cloned object to the executor.
 *
 * @param obj - Object to check
 * @param visited - Set of visited objects for circular reference handling
 * @returns true if object has security-concerning properties
 */
function hasSecurityConcerningProperties(
  obj: unknown,
  visited: Set<unknown> = new Set()
): boolean {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }

  if (visited.has(obj)) {
    return false;
  }
  visited.add(obj);

  // Check for toJSON method
  if (typeof (obj as Record<string, unknown>).toJSON === 'function') {
    return true;
  }

  // Check for getters in own properties
  const descriptors = Object.getOwnPropertyDescriptors(obj);
  for (const key of Object.keys(descriptors)) {
    if (descriptors[key].get) {
      return true;
    }
  }

  // Check for getters in prototype chain (catches some Proxy-like patterns)
  let proto = Object.getPrototypeOf(obj);
  while (proto && proto !== Object.prototype && proto !== Array.prototype) {
    const protoDescriptors = Object.getOwnPropertyDescriptors(proto);
    for (const key of Object.keys(protoDescriptors)) {
      if (protoDescriptors[key].get && key !== '__proto__') {
        return true;
      }
    }
    proto = Object.getPrototypeOf(proto);
  }

  // Recursively check nested objects
  for (const key of Object.keys(obj as object)) {
    if (hasSecurityConcerningProperties((obj as Record<string, unknown>)[key], visited)) {
      return true;
    }
  }

  return false;
}

/**
 * Deep freeze an object and all nested objects/arrays
 *
 * SECURITY: Prevents TOCTOU attacks by ensuring nested objects cannot be
 * mutated after validation. This is critical for path validation where
 * nested paths like `toolInput.options.basePath` could be modified.
 *
 * Handles circular references by tracking visited objects.
 *
 * @param obj - Object to deep freeze
 * @param visited - WeakSet to track visited objects (internal)
 * @returns The frozen object (same reference)
 */
function deepFreeze<T>(obj: T, visited: WeakSet<object> = new WeakSet()): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle circular references - skip if already visited
  if (visited.has(obj as object)) {
    return obj;
  }
  visited.add(obj as object);

  // Get all properties including non-enumerable ones
  const propNames = Object.getOwnPropertyNames(obj);

  // Freeze nested properties first (depth-first)
  for (const name of propNames) {
    const value = (obj as Record<string, unknown>)[name];
    if (value && typeof value === 'object') {
      deepFreeze(value, visited);
    }
  }

  // Then freeze the object itself
  return Object.freeze(obj);
}

/**
 * Security event listener type
 */
export type SecurityEventListener = (event: SecurityEvent) => void;

/**
 * BoundaryGuard Implementation
 *
 * Provides PreToolUse and PostToolUse hook functionality as specified
 * in ADR-004 Section 4: SDK Integration.
 *
 * @example
 * ```typescript
 * const guard = new BoundaryGuard(contractLoader);
 *
 * // PreToolUse: Check permission before executing tool
 * const permission = await guard.checkPermission({
 *   toolName: 'Write',
 *   toolInput: { file_path: 'src/index.ts', content: '...' },
 *   agentName: 'Developer'
 * });
 *
 * if (!permission.allowed) {
 *   throw new ContractViolation(permission.reason, 'Developer', 'Write', permission.reason);
 * }
 *
 * // Execute tool...
 *
 * // PostToolUse: Validate output
 * const validation = await guard.validateOutput(result, 'CodeArtifacts');
 * if (!validation.valid) {
 *   console.error('Output validation failed:', validation.errors);
 * }
 * ```
 */
export class BoundaryGuard implements IBoundaryGuard {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly toolValidator: IToolValidator;
  private readonly contractLoader: IContractLoader;
  private readonly config: BoundaryGuardConfig;
  private readonly eventListeners: SecurityEventListener[] = [];

  constructor(
    contractLoader: IContractLoader,
    config: Partial<BoundaryGuardConfig> = {},
    toolValidator?: IToolValidator,
    circuitBreaker?: CircuitBreaker
  ) {
    this.config = {
      ...DEFAULT_BOUNDARY_GUARD_CONFIG,
      ...config,
    };
    this.contractLoader = contractLoader;
    this.toolValidator =
      toolValidator ?? createToolValidator(this.config.specProtectedPaths);
    this.circuitBreaker =
      circuitBreaker ?? createCircuitBreaker(this.config.circuitBreaker);
  }

  /**
   * Check permission for a tool call (PreToolUse hook)
   *
   * This is the main entry point for security checks. It:
   * 1. Rejects inputs with getters, toJSON, or Proxy patterns
   * 2. Creates a frozen clone for validation (original is not modified)
   * 3. Checks circuit breaker state
   * 4. Retrieves and verifies agent contract
   * 5. Validates tool parameters against contract
   *
   * SECURITY WARNING - TOCTOU Risk:
   * This function validates a CLONED snapshot of toolInput. After this
   * function returns, the original toolInput can still be mutated.
   * Callers MUST either:
   * - Use executeWithGuard/executeWithGuardSafe (which handle this)
   * - Use the validated values immediately without storing/reusing
   * - Create their own clone before calling checkPermission
   *
   * SECURITY NOTE - Trust Boundary:
   * The agentName is trusted to come from the ToolExecutionContext which
   * is created at the SDK/CLI layer with a fixed agent identity. This
   * prevents impersonation because the caller cannot modify the context
   * after creation. If you're using BoundaryGuard directly, ensure the
   * ToolCall comes from a trusted source.
   *
   * @param toolCall - The tool call to check
   * @returns Permission decision
   */
  async checkPermission(toolCall: ToolCall): Promise<Permission> {
    // SECURITY: Reject objects with getters or toJSON that could return
    // inconsistent values, bypassing validation
    // @see Codex review - HIGH finding: toJSON/getter bypass
    if (hasSecurityConcerningProperties(toolCall.toolInput)) {
      const permission: Permission = {
        allowed: false,
        reason: 'validation-error',
        details: { error: 'input has getters or toJSON' },
      };
      this.emitSecurityEvent('tool_blocked', toolCall, permission);
      return permission;
    }

    // SECURITY: Deep clone and freeze toolInput to prevent TOCTOU attacks
    // @see Codex review - HIGH finding: input mutation after validation
    let frozenToolCall: ToolCall;
    try {
      frozenToolCall = {
        toolName: toolCall.toolName,
        agentName: toolCall.agentName,
        toolInput: deepFreeze(
          JSON.parse(JSON.stringify(toolCall.toolInput))
        ) as Record<string, unknown>,
      };
    } catch {
      // SECURITY: Fail-closed for non-JSON-serializable input
      // Circular refs, BigInt, etc. are denied to maintain audit integrity
      // @see Codex review - MEDIUM finding: JSON.parse/stringify failure
      const permission: Permission = {
        allowed: false,
        reason: 'validation-error',
        details: { error: 'non-serializable input' },
      };
      this.emitSecurityEvent('tool_blocked', toolCall, permission);
      return permission;
    }

    const { toolName, agentName } = frozenToolCall;

    // 1. Circuit Breaker Check (Fail-Closed)
    const circuitPermission = this.circuitBreaker.checkTool(toolName);
    if (!circuitPermission.allowed) {
      this.emitSecurityEvent('tool_blocked', frozenToolCall, circuitPermission);
      return circuitPermission;
    }

    // 2. Get Agent Contract
    // SECURITY: Verify agent has a registered contract (Fail-Closed)
    // Unknown agents are denied by default
    const contract = this.contractLoader.getContract(agentName);
    if (!contract) {
      const permission: Permission = {
        allowed: false,
        reason: 'contract-not-found',
        details: { agentName },
      };
      this.emitSecurityEvent('tool_blocked', frozenToolCall, permission);
      return permission;
    }

    // Track if we're in safe-mode for audit purposes
    const isInSafeMode = circuitPermission.reason === 'safe-mode';

    // 3. Validate Tool Call against Contract
    // NOTE: Success is NOT recorded here - only on actual tool execution completion
    // This prevents premature circuit closure during half-open recovery
    // @see Codex security review - MEDIUM finding: concurrency safety
    try {
      // Use frozen tool call to prevent mutation during validation
      const permission = await this.toolValidator.validateToolCall(
        frozenToolCall,
        contract
      );

      if (!permission.allowed) {
        this.emitSecurityEvent('tool_blocked', frozenToolCall, permission);
        this.circuitBreaker.recordFailure();
      } else {
        // Preserve safe-mode reason for audit logging when circuit is open/half-open
        const finalPermission: Permission = isInSafeMode
          ? { ...permission, reason: 'safe-mode' }
          : permission;
        this.emitSecurityEvent('tool_allowed', frozenToolCall, finalPermission);
        // DO NOT record success here - wait for actual execution result
        // Success should only be recorded after the tool executes successfully
        return finalPermission;
      }

      return permission;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      const permission: Permission = {
        allowed: false,
        reason: 'validation-error',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
      this.emitSecurityEvent('tool_blocked', frozenToolCall, permission);
      return permission;
    }
  }

  /**
   * Validate tool output (PostToolUse hook)
   *
   * @param output - The tool execution result
   * @param schema - The expected output schema name
   * @returns Validation result
   */
  async validateOutput(
    output: unknown,
    schema: string
  ): Promise<ValidationResult> {
    // TODO: Implement schema validation using zod or JSON Schema
    // For now, basic structural validation

    if (output === undefined || output === null) {
      return {
        valid: false,
        errors: ['Output is null or undefined'],
      };
    }

    // Schema validation would go here
    // const schemaValidator = this.getSchemaValidator(schema);
    // return schemaValidator.validate(output);

    return { valid: true };
  }

  /**
   * Get current circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  /**
   * Record a failure (manual circuit breaker control)
   */
  recordFailure(): void {
    this.circuitBreaker.recordFailure();

    if (this.circuitBreaker.isOpen()) {
      this.emitCircuitBreakerEvent('circuit_breaker_opened');
    }
  }

  /**
   * Record a success (manual circuit breaker control)
   */
  recordSuccess(): void {
    const wasOpen = this.circuitBreaker.isOpen();
    this.circuitBreaker.recordSuccess();

    if (wasOpen && this.circuitBreaker.isClosed()) {
      this.emitCircuitBreakerEvent('circuit_breaker_closed');
    }
  }

  /**
   * Reset the boundary guard (for testing)
   */
  reset(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Add a security event listener
   */
  addEventListener(listener: SecurityEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove a security event listener
   */
  removeEventListener(listener: SecurityEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Get contract for an agent
   */
  getContract(agentName: string): AgentContract | undefined {
    return this.contractLoader.getContract(agentName);
  }

  /**
   * Emit a security event
   */
  private emitSecurityEvent(
    type: SecurityEventType,
    toolCall: ToolCall,
    permission: Permission
  ): void {
    if (!this.config.enableAuditLog && this.eventListeners.length === 0) {
      return;
    }

    const event: SecurityEvent = {
      type,
      timestamp: Date.now(),
      agentName: toolCall.agentName,
      toolName: toolCall.toolName,
      toolInput: toolCall.toolInput,
      permission,
    };

    this.notifyListeners(event);
  }

  /**
   * Emit a circuit breaker state change event
   */
  private emitCircuitBreakerEvent(type: SecurityEventType): void {
    const event: SecurityEvent = {
      type,
      timestamp: Date.now(),
      agentName: 'system',
      toolName: 'circuit_breaker',
      permission: {
        allowed: type === 'circuit_breaker_closed',
        reason: type === 'circuit_breaker_opened' ? 'safe-mode' : 'allowed',
      },
      metadata: {
        circuitState: this.circuitBreaker.getSnapshot(),
      },
    };

    this.notifyListeners(event);
  }

  /**
   * Notify all registered event listeners
   */
  private notifyListeners(event: SecurityEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors to avoid breaking the main flow
      }
    }
  }
}

/**
 * Create a BoundaryGuard with the default contract loader
 *
 * Note: This requires a contract loader to be provided.
 * Use createBoundaryGuardWithLoader for full initialization.
 */
export function createBoundaryGuard(
  contractLoader: IContractLoader,
  config?: Partial<BoundaryGuardConfig>
): BoundaryGuard {
  return new BoundaryGuard(contractLoader, config);
}

/**
 * Execute a tool call with boundary guard protection
 *
 * SECURITY LIMITATIONS:
 * - This function freezes the original toolInput, but executors that captured
 *   the reference may still be affected by Proxy objects or prototype getters
 *   that return dynamic values.
 * - For maximum security, use executeWithGuardSafe() which passes a plain
 *   cloned object to the executor, completely isolating it from the original.
 *
 * This function:
 * 1. Rejects inputs with getters, toJSON, or detected Proxy patterns
 * 2. Deep-freezes the original toolInput to prevent mutation
 * 3. Validates via checkPermission which uses a cloned snapshot
 *
 * @param guard - The BoundaryGuard instance
 * @param toolCall - The tool call to execute
 * @param executor - Function that executes the tool
 * @returns The result of the executor
 * @throws ContractViolation if permission is denied
 */
export async function executeWithGuard<T>(
  guard: BoundaryGuard,
  toolCall: ToolCall,
  executor: () => Promise<T>
): Promise<T> {
  // SECURITY: Reject objects with getters or toJSON that could return
  // inconsistent values, bypassing validation
  // @see Codex review - HIGH finding: toJSON/getter bypass
  if (hasSecurityConcerningProperties(toolCall.toolInput)) {
    throw new ContractViolation(
      `Tool ${toolCall.toolName} blocked: input has getters or toJSON`,
      toolCall.agentName,
      toolCall.toolName,
      'validation-error'
    );
  }

  // SECURITY: Deep freeze the ORIGINAL toolInput in place
  // This ensures any executor closure that captured the input reference
  // will see the frozen version. Mutation attempts will throw TypeError.
  // @see Codex review - HIGH finding: executor can use original mutable input
  deepFreeze(toolCall.toolInput);

  // Validate with the now-frozen original
  const permission = await guard.checkPermission(toolCall);

  if (!permission.allowed) {
    throw new ContractViolation(
      `Tool ${toolCall.toolName} blocked: ${permission.reason}`,
      toolCall.agentName,
      toolCall.toolName,
      permission.reason
    );
  }

  try {
    const result = await executor();
    guard.recordSuccess();
    return result;
  } catch (error) {
    guard.recordFailure();
    throw error;
  }
}

/**
 * Execute a tool call with boundary guard protection (TOCTOU-resistant)
 *
 * SECURITY: This function passes frozen, validated input to the executor,
 * preventing TOCTOU attacks where input is mutated after validation.
 * The executor receives the frozen toolInput as its parameter.
 *
 * @param guard - The BoundaryGuard instance
 * @param toolCall - The tool call to execute
 * @param executor - Function that executes the tool with frozen input
 * @returns The result of the executor
 * @throws ContractViolation if permission is denied
 *
 * @example
 * ```typescript
 * await executeWithGuardSafe(guard, toolCall, async (frozenInput) => {
 *   // Use frozenInput, not the original toolCall.toolInput
 *   return await fs.writeFile(frozenInput.file_path, frozenInput.content);
 * });
 * ```
 */
export async function executeWithGuardSafe<T>(
  guard: BoundaryGuard,
  toolCall: ToolCall,
  executor: (frozenInput: Record<string, unknown>) => Promise<T>
): Promise<T> {
  // SECURITY: Reject objects with getters or toJSON that could return
  // inconsistent values, bypassing validation
  // @see Codex review - HIGH finding: toJSON/getter bypass
  if (hasSecurityConcerningProperties(toolCall.toolInput)) {
    throw new ContractViolation(
      `Tool ${toolCall.toolName} blocked: input has getters or toJSON`,
      toolCall.agentName,
      toolCall.toolName,
      'validation-error'
    );
  }

  // SECURITY: Clone and deep freeze toolInput at security boundary entry point
  // @see Codex review - HIGH finding: executor must receive frozen input
  let frozenInput: Record<string, unknown>;
  try {
    frozenInput = deepFreeze(
      JSON.parse(JSON.stringify(toolCall.toolInput))
    ) as Record<string, unknown>;
  } catch {
    // Handle non-JSON-serializable input (circular refs, BigInt, etc.)
    // Fail-closed: deny the operation
    throw new ContractViolation(
      `Tool ${toolCall.toolName} blocked: non-serializable input`,
      toolCall.agentName,
      toolCall.toolName,
      'validation-error'
    );
  }

  const frozenToolCall: ToolCall = {
    toolName: toolCall.toolName,
    agentName: toolCall.agentName,
    toolInput: frozenInput,
  };

  const permission = await guard.checkPermission(frozenToolCall);

  if (!permission.allowed) {
    throw new ContractViolation(
      `Tool ${toolCall.toolName} blocked: ${permission.reason}`,
      frozenToolCall.agentName,
      frozenToolCall.toolName,
      permission.reason
    );
  }

  try {
    // SECURITY: Pass frozen input to executor, ensuring validated values are used
    const result = await executor(frozenInput);
    guard.recordSuccess();
    return result;
  } catch (error) {
    guard.recordFailure();
    throw error;
  }
}
