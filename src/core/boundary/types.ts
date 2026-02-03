/**
 * Boundary Guard Type Definitions
 *
 * Implements the Fail-Closed Security model as specified in
 * ADR-ARCH-004-boundary-driven-architecture.md v2.1
 *
 * @module core/boundary/types
 */

/**
 * Circuit breaker states for Fail-Closed security
 * - closed: Normal operation, all tools allowed per contract
 * - open: Safety mode, only SAFE_MODE_TOOLS allowed
 * - half-open: Recovery probe, limited operations to test recovery
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Safe mode tools that are allowed when circuit breaker is open
 * These are read-only tools that cannot modify system state
 * @see ADR-004 v2.1 Change 1: Fail-Open → Fail-Closed
 */
export const SAFE_MODE_TOOLS = ['Read', 'Glob', 'Grep'] as const;
export type SafeModeTool = (typeof SAFE_MODE_TOOLS)[number];

/**
 * Tool parameter schemas for comprehensive validation
 * @see ADR-004 v2.1 Change 4: Complete tool parameter checking
 */
export const TOOL_PARAM_SCHEMAS = {
  Write: { file_path: 'path', content: 'content' },
  Edit: { file_path: 'path', old_string: 'content', new_string: 'content' },
  Bash: { command: 'command' },
  Read: { file_path: 'path' },
  Glob: { pattern: 'pattern', path: 'path' },
  Grep: { pattern: 'pattern', path: 'path' },
  Delete: { file_path: 'path' },
} as const;

export type ToolName = keyof typeof TOOL_PARAM_SCHEMAS;
export type ParamType = 'path' | 'content' | 'command' | 'pattern';

/**
 * Permission decision result from BoundaryGuard
 */
export interface Permission {
  readonly allowed: boolean;
  readonly reason: PermissionReason;
  readonly details?: Record<string, unknown>;
}

/**
 * Standard permission denial reasons
 */
export type PermissionReason =
  | 'allowed'
  | 'safe-mode'
  | 'circuit-breaker-open-unsafe-tool'
  | 'tool-not-allowed'
  | 'path-not-allowed'
  | 'path-traversal-detected'
  | 'spec-protection'
  | 'command-injection-detected'
  | 'contract-not-found'
  | 'validation-error';

/**
 * Tool call request structure
 */
export interface ToolCall {
  readonly toolName: string;
  readonly toolInput: Record<string, unknown>;
  readonly agentName: string;
  readonly timestamp?: number;
}

/**
 * Agent scope definition
 */
export interface AgentScope {
  readonly read: readonly string[];
  readonly write: readonly string[];
  readonly forbidden: readonly string[];
}

/**
 * Agent contract definition
 * @see ADR-004 Section 3: Agent Boundary
 */
export interface AgentContract {
  readonly name: string;
  readonly scope: AgentScope;
  readonly allowed_tools: readonly string[];
  readonly allowed_paths: readonly string[];
  readonly input_schema: string;
  readonly output_schema: string;
  readonly success_criteria?: Record<string, boolean>;
}

/**
 * Agent contracts configuration file structure
 */
export interface AgentContractsConfig {
  readonly $schema: string;
  readonly version: string;
  readonly agents: Record<string, Omit<AgentContract, 'name'>>;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly resetTimeout: number;
  readonly halfOpenMaxAttempts: number;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenMaxAttempts: 3,
};

/**
 * Circuit breaker state snapshot
 */
export interface CircuitBreakerState {
  readonly state: CircuitState;
  readonly failureCount: number;
  readonly lastFailureTime: number;
  readonly halfOpenAttempts: number;
}

/**
 * Security event for audit logging
 */
export interface SecurityEvent {
  readonly type: SecurityEventType;
  readonly timestamp: number;
  readonly agentName: string;
  readonly toolName: string;
  readonly toolInput?: Record<string, unknown>;
  readonly permission: Permission;
  readonly metadata?: Record<string, unknown>;
}

export type SecurityEventType =
  | 'tool_blocked'
  | 'tool_allowed'
  | 'circuit_breaker_opened'
  | 'circuit_breaker_closed'
  | 'contract_violation'
  | 'path_traversal_attempt'
  | 'command_injection_attempt';

/**
 * BoundaryGuard configuration
 */
export interface BoundaryGuardConfig {
  readonly contractsPath: string;
  readonly circuitBreaker: CircuitBreakerConfig;
  readonly specProtectedPaths: readonly string[];
  readonly enableAuditLog: boolean;
}

/**
 * Default BoundaryGuard configuration
 */
export const DEFAULT_BOUNDARY_GUARD_CONFIG: BoundaryGuardConfig = {
  contractsPath: '.specbmad/agent-contracts.yaml',
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  specProtectedPaths: ['spec/', './spec/', '/spec/'],
  enableAuditLog: true,
};

/**
 * Contract violation error
 */
export class ContractViolation extends Error {
  public readonly agentName: string;
  public readonly toolName: string;
  public readonly reason: PermissionReason;

  constructor(
    message: string,
    agentName: string,
    toolName: string,
    reason: PermissionReason
  ) {
    super(message);
    this.name = 'ContractViolation';
    this.agentName = agentName;
    this.toolName = toolName;
    this.reason = reason;
  }
}

/**
 * Output validation result
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors?: readonly string[];
}

/**
 * BoundaryGuard interface for dependency injection
 */
export interface IBoundaryGuard {
  checkPermission(toolCall: ToolCall): Promise<Permission>;
  validateOutput(output: unknown, schema: string): Promise<ValidationResult>;
  getCircuitState(): CircuitState;
  recordFailure(): void;
  recordSuccess(): void;
}

/**
 * Contract loader interface
 */
export interface IContractLoader {
  loadContracts(path: string): Promise<void>;
  getContract(agentName: string): AgentContract | undefined;
  validateContract(contract: AgentContract): boolean;
  getAllContracts(): ReadonlyMap<string, AgentContract>;
}

/**
 * Tool validator interface
 */
export interface IToolValidator {
  validateToolCall(
    toolCall: ToolCall,
    contract: AgentContract
  ): Promise<Permission>;
  isPathAllowed(path: string, allowedPaths: readonly string[]): boolean;
  hasPathTraversal(path: string): boolean;
  isSpecProtected(path: string): boolean;
}
