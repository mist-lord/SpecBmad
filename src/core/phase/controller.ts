/**
 * Phase Controller
 * 
 * 管理 Phase 0-5 状态机，执行 Phase 迁移（需通过 Gate 检查），禁止跳跃式 Phase 切换
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { log } from '@/utils/logger';
import { PhaseNumber, PhaseTransitionConfig, PhaseContext, PhaseResult, GateResult, PhaseState } from './types';
import { gateRegistry, GateCheckContext } from './gates';
import { getProjectPath } from '@/utils/paths';
import { EventStore } from '../events/store';
 // 注意：registerDefaultGates 延迟导入，避免在测试时触发 execa 导入问题

 
 export class PhaseController {
  private currentPhase: PhaseNumber = 0;
  private transitionConfig: PhaseTransitionConfig | null = null;
  private stateFile: string;
  private eventStore!: EventStore;

  private logEvent(event: any) {
    try {
      (this.eventStore as any).appendEvent(event);
    } catch {
      // swallow logging errors to not affect core flow
    }
  }

  constructor(projectRoot: string = process.cwd()) {
    this.stateFile = path.join(projectRoot, '.specbmad', 'phase.state.json');
    this.loadState();
    this.loadTransitionConfig(projectRoot);
    this.eventStore = new EventStore(projectRoot);
  }

  /**
   * 加载 Phase 迁移配置
   */
  private loadTransitionConfig(projectRoot: string): void {
    const configPath = path.join(projectRoot, 'spec', 'phase_transitions.yaml');
    
    // 如果配置文件不存在，使用默认配置
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

  /**
   * 获取默认 Phase 迁移配置（按照冻结版规范）
   */
  private getDefaultConfig(): PhaseTransitionConfig {
    return {
      phases: {
        0: { next: [1], gates: [] },
        1: { next: [2], gates: ['openspec_passed'] },
        2: { next: [3], gates: [] },
        3: { next: [4], gates: ['deepcode_passed'] },
        4: { next: [5], gates: ['verification_passed'] },
        5: { next: [1, 3], gates: [] }
      }
    };
  }

  /**
   * 加载 Phase 状态
   */
  private loadState(): void {
    if (!fs.existsSync(this.stateFile)) {
      this.currentPhase = 0;
      return;
    }

    try {
      const content = fs.readFileSync(this.stateFile, 'utf-8');
      const state: PhaseState = JSON.parse(content);
      this.currentPhase = state.currentPhase as PhaseNumber;
      log.info(`已加载 Phase 状态: Phase ${this.currentPhase}`);
    } catch (error) {
      log.warn(`加载 Phase 状态失败，使用默认 Phase 0: ${error instanceof Error ? error.message : String(error)}`);
      this.currentPhase = 0;
    }
  }

  /**
   * 保存 Phase 状态
   */
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

  /**
   * 获取当前 Phase
   */
  getCurrentPhase(): PhaseNumber {
    return this.currentPhase;
  }

  /**
   * 检查是否可以迁移到目标 Phase
   */
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

  /**
   * 检查 Gate
   */
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

  /**
   * 迁移到目标 Phase
   */
  async transitionTo(targetPhase: PhaseNumber, context: PhaseContext): Promise<PhaseResult> {
    const fromPhase = this.currentPhase;
    const timestamp = new Date().toISOString();

    // 检查是否可以迁移
    if (!this.canTransitionTo(targetPhase)) {
      const error = `不允许从 Phase ${fromPhase} 迁移到 Phase ${targetPhase}`;
      log.error(error);
      return {
        success: false,
        fromPhase,
        toPhase: targetPhase,
        gateResults: [],
        error,
        timestamp
      };
    }

    // 检查 Gate（针对目标 Phase）
    const gateResults = await this.checkGates(targetPhase, context);

    // 检查是否有 Gate 失败
    const failedGates = gateResults.filter(r => !r.passed);
    if (failedGates.length > 0) {
      const error = `Gate 检查失败: ${failedGates.map(g => g.gateId).join(', ')}`;
      log.error(error);
      return {
        success: false,
        fromPhase,
        toPhase: targetPhase,
        gateResults,
        error,
        timestamp
      };
    }

    // 记录 Gate 事件
    for (const gr of gateResults) {
      const gateEvent: GateEvent = {
        type: 'gate_check',
        gateId: gr.gateId,
        phase: targetPhase,
        status: gr.passed ? 'passed' : 'failed',
        timestamp,
        message: gr.message,
        details: gr
      } as GateEvent;
      this.eventStore.appendEvent(gateEvent);
    }

    // 记录 Gate 事件
    for (const gr of gateResults) {
      const ge: any = {
        type: 'gate_check',
        gateId: gr.gateId,
        phase: targetPhase,
        status: gr.passed ? 'passed' : 'failed',
        timestamp,
        message: gr.message,
        details: gr
      };
      this.eventStore.appendEvent(ge as any);
    }

    // 执行迁移
    this.currentPhase = targetPhase;
    this.saveState();

    log.info(`Phase 迁移成功: ${fromPhase} → ${targetPhase}`);

    // 事件记录：Phase 迁移
    try { (this.eventStore as any).appendEvent({ type: 'phase_transition', phase: targetPhase, status: 'passed', timestamp, actor: 'PhaseController', inputs: { fromPhase, toPhase: targetPhase } } as any); } catch (e) { /* ignore logging failure in tests */ }

    return {
      success: true,
      fromPhase,
      toPhase: targetPhase,
      gateResults,
      timestamp
    };
  }
}

