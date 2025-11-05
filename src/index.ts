#!/usr/bin/env node

// 配置模块别名
import 'module-alias/register';
import { addAlias } from 'module-alias';
import path from 'path';

// 设置路径别名
addAlias('@', path.join(__dirname));

import { Command } from 'commander';
import chalk from 'chalk';
import { config } from 'dotenv';
import { log } from '@/utils/logger';
import { initCommand } from '@/commands/init';
import { configCommand } from '@/commands/config';
import { agentsCommand } from '@/commands/agents';
import { statusCommand } from '@/commands/status';
import { specifyCommand } from '@/commands/specify';
import { planCommand } from '@/commands/plan';
import { analyzeCommand } from '@/commands/analyze';
import { solutionCommand } from '@/commands/solution';
import { bmmCommand } from '@/commands/bmm';
import { tasksCommand } from '@/commands/tasks';
import { implementCommand } from '@/commands/implement';
import { qaCommand } from '@/commands/qa';
import { reportCommand } from '@/commands/report';

// 加载环境变量
config();

const program = new Command();

// 设置程序基本信息
program
  .name('speckit-bmad')
  .description('SpecKit-BMAD整合项目 - AI驱动的软件开发工作流工具')
  .version('0.1.0')
  .option('-v, --verbose', '启用详细输出')
  .option('--debug', '启用调试模式')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    if (options['debug']) {
      log.debug('调试模式已启用');
    } else if (options['verbose']) {
      log.info('详细输出模式已启用');
    }
  });

// 项目管理命令
program
  .command('init')
  .description('初始化新的SpecKit-BMAD项目')
  .argument('<project-name>', '项目名称')
  .option('-t, --template <name>', '使用指定项目模板')
  .option('-l, --language <lang>', '项目主要编程语言')
  .option('-f, --framework <fw>', '使用的开发框架')
  .option('-a, --agents <list>', '启用的AI代理列表')
  .option('--llm-provider <name>', '默认LLM提供商')
  .option('-i, --interactive', '交互式配置模式')
  .action(initCommand);

program.addCommand(configCommand);

program
  .command('agents')
  .description('管理AI代理')
  .option('-l, --list', '列出所有可用代理')
  .option('-s, --status', '查看代理状态')
  .option('-e, --enable <name>', '启用指定代理')
  .option('-d, --disable <name>', '禁用指定代理')
  .action(agentsCommand);

program
  .command('status')
  .description('查看项目状态')
  .option('-d, --detailed', '显示详细状态')
  .action(statusCommand);

// BMAD-Method 工作流命令
program.addCommand(analyzeCommand);
program.addCommand(planCommand);
program.addCommand(solutionCommand);
program.addCommand(bmmCommand);

// 汇总报告命令
program.addCommand(reportCommand);

// Spec-Kit 工作流命令
program
  .command('specify')
  .description('生成需求规格文档')
  .option('-i, --input <file>', '输入需求文件路径')
  .option('-o, --output <file>', '输出规格文件路径')
  .option('-a, --agent <name>', '指定执行代理')
  .option('-m, --model <name>', '指定使用的LLM模型')
  .option('-t, --template <name>', '使用的规格模板')
  .option('--interactive', '交互式需求收集')
  .option('--dry-run', '预览模式，不生成文件')
  .action(specifyCommand);

program
  .command('tasks')
  .description('拆解开发任务')
  .option('-i, --input <file>', '输入方案文件路径')
  .option('-o, --output <file>', '输出任务文件路径')
  .option('-a, --agent <name>', '指定执行代理')
  .option('--priority', '按优先级排序')
  .action(tasksCommand);

program
  .command('implement')
  .description('执行代码实现')
  .option('-t, --task <id>', '指定任务ID')
  .option('-f, --file <path>', '指定实现文件')
  .option('-a, --agent <name>', '指定执行代理')
  .option('--review', '启用代码审查')
  .action(implementCommand);

program
  .command('qa')
  .description('执行质量保证检查')
  .option('-t, --type <type>', '检查类型 (unit|integration|e2e|security|performance)')
  .option('-f, --file <path>', '指定检查文件')
  .option('-a, --agent <name>', '指定执行代理')
  .option('--fix', '自动修复发现的问题')
  .action(qaCommand);

// 如果没有提供命令，显示帮助信息
if (!process.argv.slice(2).length) {
  console.log(chalk.cyan.bold('🚀 SpecKit-BMAD 整合项目'));
  console.log(chalk.gray('AI驱动的软件开发工作流工具\n'));
  program.outputHelp();
  process.exit(0);
}

// 错误处理
program.exitOverride();

try {
  program.parse();
} catch (error) {
    if (error instanceof Error) {
      // 忽略 outputHelp 相关的错误，这是正常行为
      if (error.message.includes('outputHelp') || error.message.includes('help')) {
        process.exit(0);
      }
      log.error(`命令执行失败: ${error.message}`);
      const options = program.opts();
      if (options['debug']) {
        log.debug(error.stack || '无堆栈信息');
      }
    }
    process.exit(1);
  }