#!/usr/bin/env node

// 配置模块别名
import 'module-alias/register';
import { addAlias } from 'module-alias';
import path from 'path';

// 设置路径别名
addAlias('@', path.join(__dirname));

import { Command, CommanderError } from 'commander';
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
import { workflowCommand } from '@/commands/workflow';
import { deployCommand } from '@/commands/deploy';
import { generateCommand } from '@/commands/generate';
import { runCommand } from '@/commands/run';
import { quickCommand } from '@/commands/quick';
import { constitutionCommand } from '@/commands/constitution';
import { pluginsCommand } from '@/commands/plugins';
import { goCommand } from '@/commands/go';
import { changeCommand } from '@/commands/change';
import { exportCommand } from '@/commands/export';
import { uiCommand } from '@/commands/ui';
import { doctorCommand } from '@/commands/doctor';
import { registerPhaseCommand } from '@/commands/phase';
import { registerBuiltInStacks } from '@/core/stack';

// 加载环境变量
config();

// 注册内置技术栈
registerBuiltInStacks();

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
  .argument('[project-name]', '项目名称')
  .option('-t, --template <name>', '使用指定项目模板')
  .option('-l, --language <lang>', '项目主要编程语言')
  .option('-f, --framework <fw>', '使用的开发框架')
  .option('-a, --agents <list>', '启用的AI代理列表')
  .option('--llm-provider <name>', '默认LLM提供商')
  .option('--wizard', '启动交互式向导')
  .option('-i, --interactive', '交互式配置模式 (旧版)')
  .action(initCommand);

program.addCommand(configCommand);
program.addCommand(pluginsCommand);

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

// 一键命令（简化使用流程）
program
  .command('go')
  .description('🚀 一键生成项目：从需求到代码的完整流程')
  .argument('<text>', '项目需求描述')
  .option('-r, --run', '生成后自动运行项目', false)
  .option('-v, --review', '开启人工审查模式 (在代码实现前暂停)', false)
  .option('-d, --deep', '开启深度开发模式 (复杂算法/科研复现)', false)
  .action((text, options) => {
    // 映射短参数到 goCommand 预期的长参数
    return goCommand(text, options);
  });

// 变更管理
program.addCommand(changeCommand);

// 导出与集成
program.addCommand(exportCommand);

// Web 仪表盘
program.addCommand(uiCommand);

// 系统诊断
program.addCommand(doctorCommand);

// Phase 管理命令
registerPhaseCommand(program);

// BMAD-Method 工作流命令
program.addCommand(analyzeCommand);
program.addCommand(planCommand);
program.addCommand(solutionCommand);
program.addCommand(bmmCommand);

// 汇总报告命令
program.addCommand(reportCommand);

// Spec-Kit 工作流命令
program.addCommand(constitutionCommand);
program
  .command('generate')
  .description('从需求生成完整项目与文档')
  .option('-i, --input <file>', '输入需求文件路径')
  .option('-s, --stack <name>', '生成栈 (ts-app|py-lib)', 'ts-app')
  .option('-t, --template <name>', '模板名称')
  .option('-o, --out <dir>', '项目输出目录')
  .option('-d, --doc-out <dir>', '文档输出目录')
  .option('--auto-implement', '自动实现关键模块')
  .option('--qa', '生成基础测试')
  .option('-F, --format <fmt>', '说明书格式 (markdown|json)', 'markdown')
  .option('--dry-run', '干跑模式，不落盘')
  .action(generateCommand);

program
  .command('run')
  .description('运行生成的程序')
  .option('-d, --dir <dir>', '项目目录', 'generated/project')
  .option('-s, --stack <name>', '生成栈 (ts-app|py-lib)', 'ts-app')
  .option('--python <bin>', 'Python 可执行文件名称', 'python')
  .action(async (opts) => { await runCommand(opts as any); });

program
  .command('quick')
  .description('一句话需求生成最小可运行Demo')
  .option('-t, --text <text>', '一句话需求文本')
  .option('-s, --stack <name>', '栈选择 (auto|ts-cli|ts-api|py-cli|ts-chat)', 'auto')
  .option('--auto-run', '生成后自动运行')
  .option('-o, --out <dir>', '项目输出目录', 'generated/project')
  .option('-d, --doc-out <dir>', '文档输出目录', 'docs')
  .option('--dry-run', '干跑模式，不落盘')
  .action(quickCommand);

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
  .option('-g, --goal <text>', '规划目标说明')
  .option('-o, --output <file>', '输出任务文件路径')
  .option('-a, --agent <name>', '指定执行代理')
  .option('-f, --format <fmt>', '输出格式 (markdown|json)', 'markdown')
  .option('-r, --report-dir <dir>', '指定报告目录，自动生成文件名')
  .action(tasksCommand);

program
  .command('implement')
  .description('执行代码实现')
  .option('-t, --task <id>', '指定任务ID')
  .option('-f, --file <path>', '指定实现文件')
  .option('-a, --agent <name>', '指定执行代理')
  .option('--review', '启用代码审查')
  .option('-o, --output <file>', '输出实现结果文件路径')
  .option('-r, --report-dir <dir>', '指定报告目录，自动生成文件名')
  .option('-F, --format <fmt>', '输出格式 (markdown|json)', 'markdown')
  .action(implementCommand);

program
  .command('qa')
  .description('执行质量保证检查')
  .option('-t, --type <type>', '检查类型 (unit|integration|e2e|security|performance)')
  .option('-f, --file <path>', '指定检查文件')
  .option('-a, --agent <name>', '指定执行代理')
  .option('--fix', '自动修复发现的问题')
  .option('-o, --output <file>', '输出检查结果文件路径')
  .option('-r, --report-dir <dir>', '指定报告目录，自动生成文件名')
  .option('-F, --format <fmt>', '输出格式 (markdown|json)', 'markdown')
  .action(qaCommand);



program
  .command('deploy')
  .description('部署到目标环境')
  .option('-e, --env <env>', '部署环境 (dev|staging|prod)', 'dev')
  .option('-s, --strategy <name>', '部署策略 (rolling|canary|blue-green)', 'rolling')
  .option('--dry-run', '干跑模式，仅生成计划不执行')
  .option('--rollback', '执行回滚到上一个稳定版本')
  .option('--build', '部署前执行构建')
  .option('--skip-tests', '跳过基础验证测试')
  .option('-t, --tag <name>', '发布版本标签')
  .option('-o, --output <file>', '输出计划文件路径')
  .option('-r, --report-dir <dir>', '指定报告目录，自动生成文件名')
  .option('-F, --format <fmt>', '输出格式 (json|markdown)', 'json')
  .action(deployCommand);

program
  .command('workflow')
  .description('运行预设工作流')
  .option('-n, --name <name>', '工作流名称 (planning-only|full-development)')
  .option('-o, --output <file>', '输出摘要文件')
  .option('-r, --report-dir <dir>', '指定报告目录，自动生成文件名')
  .option('--date-prefix', '在文件名添加日期时间前缀 (YYYYMMDD-HHmmss-)')
  .option('--dedupe', '避免覆盖：若重名则追加递增后缀 (-1, -2...)')
  .option('-f, --format <fmt>', '输出格式 (json|markdown|yaml)', 'json')
  .option('--resume', '从上次失败处恢复执行')
  .option('--resume-file <file>', '指定状态文件，默认 .bmad/workflow.state.json')
  .option('--auto-run', '工作流完成后自动运行生成程序')
  .option('--phase', '使用 Phase 驱动的工作流 (V2 架构)')
  .option('--start-phase <phase>', '起始 Phase (0-5)', (val) => parseInt(val, 10))
  .option('--end-phase <phase>', '结束 Phase (0-5)', (val) => parseInt(val, 10))
  .action(workflowCommand);

// 如果没有提供命令，显示帮助信息
if (!process.argv.slice(2).length) {
  console.log(chalk.cyan.bold('🚀 SpecKit-BMAD 整合项目'));
  console.log(chalk.gray('AI驱动的软件开发工作流工具\n'));
  program.outputHelp();
  process.exit(0);
}

// 错误处理
// 斜杠命令解析映射
const argv = process.argv.slice(2);
if (argv[0] && argv[0].startsWith('/speckit.')) {
  const map: Record<string, string> = {
    '/speckit.constitution': 'constitution',
    '/speckit.specify': 'specify',
    '/speckit.plan': 'plan',
    '/speckit.tasks': 'tasks',
    '/speckit.implement': 'implement',
  };
  const mapped = map[argv[0]];
  if (mapped) {
    process.argv.splice(2, 1, mapped);
  }
}

program.exitOverride();

program.parseAsync().catch((error) => {
  if (error instanceof CommanderError) {
    if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
      process.exit(0);
    }
    log.error(`命令执行失败: ${error.message}`);
    const options = program.opts();
    if (options['debug']) {
      log.debug(error.stack || '无堆栈信息');
    }
    process.exit(error.exitCode ?? 1);
  } else if (error instanceof Error) {
    log.error(`命令执行失败: ${error.message}`);
    const options = program.opts();
    if (options['debug']) {
      log.debug(error.stack || '无堆栈信息');
    }
    process.exit(1);
  } else {
    process.exit(1);
  }
});
