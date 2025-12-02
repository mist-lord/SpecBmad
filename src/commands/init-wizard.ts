import inquirer from 'inquirer';
import chalk from 'chalk';
import { log } from '@/utils/logger';
import { stackManager } from '@/core/stack';

export interface WizardResult {
  projectName: string;
  stack: string; // e.g., 'typescript', 'python', 'cpp'
  template: string; // e.g., 'ts-app', 'cpp-cli'
  features: string[];
  llmProvider: string;
}

export async function runInitWizard(defaultName?: string): Promise<WizardResult> {
  console.clear();
  console.log(chalk.cyan.bold(`
   _____                 _  ___ _   
  / ____|               | |/ (_) |  
 | (___  _ __   ___  ___| ' / _| |_ 
  \\___ \\| '_ \\ / _ \\/ __|  < | | __|
  ____) | |_) |  __/ (__| . \\| | |_ 
 |_____/| .__/ \\___|\\___|_|\\_\\_|\\__|
        | |                         
        |_|   SpecKit-BMAD 初始化向导
`));
  
  log.info('欢迎使用 SpecKit-BMAD！让我们开始配置您的新项目。\n');

  // 1. 项目基本信息
  const basic = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: '项目名称:',
      default: defaultName || 'my-awesome-project',
      validate: (input) => /^[a-z0-9\-_]+$/i.test(input) || '项目名称只能包含字母、数字、横线和下划线'
    },
    {
      type: 'list',
      name: 'projectType',
      message: '您想构建什么类型的项目?',
      choices: [
        { name: '命令行工具 (CLI) - 构建终端应用', value: 'cli' },
        { name: 'API 服务 (Backend) - 构建 REST/GraphQL API', value: 'api' },
        { name: '代码库 (Library) - 构建共享库', value: 'lib' },
        { name: '全栈应用 (Web App) - 前后端集成 (暂未完全支持)', value: 'web', disabled: 'Coming Soon' }
      ]
    }
  ]);

  // 2. 技术栈选择
  const stackChoices = stackManager.getRegisteredStacks().map(s => {
    const plugin = stackManager.getPlugin(s);
    return { name: plugin?.name || s, value: s };
  });

  const stack = await inquirer.prompt([
    {
      type: 'list',
      name: 'language',
      message: '选择编程语言:',
      choices: (_answers) => {
        // 根据项目类型推荐语言
        if (basic.projectType === 'cli') return ['typescript', 'python', 'cpp', 'go', 'rust'];
        if (basic.projectType === 'api') return ['typescript', 'python', 'go'];
        if (basic.projectType === 'lib') return ['typescript', 'python', 'cpp'];
        return stackChoices;
      },
      default: 'typescript'
    }
  ]);

  // 3. 详细配置 (根据栈和类型)
  // 这里简单映射，实际可以更复杂
  let template = 'ts-app';
  if (stack.language === 'typescript') {
    template = basic.projectType === 'cli' ? 'ts-cli' : (basic.projectType === 'api' ? 'ts-api' : 'ts-app');
  } else if (stack.language === 'python') {
    template = basic.projectType === 'cli' ? 'py-cli' : 'py-lib';
  } else if (stack.language === 'cpp') {
    template = basic.projectType === 'cli' ? 'cpp-cli' : 'cpp-app';
  }

  // 4. 其他配置
  const extras = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'features',
      message: '启用功能:',
      choices: [
        { name: 'Git 初始化', value: 'git', checked: true },
        { name: 'GitHub Actions (CI/CD)', value: 'github-actions' },
        { name: 'Docker 支持', value: 'docker' }
      ]
    },
    {
      type: 'list',
      name: 'llmProvider',
      message: '选择默认 LLM 提供商 (用于 AI 辅助开发):',
      choices: [
        { name: 'Anthropic (Claude)', value: 'claude' },
        { name: 'OpenAI (GPT-4)', value: 'openai' },
        { name: 'Mock (离线模式)', value: 'mock' }
      ],
      default: 'claude'
    }
  ]);

  return {
    projectName: basic.projectName,
    stack: stack.language,
    template,
    features: extras.features,
    llmProvider: extras.llmProvider
  };
}

