/**
 * Gate 检查器
 * 
 * 统一 Gate 检查接口，支持 OpenSpec Gate、DeepCode Gate 等
 */

import { GateResult } from './types';
import { log } from '@/utils/logger';

export interface GateChecker {
  checkGate(gateId: string, context: GateCheckContext): Promise<GateResult>;
}

export interface GateCheckContext {
  phase: number;
  projectRoot: string;
  metadata?: Record<string, unknown>;
}

/**
 * Gate 检查器注册表
 */
class GateRegistry {
  private checkers: Map<string, GateChecker> = new Map();

  /**
   * 注册 Gate 检查器
   */
  register(gateId: string, checker: GateChecker): void {
    this.checkers.set(gateId, checker);
    log.debug(`注册 Gate 检查器: ${gateId}`);
  }

  /**
   * 获取 Gate 检查器
   */
  get(gateId: string): GateChecker | undefined {
    return this.checkers.get(gateId);
  }

  /**
   * 检查所有 Gate
   */
  async checkGates(gateIds: string[], context: GateCheckContext): Promise<GateResult[]> {
    const results: GateResult[] = [];

    for (const gateId of gateIds) {
      const checker = this.checkers.get(gateId);
      if (!checker) {
        log.warn(`未找到 Gate 检查器: ${gateId}`);
        results.push({
          gateId,
          passed: false,
          message: `Gate 检查器未注册: ${gateId}`
        });
        continue;
      }

      try {
        const result = await checker.checkGate(gateId, context);
        results.push(result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error(`Gate 检查失败: ${gateId} - ${msg}`);
        results.push({
          gateId,
          passed: false,
          message: `Gate 检查异常: ${msg}`
        });
      }
    }

    return results;
  }
}

export const gateRegistry = new GateRegistry();

// 延迟注册，避免循环依赖和 ESM 问题
export function registerDefaultGates(): void {
  // 延迟导入，避免在测试时触发 execa 导入问题
  Promise.all([
    import('@/core/spec/openspec'),
    import('@/core/verification/deepcode')
  ]).then(([openspecModule, deepcodeModule]) => {
    const { OpenSpecGateChecker } = openspecModule;
    const { DeepCodeGateChecker, VerificationGateChecker } = deepcodeModule;
    
    gateRegistry.register('openspec_passed', new OpenSpecGateChecker());
    gateRegistry.register('deepcode_passed', new DeepCodeGateChecker());
    gateRegistry.register('verification_passed', new VerificationGateChecker());
  }).catch((error) => {
    // 在测试环境中，如果导入失败，静默忽略
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Gate 检查器注册失败:', error);
    }
  });
}

