import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { log } from '@/utils/logger';
import { PhaseNumber, PhaseTransitionConfig, PhaseContext, PhaseResult, PhaseState, GateResult } from './types';
import { gateRegistry, GateCheckContext } from './gates';
import { EventStore, type Event as PhaseEvent } from '@/core/events/store';
import {
  CircuitBreaker,
  createCircuitBreaker,
  CircuitBreakerConfig,
} from '@/core/boundary/circuit-breaker';
import { CircuitState } from '@/core/boundary/types';

/**
 * Default circuit breaker configuration for PhaseController
 * - failureThreshold: 5 consecutive gate failures to open circuit
 * - resetTimeout: 60 seconds before attempting recovery
 * - halfOpenMaxAttempts: 3 successful transitions to close circuit
 */
const DEFAULT_PHASE_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
};

export class PhaseController {
  private currentPhase: PhaseNumber = 0;
  private transitionConfig: PhaseTransitionConfig | null = null;
  private stateFile: string;
  private eventStore: EventStore;
  private circuitBreaker: CircuitBreaker;

  constructor(
    projectRoot: string = process.cwd(),
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>
  ) {
    this.stateFile = path.join(projectRoot, '.specbmad', 'phase.state.json');
    this.loadState();
    this.loadTransitionConfig(projectRoot);
    this.eventStore = new EventStore(projectRoot);
    this.circuitBreaker = createCircuitBreaker({
      ...DEFAULT_PHASE_CIRCUIT_CONFIG,
      ...circuitBreakerConfig,
    });
  }

  private loadTransitionConfig(projectRoot: string): void {
    const configPath = path.join(projectRoot, 'spec', 'phase_transitions.yaml');
    
    if (!fs.existsSync(configPath)) {
      log.warn(`Phase 迁移配置文件不存在: ${configPath}，使用默认配置`);
      this.transitionConfig = this.getDefaultConfig();
      return;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      this.transitionConfig = yaml.parse(content) as PhaseTransitionConfig;
      log.info('已加载 Phase 迁移配置');
    } catch (error) {
      log.error(`加载 Phase 迁移配置失败: ${error instanceof Error ? error.message : String(error)}`);
      this.transitionConfig = this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): PhaseTransitionConfig {
    // 4-Phase MVP 配置
    return {
      phases: {
        0: { next: [1], gates: [] },      // Capture
        1: { next: [2], gates: [] },      // Design
        2: { next: [3], gates: [] },      // Build
        3: { next: [0, 2], gates: ['review_passed'] }  // Review (可回退)
      }
    };
  }

  private loadState(): void {
    if (!fs.existsSync(this.stateFile)) {
      this.currentPhase = 0;
      return;
    }

    try {
      const content = fs.readFileSync(this.stateFile, 'utf-8');
      const state = JSON.parse(content);
      this.currentPhase = state.currentPhase as PhaseNumber;
      log.info(`已加载 Phase 状态: Phase ${this.currentPhase}`);
    } catch (error) {
      log.warn(`加载 Phase 状态失败，使用默认 Phase 0: ${error instanceof Error ? error.message : String(error)}`);
      this.currentPhase = 0;
    }
  }

  private saveState(): void {
    const state: PhaseState = {
      currentPhase: this.currentPhase,
      lastTransition: new Date().toISOString(),
      gateHistory: []
    };

    const dir = path.dirname(this.stateFile);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf-8');
  }

  private logEvent(event: PhaseEvent): void {
    try {
      this.eventStore.appendEvent(event);
    } catch {
      // swallow logging errors to not affect core flow
    }
  }

  getCurrentPhase(): PhaseNumber {
    return this.currentPhase;
  }

  canTransitionTo(targetPhase: PhaseNumber): boolean {
    if (!this.transitionConfig) {
      log.error('Phase 迁移配置未加载');
      return false;
    }

    const currentConfig = this.transitionConfig.phases[this.currentPhase];
    if (!currentConfig) {
      log.error(`当前 Phase ${this.currentPhase} 的配置不存在`);
      return false;
    }

    return currentConfig.next.includes(targetPhase);
  }

  async checkGates(phase: PhaseNumber, context: PhaseContext): Promise<GateResult[]> {
    if (!this.transitionConfig) {
      return [];
    }

    const phaseConfig = this.transitionConfig.phases[phase];
    if (!phaseConfig || phaseConfig.gates.length === 0) {
      return [];
    }

    const gateContext: GateCheckContext = {
      phase,
      projectRoot: context.projectRoot,
      metadata: context.metadata
    };

    return await gateRegistry.checkGates(phaseConfig.gates, gateContext);
  }

  async transitionTo(targetPhase: PhaseNumber, context: PhaseContext): Promise<PhaseResult> {
    const currentPhase = this.currentPhase;
    const timestamp = new Date().toISOString();

    // Circuit breaker check - block transitions when system is unstable
    if (this.circuitBreaker.isOpen()) {
      const error = 'Circuit breaker is open - system unstable, phase transitions blocked';
      log.error(error);

      const event: PhaseEvent = {
        type: 'failure',
        phase: currentPhase,
        timestamp,
        error,
        context: {
          failureType: 'circuit_breaker_open',
          circuitState: this.circuitBreaker.getState(),
          currentPhase,
          targetPhase,
        },
      };
      this.logEvent(event);

      return {
        success: false,
        fromPhase: currentPhase,
        toPhase: targetPhase,
        gateResults: [],
        error,
        timestamp,
        circuitState: this.circuitBreaker.getState(),
      };
    }

    if (!this.canTransitionTo(targetPhase)) {
      const error = `不允许从 Phase ${currentPhase} 迁移到 Phase ${targetPhase}`;
      log.error(error);

      const event: PhaseEvent = {
        type: 'phase_transition',
        phase: currentPhase,
        status: 'failed',
        timestamp,
        actor: 'PhaseController',
        inputs: { fromPhase: currentPhase, toPhase: targetPhase },
        outputs: { gateResults: [] }
      };
      this.logEvent(event);

      return {
        success: false,
        fromPhase: currentPhase,
        toPhase: targetPhase,
        gateResults: [],
        error,
        timestamp
      };
    }

    const gateResults = await this.checkGates(targetPhase, context);

    const failedGates = gateResults.filter(r => !r.passed && r.blocking !== false);

    // 通用 Gate 失败处理
    if (failedGates.length > 0) {
      // Record failure for circuit breaker
      this.circuitBreaker.recordFailure();

      const error = `Gate 检查失败: ${failedGates.map(g => g.gateId).join(', ')}`;
      log.error(error);

      // Log circuit breaker state change if it opened
      if (this.circuitBreaker.isOpen()) {
        log.warn('Circuit breaker opened due to consecutive gate failures');
      }

      const event: PhaseEvent = {
        type: 'failure',
        phase: currentPhase,
        timestamp,
        error,
        context: {
          failureType: 'gate_check_failed',
          currentPhase,
          targetPhase,
          gateResults: failedGates as unknown as Record<string, unknown>[],
          circuitState: this.circuitBreaker.getState(),
        },
      };
      this.logEvent(event);

      return {
        success: false,
        fromPhase: currentPhase,
        toPhase: targetPhase,
        gateResults: failedGates,
        error,
        timestamp,
        circuitState: this.circuitBreaker.getState(),
      };
    }

    for (const gr of gateResults) {
      const event: PhaseEvent = {
        type: 'gate_check',
        gateId: gr.gateId,
        phase: targetPhase,
        status: gr.passed ? 'passed' : 'failed',
        timestamp,
        message: gr.message,
        details: gr as unknown as Record<string, unknown>
      };
      this.logEvent(event);
    }

    // Record success for circuit breaker recovery
    this.circuitBreaker.recordSuccess();

    this.currentPhase = targetPhase;
    this.saveState();

    log.info(`Phase 迁移成功: ${currentPhase} → ${targetPhase}`);

    const successEvent: PhaseEvent = {
      type: 'phase_transition',
      phase: targetPhase,
      status: 'passed',
      timestamp,
      actor: 'PhaseController',
      inputs: { fromPhase: currentPhase, toPhase: targetPhase },
      outputs: { gateResults: gateResults as unknown as Record<string, unknown> }
    };
    this.logEvent(successEvent);

    return {
      success: true,
      fromPhase: currentPhase,
      toPhase: targetPhase,
      gateResults,
      timestamp,
      circuitState: this.circuitBreaker.getState(),
    };
  }

  /**
   * Get the current circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  /**
   * Check if the circuit breaker is open (system unstable)
   */
  isCircuitOpen(): boolean {
    return this.circuitBreaker.isOpen();
  }

  /**
   * Reset the circuit breaker (for recovery/testing)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    log.info('Circuit breaker has been reset');
  }
}
