import { log } from '@/utils/logger';
import { PerfTracer } from '@/utils/perf';
import { handleError } from '@/utils/error';
import { ensureProjectInitialized, autoConfigureLLM } from '@/utils/auto-init';
import { workflowCommand } from './workflow';
import { PATHS } from '@/utils/paths';
import path from 'path';
import chalk from 'chalk';

interface GoOptions {
  autoRun?: boolean;
  format?: 'json' | 'markdown' | 'yaml';
  silent?: boolean;
}

/**
 * 一键命令：从需求到代码的完整流程
 * 
 * 使用示例:
 *   speckit-bmad go "创建一个待办事项应用"
 *   speckit-bmad go "构建一个 REST API 服务" --format markdown
 */
export async function goCommand(text: string, options: GoOptions = {}): Promise<void> {
  const perf = new PerfTracer();
  try {
    perf.start('go');
    
    if (!text || !text.trim()) {
      log.error('请提供项目需求描述');
      log.info('示例: speckit-bmad go "创建一个待办事项应用"');
      return;
    }
    
    log.info(chalk.cyan.bold('\n🚀 开始一键生成项目...\n'));
    log.info(`需求: ${chalk.yellow(text)}\n`);
    
    // 1. 自动初始化项目（如果需要）
    await ensureProjectInitialized(options.silent);
    
    // 2. 自动配置 LLM
    await autoConfigureLLM(options.silent);
    
    // 3. 保存需求到文件（可选）
    if (!options.silent) {
      const fs = await import('fs');
      const { getProjectPath } = await import('@/utils/paths');
      const requirementsPath = getProjectPath(`${PATHS.SPECIFICATIONS_DIR}/requirements.md`);
      fs.mkdirSync(path.dirname(requirementsPath), { recursive: true });
      fs.writeFileSync(requirementsPath, `# 项目需求\n\n${text}\n`, 'utf-8');
      log.debug(`需求已保存到: ${requirementsPath}`);
    }
    
    // 4. 执行完整工作流
    log.info(chalk.cyan('📋 执行完整开发工作流...\n'));
    
    await workflowCommand({
      name: 'full-development',
      format: options.format || 'markdown',
      reportDir: PATHS.ARTIFACTS_DIR,
      autoRun: options.autoRun ?? false,
      datePrefix: true,
      dedupe: true
    });
    
    const sample = perf.end('go');
    log.success(chalk.green.bold(`\n✅ 项目生成完成！ (用时 ${sample.durationMs.toFixed(0)}ms)\n`));
    log.info(`📁 查看产物: ${chalk.cyan(PATHS.ARTIFACTS_DIR)}`);
    log.info(`📄 查看状态: ${chalk.cyan('speckit-bmad status')}\n`);
    
  } catch (error) {
    handleError(error, { command: 'go' });
    throw error;
  }
}

