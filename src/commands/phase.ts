/**
 * Phase 命令
 * 
 * 显示当前 Phase
 * 手动触发 Phase 迁移（需通过 Gate）
 * 查看 Phase 历史（从 Event Store）
 */

import { Command } from 'commander';
import { PhaseController } from '@/core/phase/controller';
import { EventStore, PhaseEvent } from '@/core/events/store';
import { log } from '@/utils/logger';
import { registerDefaultGates } from '@/core/phase/gates';
import { PhaseContext } from '@/core/phase/types';

export interface PhaseCommandOptions {
  show?: boolean;
  transition?: number;
  history?: boolean;
}

export async function phaseCommand(options: PhaseCommandOptions): Promise<void> {
  try {
    // 注册默认 Gate 检查器
    registerDefaultGates();

    const controller = new PhaseController();
    const eventStore = new EventStore();

    // 显示当前 Phase
    if (options.show !== false && !options.transition && !options.history) {
      const currentPhase = controller.getCurrentPhase();
      log.info(`当前 Phase: ${currentPhase}`);
      log.info(`Phase 说明:`);
      log.info(`  Phase 0: Intent Capture`);
      log.info(`  Phase 1: Formal Specification`);
      log.info(`  Phase 2: Architecture & Planning`);
      log.info(`  Phase 3: Implementation`);
      log.info(`  Phase 4: Verification`);
      log.info(`  Phase 5: Iteration / Evolution`);
      return;
    }

    // 手动触发 Phase 迁移
    if (options.transition !== undefined) {
      const targetPhase = options.transition as 0 | 1 | 2 | 3 | 4 | 5;
      const currentPhase = controller.getCurrentPhase();

      log.info(`尝试从 Phase ${currentPhase} 迁移到 Phase ${targetPhase}`);

      const context: PhaseContext = {
        projectRoot: process.cwd(),
        currentPhase,
        metadata: {
          triggeredBy: 'manual',
          timestamp: new Date().toISOString()
        }
      };

      const result = await controller.transitionTo(targetPhase, context);

      // 记录事件
      eventStore.appendEvent({
        type: 'phase_transition',
        phase: targetPhase,
        status: result.success ? 'passed' : 'failed',
        timestamp: result.timestamp,
        actor: 'phase-command',
        inputs: { fromPhase: currentPhase, toPhase: targetPhase },
        outputs: { gateResults: result.gateResults },
        notes: result.error
      });

      if (result.success) {
        log.success(`Phase 迁移成功: ${currentPhase} → ${targetPhase}`);
        if (result.gateResults.length > 0) {
          log.info(`Gate 检查结果:`);
          for (const gate of result.gateResults) {
            log.info(`  ${gate.gateId}: ${gate.passed ? '✅' : '❌'} ${gate.message || ''}`);
          }
        }
      } else {
        log.error(`Phase 迁移失败: ${result.error}`);
        if (result.gateResults.length > 0) {
          log.error(`Gate 检查结果:`);
          for (const gate of result.gateResults) {
            log.error(`  ${gate.gateId}: ${gate.passed ? '✅' : '❌'} ${gate.message || ''}`);
          }
        }
        process.exit(1);
      }
      return;
    }

    // 查看 Phase 历史
    if (options.history) {
      const currentPhase = controller.getCurrentPhase();
      const events = eventStore.queryEvents({ type: 'phase_transition' });

      log.info(`Phase 历史 (当前: Phase ${currentPhase}):`);
      if (events.length === 0) {
        log.info('  暂无历史记录');
      } else {
        for (const event of events.slice(-10)) { // 显示最近10条
          if (event.type === 'phase_transition') {
            const phaseEvent = event as PhaseEvent;
            const statusIcon = phaseEvent.status === 'passed' ? '✅' : '❌';
            log.info(`  ${statusIcon} ${phaseEvent.timestamp} - Phase ${phaseEvent.phase} (${phaseEvent.status})`);
            if (phaseEvent.notes) {
              log.info(`    备注: ${phaseEvent.notes}`);
            }
          }
        }
      }
      return;
    }
  } catch (error) {
    log.error(`Phase 命令执行失败: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

export function registerPhaseCommand(program: Command): void {
  program
    .command('phase')
    .description('管理 Phase（显示当前 Phase、触发迁移、查看历史）')
    .option('--show', '显示当前 Phase（默认）')
    .option('--transition <phase>', '迁移到指定 Phase (0-5)', (val) => parseInt(val, 10))
    .option('--history', '查看 Phase 历史')
    .action(async (options: PhaseCommandOptions) => {
      await phaseCommand(options);
    });
}

