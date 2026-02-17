/**
 * Boundary Guard Module
 *
 * Implements Fail-Closed Security for the SpecBmad workflow system.
 * Provides agent permission management, tool parameter validation,
 * and circuit breaker protection.
 *
 * @see ADR-ARCH-004-boundary-driven-architecture.md v2.1
 * @module core/boundary
 */

// Type exports
export type {
  AgentContract,
  AgentContractsConfig,
  AgentScope,
  BoundaryGuardConfig,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitState,
  IBoundaryGuard,
  IContractLoader,
  IToolValidator,
  ParamType,
  Permission,
  PermissionReason,
  SafeModeTool,
  SecurityEvent,
  SecurityEventType,
  ToolCall,
  ToolName,
  ValidationResult,
} from './types';

// Constant exports
export {
  ContractViolation,
  DEFAULT_BOUNDARY_GUARD_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  SAFE_MODE_TOOLS,
  TOOL_PARAM_SCHEMAS,
} from './types';

// Circuit Breaker exports
export {
  CircuitBreaker,
  createCircuitBreaker,
  getSharedCircuitBreaker,
  resetSharedCircuitBreaker,
} from './circuit-breaker';

// Tool Validator exports
export { createToolValidator, ToolValidator } from './tool-validator';

// Contract Loader exports
export {
  ContractLoader,
  createContractLoader,
  createContractLoaderWithConfig,
} from './contract';

// BoundaryGuard exports
export type { SecurityEventListener } from './guard';
export {
  BoundaryGuard,
  createBoundaryGuard,
  executeWithGuard,
} from './guard';

/**
 * Create a fully initialized BoundaryGuard
 *
 * @example
 * ```typescript
 * import { initializeBoundaryGuard } from '@/core/boundary';
 *
 * const guard = await initializeBoundaryGuard('.specbmad/agent-contracts.yaml');
 *
 * const permission = await guard.checkPermission({
 *   toolName: 'Write',
 *   toolInput: { file_path: 'src/index.ts' },
 *   agentName: 'Developer'
 * });
 * ```
 */
export async function initializeBoundaryGuard(
  contractsPath?: string
): Promise<import('./guard').BoundaryGuard> {
  const { ContractLoader } = await import('./contract');
  const { BoundaryGuard } = await import('./guard');

  const loader = new ContractLoader();

  if (contractsPath) {
    await loader.loadContracts(contractsPath);
  }

  return new BoundaryGuard(loader, { contractsPath: contractsPath ?? '' });
}
