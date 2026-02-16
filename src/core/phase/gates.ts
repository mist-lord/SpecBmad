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

// GateEvent is defined in ./types.ts - use import from there if needed
// Re-export for backward compatibility
export type { GateEvent } from './types';

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

/**
 * Review Gate 检查器
 *
 * 4-Phase MVP 中唯一的 Gate，检查 QA Review 是否通过
 */
class ReviewGateChecker implements GateChecker {
  async checkGate(gateId: string, context: GateCheckContext): Promise<GateResult> {
    // 检查是否存在 review_report.md 且标记为通过
    const fs = await import('fs');
    const path = await import('path');

    const reviewReportPath = path.join(
      context.projectRoot,
      '.specbmad',
      'artifacts',
      'review_report.md'
    );

    if (!fs.existsSync(reviewReportPath)) {
      return {
        gateId,
        passed: true,  // 没有 review report 时默认通过（首次运行）
        blocking: true,
        message: 'Review report 不存在，默认通过'
      };
    }

    try {
      const content = fs.readFileSync(reviewReportPath, 'utf-8');
      // 简单检查：如果报告包含 "PASSED" 或 "通过" 则通过
      const passed = /\b(PASSED|通过|approved)\b/i.test(content);

      return {
        gateId,
        passed,
        blocking: true,
        message: passed ? 'QA Review 通过' : 'QA Review 未通过，需要修复问题'
      };
    } catch (error) {
      return {
        gateId,
        passed: false,
        blocking: true,
        message: `读取 review report 失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

/**
 * 注册默认 Gate
 *
 * 4-Phase MVP 只需要一个 Gate: review_passed
 */
export async function registerDefaultGates(): Promise<void> {
  gateRegistry.register('review_passed', new ReviewGateChecker());
  log.debug('已注册 4-Phase MVP Gate: review_passed');
}

