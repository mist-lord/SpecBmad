import { log } from '@/utils/logger';
import { PerfTracer } from '@/utils/perf';
import { handleError } from '@/utils/error';
import { ensureProjectInitialized, autoConfigureLLM } from '@/utils/auto-init';
import { workflowCommand } from './workflow';
<<<<<<< HEAD
import { PATHS, getRunPath } from '@/utils/paths';
=======
import { getRunPath } from '@/utils/paths';
>>>>>>> origin/main
import path from 'path';
import chalk from 'chalk';
import fs from 'fs';

interface GoOptions {
  run?: boolean;
  review?: boolean;
  deep?: boolean;
}

/**
 * 生成简单的 Slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-') // 保留中文和字母数字，其余转为 -
    .replace(/^-+|-+$/g, '') // 去除首尾 -
    .substring(0, 20); // 截取前 20 个字符
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
    await ensureProjectInitialized(true);
    
    // 2. 自动配置 LLM
    await autoConfigureLLM(true);

    // 3. 创建运行目录
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const runId = `${timestamp}-${slugify(text)}`;
    const runRoot = getRunPath(runId);
    const specsDir = path.join(runRoot, 'specs');
    const artifactsDir = path.join(runRoot, 'artifacts');
    const codeDir = path.join(runRoot, 'code');
    const logsDir = path.join(runRoot, 'logs');

    fs.mkdirSync(specsDir, { recursive: true });
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.mkdirSync(codeDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });

    log.info(`📁 创建运行目录: ${chalk.cyan(runRoot)}`);
    
    // 4. 保存需求到文件
    const requirementsPath = path.join(specsDir, 'requirements.md');
    fs.writeFileSync(requirementsPath, `# 项目需求\n\n${text}\n`, 'utf-8');
    log.debug(`需求已保存到: ${requirementsPath}`);
    
    // 5. 执行完整工作流
    const workflowName = options.deep ? 'deep-development' : 'full-development';
    
    if (options.review) {
      log.info(chalk.cyan(`📋 第一阶段：生成规格与计划 (${workflowName})...\n`));
      await workflowCommand({
        name: 'planning-only',
        format: 'markdown',
        reportDir: artifactsDir,
        runDir: runRoot,
      });

      log.info(chalk.yellow.bold('\n👀 请检查以下目录中的规格说明书：'));
      log.info(`   - ${specsDir}/`);
      log.info(`   - ${artifactsDir}/`);
      
      const inquirer = await import('inquirer');
      const { proceed } = await inquirer.default.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: '规格是否满意？确认后将开始代码实现',
        default: true
      }]);

      if (!proceed) {
        log.info(chalk.gray('已停止执行。你可以修改规格文件后运行 `speckit-bmad workflow --resume` 继续。'));
        return;
      }
      
      log.info(chalk.cyan(`\n🚀 第二阶段：开始代码实现 (${workflowName})...\n`));
      await workflowCommand({
        name: workflowName,
        format: 'markdown',
        reportDir: artifactsDir,
        runDir: runRoot,
        autoRun: options.run ?? false,
        resume: true
      });
    } else {
      log.info(chalk.cyan(`📋 执行完整开发工作流 (${workflowName})...\n`));
      await workflowCommand({
        name: workflowName,
        format: 'markdown',
        reportDir: artifactsDir,
        runDir: runRoot,
        autoRun: options.run ?? false,
        datePrefix: true,
        dedupe: true
      });
    }
    
    const sample = perf.end('go');
    log.success(chalk.green.bold(`\n✅ 项目生成完成！ (用时 ${sample.durationMs.toFixed(0)}ms)\n`));
    log.info(`📁 运行产物: ${chalk.cyan(runRoot)}`);
    log.info(`📁 生成代码: ${chalk.cyan(codeDir)}`);
    log.info(`📄 查看状态: ${chalk.cyan('speckit-bmad status')}\n`);
    
  } catch (error) {
    handleError(error, { command: 'go' });
    throw error;
  }
}

