import { log } from '@/utils/logger';
import chalk from 'chalk';
import { ConfigManager } from '@/utils/config';
import { validateInitArgs } from '@/utils/args-validator';
import { PerfTracer } from '@/utils/perf';
import { handleError } from '@/utils/error';
import { runInitWizard } from './init-wizard';
import { generateByStack } from '@/generator';
import path from 'path';

interface InitOptions {
  template?: string;
  language?: string;
  framework?: string;
  agents?: string;
  llmProvider?: string;
  interactive?: boolean;
  wizard?: boolean;
}

export async function initCommand(projectName: string | undefined, options: InitOptions): Promise<void> {
  const perf = new PerfTracer();
  try {
    perf.start('init');

    // 如果指定了 --wizard 或没有提供任何参数，进入向导模式
    if (options.wizard || (!projectName && !options.interactive)) {
      const wizardResult = await runInitWizard(projectName);
      
      // 应用向导结果
      projectName = wizardResult.projectName;
      options.language = wizardResult.stack;
      options.template = wizardResult.template;
      options.llmProvider = wizardResult.llmProvider;
      // features 目前主要影响 generator，这里暂不传递，后续支持
    }

    // 确保有项目名称
    if (!projectName) {
      log.error('必须指定项目名称');
      return;
    }

    log.info(`开始初始化项目: ${chalk.cyan(projectName)}`);

    // 交互式配置 (旧版逻辑，保留用于特定场景)
    if (options.interactive && !options.wizard) {
      log.info('启动交互式配置模式...');
      const { default: inquirer } = await import('inquirer');
      const answers = await inquirer.prompt([
        { type: 'list', name: 'template', message: '项目模板', choices: ['default', 'web-basic', 'mobile-basic', 'api-service'], default: options.template || 'default' },
        { type: 'list', name: 'language', message: '主要语言', choices: ['typescript', 'javascript', 'python', 'go', 'rust', 'cpp'], default: options.language || 'typescript' },
        { type: 'list', name: 'framework', message: '开发框架', choices: ['react', 'vue', 'svelte', 'nextjs', 'nest', 'express'], default: options.framework || 'react' },
        { type: 'checkbox', name: 'agents', message: '启用AI代理', choices: ['Architect', 'Developer', 'QA', 'ScrumMaster'], default: (options.agents ? options.agents.split(',').map(s=>s.trim()) : ['Architect','Developer','QA']) },
        { type: 'list', name: 'llmProvider', message: '默认LLM提供商', choices: ['openai', 'anthropic', 'claude', 'ollama'], default: options.llmProvider || 'claude' }
      ]);
      options = { ...options, ...answers, agents: Array.isArray(answers.agents) ? answers.agents.join(',') : options.agents };
    }

    // 参数验证
    const result = validateInitArgs(projectName, options);
    if (!result.valid) {
      for (const e of result.errors) log.error(e);
      return;
    }
    for (const w of result.warnings) log.warn(w);

    // 1. 生成项目骨架 (如果有对应栈的支持)
    if (options.language) {
      const cwd = process.cwd();
      const projectDir = path.join(cwd, projectName);
      
      log.info(`正在生成项目骨架 (${options.language})...`);
      await generateByStack({
        stack: options.language,
        projectDir,
        projectName,
        template: options.template
      });
    }

    // 2. 初始化配置写入
    const cfg = new ConfigManager();
    // 注意：这里应该写入到新项目的目录中，目前 ConfigManager 可能默认写到 cwd
    // 为了简单起见，我们假设用户已经 cd 到目录或者 ConfigManager 支持路径
    // 现在的实现中，ConfigManager 默认读取 cwd/.specbmad/config.json
    // 我们可能需要先切目录，或者让 ConfigManager 支持指定根目录
    // 暂时保持原样，这可能需要在后续改进 ConfigManager

    cfg.save({
      projectName,
      language: options.language || 'typescript',
      framework: options.framework || 'react',
      spec_kit: { enabled: true, ai_agent: (options.llmProvider || 'claude') },
      bmad_method: { enabled: true, active_modules: ['bmm'], workflow_mode: 'standard' },
      integration: { workflow_mode: 'hybrid', output_format: 'markdown', bridge_mode: 'subprocess' }
    });

    log.info(`项目模板: ${options.template || '默认'}`);
    log.info(`编程语言: ${options.language || '自动检测'}`);
    log.info(`开发框架: ${options.framework || '无'}`);
    log.info(`AI代理: ${options.agents || '默认代理集'}`);
    log.info(`LLM提供商: ${options.llmProvider || '默认'}`);

    const sample = perf.end('init');
    log.success(`项目 ${projectName} 初始化完成！ (用时 ${sample.durationMs.toFixed(0)}ms)`);
    
    // 提示后续步骤
    console.log('\n下一步:');
    console.log(chalk.cyan(`  cd ${projectName}`));
    console.log(chalk.cyan(`  npm install`)); // 或者根据语言提示不同的命令
    console.log(chalk.cyan(`  speckit-bmad go "实现一个简单的功能"`));

  } catch (error) {
    handleError(error, { command: 'init' });
    throw error;
  }
}
