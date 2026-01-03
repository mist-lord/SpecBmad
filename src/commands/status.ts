import { log } from '@/utils/logger';
import { ProjectStatusManager } from '@/core/project/status';
import chalk from 'chalk';

interface StatusOptions {
  detailed?: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  try {
    const statusManager = new ProjectStatusManager();
    
    // 检查项目是否已初始化
    if (!statusManager.isInitialized()) {
      log.warn('项目尚未初始化。请运行 "speckit-bmad init" 初始化项目。');
      return;
    }

    const status = await statusManager.getStatus();

    if (options.detailed) {
      displayDetailedStatus(status);
    } else {
      displayBasicStatus(status);
    }
  } catch (error) {
    log.error(`状态查看失败: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * 显示基础状态信息
 */
function displayBasicStatus(status: Awaited<ReturnType<ProjectStatusManager['getStatus']>>): void {
  log.info(chalk.bold('\n📊 项目状态\n'));
  
  // 项目信息
  log.info(chalk.cyan('项目信息:'));
  log.info(`  项目: ${status.project.name || '未命名'}`);
  log.info(`  版本: ${status.project.version || '0.1.0'}`);
  log.info(`  状态: ${getStatusEmoji(status.health)} ${status.health}`);
  
  // 任务统计
  log.info(chalk.cyan('\n任务统计:'));
  log.info(`  总计: ${status.tasks.total}`);
  log.info(`  待处理: ${status.tasks.pending}`);
  log.info(`  进行中: ${status.tasks.inProgress}`);
  log.info(`  已完成: ${status.tasks.completed}`);
  if (status.tasks.blocked > 0) {
    log.warn(`  阻塞: ${status.tasks.blocked}`);
  }
  
  // 文件统计
  log.info(chalk.cyan('\n文件统计:'));
  log.info(`  规范文档: ${status.files.specifications.length}`);
  log.info(`  计划文档: ${status.files.plans.length}`);
  log.info(`  实现文件: ${status.files.implementations.length}`);
  log.info(`  测试文件: ${status.files.tests.length}`);
  
  // 代理状态
  log.info(chalk.cyan('\nAI 代理:'));
  log.info(`  可用: ${status.agents.available.length} 个`);
  if (status.agents.available.length > 0) {
    log.info(`    ${status.agents.available.join(', ')}`);
  }
  
  // 最后活动
  const lastActivity = new Date(status.lastActivity);
  const daysAgo = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
  log.info(chalk.cyan('\n最后活动:'));
  log.info(`  ${lastActivity.toLocaleString('zh-CN')} (${daysAgo} 天前)`);
  
  // 健康问题
  if (status.issues.length > 0) {
    log.warn(chalk.yellow('\n⚠️  注意事项:'));
    for (const issue of status.issues) {
      log.warn(`  - ${issue}`);
    }
  }
  
  log.info('');
}

/**
 * 显示详细状态信息
 */
function displayDetailedStatus(status: Awaited<ReturnType<ProjectStatusManager['getStatus']>>): void {
  displayBasicStatus(status);
  
  log.info(chalk.bold('\n📋 详细信息\n'));
  
  // 规范文档列表
  if (status.files.specifications.length > 0) {
    log.info(chalk.cyan('规范文档:'));
    for (const file of status.files.specifications) {
      log.info(`  - ${file}`);
    }
  }
  
  // 计划文档列表
  if (status.files.plans.length > 0) {
    log.info(chalk.cyan('\n计划文档:'));
    for (const file of status.files.plans) {
      log.info(`  - ${file}`);
    }
  }
  
  // 实现文件列表
  if (status.files.implementations.length > 0) {
    log.info(chalk.cyan('\n实现文件:'));
    for (const file of status.files.implementations) {
      log.info(`  - ${file}`);
    }
  }
  
  // 测试文件列表
  if (status.files.tests.length > 0) {
    log.info(chalk.cyan('\n测试文件:'));
    for (const file of status.files.tests) {
      log.info(`  - ${file}`);
    }
  }
  
  // 代理详细信息
  if (status.agents.available.length > 0) {
    log.info(chalk.cyan('\n可用代理详情:'));
    for (const agent of status.agents.available) {
      log.info(`  ✓ ${agent}`);
    }
  }
  
  log.info('');
}

/**
 * 获取状态对应的 emoji
 */
function getStatusEmoji(health: 'healthy' | 'warning' | 'error'): string {
  switch (health) {
    case 'healthy':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'error':
      return '❌';
    default:
      return '❓';
  }
}
