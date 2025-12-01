import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager, ProjectConfig } from '@/utils/config';
import { ConfigValidator, ConfigMigrator } from '@/utils/config-validator';
import { log } from '@/utils/logger';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface ConfigOptions {
  get?: string;
  set?: string;
  value?: string;
  list?: boolean;
  validate?: boolean;
  migrate?: boolean;
  reset?: boolean;
  global?: boolean;
  interactive?: boolean;
}

export const configCommand = new Command('config')
  .description('管理项目配置')
  .option('-g, --get <key>', '获取配置值')
  .option('-s, --set <key>', '设置配置键')
  .option('-v, --value <value>', '配置值（与--set一起使用）')
  .option('-l, --list', '列出所有配置')
  .option('--validate', '验证配置')
  .option('--migrate', '迁移配置到最新版本')
  .option('--reset', '重置配置到默认值')
  .option('--global', '操作全局配置')
  .option('-i, --interactive', '交互式配置')
  .action(async (options: ConfigOptions) => {
    try {
      const configManager = new ConfigManager();

      if (options.interactive) {
        await runInteractiveConfig(configManager);
      } else if (options.get) {
        await getConfigValue(configManager, options.get);
      } else if (options.set && options.value !== undefined) {
        await setConfigValue(configManager, options.set, options.value, options.global);
      } else if (options.list) {
        await listConfig(configManager);
      } else if (options.validate) {
        await validateConfig(configManager);
      } else if (options.migrate) {
        await migrateConfig(configManager);
      } else if (options.reset) {
        await resetConfig(configManager, options.global);
      } else {
        // 默认显示当前配置
        await listConfig(configManager);
      }
    } catch (error) {
      log.error('配置命令执行失败:', error);
      process.exit(1);
    }
  });

configCommand
  .command('openai')
  .description('配置 OpenAI 密钥与端点')
  .option('--global', '写入全局配置')
  .option('--env', '生成 ~/.specbmad/env.sh 并加入 shell 配置')
  .option('--api-key <key>', 'OpenAI API Key')
  .option('--base-url <url>', 'OpenAI Base URL', 'https://openai.weavex.tech/v1/chat/completions')
  .option('--model <name>', '默认模型', 'gpt-4o-mini')
  .action(async (opts: any) => {
    const cm = new ConfigManager();
    let apiKey = opts.apiKey as string | undefined;
    let baseUrl = opts.baseUrl as string | undefined;
    let model = opts.model as string | undefined;
    if (!apiKey || !baseUrl || !model) {
      const { default: inquirer } = await import('inquirer');
      const ans = await inquirer.prompt([
        { type: 'password', name: 'apiKey', message: '请输入 OpenAI API Key:', mask: '*', when: () => !apiKey },
        { type: 'input', name: 'baseUrl', message: '请输入 Base URL:', default: 'https://openai.weavex.tech/v1/chat/completions', when: () => !baseUrl },
        { type: 'input', name: 'model', message: '默认模型:', default: 'gpt-4o-mini', when: () => !model }
      ]);
      apiKey = apiKey || ans.apiKey;
      baseUrl = baseUrl || ans.baseUrl;
      model = model || ans.model;
    }
    if (opts.env) {
      const dir = path.join(os.homedir(), '.specbmad');
      const file = path.join(dir, 'env.sh');
      fs.mkdirSync(dir, { recursive: true });
      const text = [
        `export OPENAI_API_KEY="${apiKey || ''}"`,
        `export OPENAI_BASE_URL="${baseUrl || ''}"`,
        `export OPENAI_MODEL="${model || 'gpt-4o-mini'}"`,
        `export BMAD_MOCK_LLM=0`
      ].join('\n') + '\n';
      fs.writeFileSync(file, text, 'utf-8');
      try { fs.chmodSync(file, 0o600); } catch {}
      const shellRc = process.env.SHELL && process.env.SHELL.includes('zsh') ? path.join(os.homedir(), '.zshrc') : path.join(os.homedir(), '.bashrc');
      try {
        const line = 'source ~/.specbmad/env.sh';
        const exists = fs.existsSync(shellRc) ? fs.readFileSync(shellRc, 'utf-8').includes(line) : false;
        if (!exists) fs.appendFileSync(shellRc, `\n# SpecBmad OpenAI env\n${line}\n`, 'utf-8');
      } catch {}
      console.log(chalk.green('✅ 已生成 ~/.specbmad/env.sh 并添加到 shell 初始化文件'));
      console.log(chalk.gray('当前会话可执行: source ~/.specbmad/env.sh'));
    }
    if (opts.global) {
      cm.save({
        agents: {
          OpenAI: {
            type: 'openai',
            enabled: true,
            baseUrl: baseUrl,
            model: model
          }
        },
        spec_kit: { enabled: true, ai_agent: 'OpenAI' }
      }, true);
      console.log(chalk.green('✅ 已写入全局配置 (不包含密钥)'));
    }
    if (!opts.env && !opts.global) {
      console.log(chalk.yellow('未指定 --env 或 --global；建议使用 --env 写入环境或 --global 写入全局配置'));
    }
  });

/**
 * 交互式配置
 */
async function runInteractiveConfig(configManager: ConfigManager): Promise<void> {
  console.log(chalk.blue('\n🔧 SpecKit-BMAD 交互式配置\n'));

  const currentConfig = configManager.load();

  const { default: inquirer } = await import('inquirer');
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: '项目名称:',
      default: currentConfig.projectName
    },
    {
      type: 'input',
      name: 'version',
      message: '项目版本:',
      default: currentConfig.version
    },
    {
      type: 'list',
      name: 'type',
      message: '项目类型:',
      choices: ['web', 'mobile', 'game', 'enterprise'],
      default: currentConfig.type
    },
    {
      type: 'list',
      name: 'scale_level',
      message: '项目规模级别:',
      choices: [
        { name: '0 - 原型/概念验证', value: 0 },
        { name: '1 - 小型项目', value: 1 },
        { name: '2 - 中型项目', value: 2 },
        { name: '3 - 大型项目', value: 3 },
        { name: '4 - 企业级项目', value: 4 }
      ],
      default: currentConfig.scale_level
    },
    {
      type: 'input',
      name: 'language',
      message: '主要编程语言:',
      default: currentConfig.language
    },
    {
      type: 'input',
      name: 'framework',
      message: '主要框架:',
      default: currentConfig.framework
    },
    {
      type: 'confirm',
      name: 'spec_kit_enabled',
      message: '启用 Spec-Kit?',
      default: currentConfig.spec_kit?.enabled !== false
    },
    {
      type: 'input',
      name: 'spec_kit_agent',
      message: 'Spec-Kit AI代理:',
      default: currentConfig.spec_kit?.ai_agent || 'claude',
      when: (answers) => answers.spec_kit_enabled
    },
    {
      type: 'confirm',
      name: 'bmad_method_enabled',
      message: '启用 BMAD-Method?',
      default: currentConfig.bmad_method?.enabled !== false
    },
    {
      type: 'checkbox',
      name: 'bmad_active_modules',
      message: 'BMAD-Method 活动模块:',
      choices: ['bmm', 'analysis', 'planning', 'solution'],
      default: currentConfig.bmad_method?.active_modules || ['bmm'],
      when: (answers) => answers.bmad_method_enabled
    },
    {
      type: 'list',
      name: 'integration_workflow_mode',
      message: '集成工作流模式:',
      choices: [
        { name: 'hybrid - 混合模式', value: 'hybrid' },
        { name: 'spec_first - Spec-Kit优先', value: 'spec_first' },
        { name: 'bmad_first - BMAD-Method优先', value: 'bmad_first' }
      ],
      default: currentConfig.integration?.workflow_mode || 'hybrid'
    }
  ]);

  // 构建新配置
  const newConfig: Partial<ProjectConfig> = {
    projectName: answers.projectName,
    version: answers.version,
    type: answers.type,
    scale_level: answers.scale_level,
    language: answers.language,
    framework: answers.framework,
    spec_kit: {
      enabled: answers.spec_kit_enabled,
      ai_agent: answers.spec_kit_agent
    },
    bmad_method: {
      enabled: answers.bmad_method_enabled,
      active_modules: answers.bmad_active_modules,
      workflow_mode: 'standard'
    },
    integration: {
      workflow_mode: answers.integration_workflow_mode,
      output_format: 'markdown',
      bridge_mode: 'subprocess'
    }
  };

  // 验证配置
  const validation = ConfigValidator.validate(newConfig as ProjectConfig);
  if (!validation.isValid) {
    console.log(chalk.red('\n❌ 配置验证失败:'));
    validation.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
    return;
  }

  if (validation.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  配置警告:'));
    validation.warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
  }

  // 保存配置
  configManager.save(newConfig);
  console.log(chalk.green('\n✅ 配置已保存'));
}

/**
 * 获取配置值
 */
async function getConfigValue(configManager: ConfigManager, key: string): Promise<void> {
  const config = configManager.load();
  const value = getNestedValue(config, key);
  
  if (value !== undefined) {
    console.log(chalk.green(`${key}: ${JSON.stringify(value, null, 2)}`));
  } else {
    console.log(chalk.red(`配置键 "${key}" 不存在`));
  }
}

/**
 * 设置配置值
 */
async function setConfigValue(configManager: ConfigManager, key: string, value: string, global = false): Promise<void> {
  try {
    // 尝试解析JSON值
    let parsedValue: any;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = value;
    }

    const config = configManager.load();
    setNestedValue(config, key, parsedValue);
    
    configManager.save(config, global);
    console.log(chalk.green(`✅ 已设置 ${key} = ${JSON.stringify(parsedValue)}`));
  } catch (error) {
    console.log(chalk.red(`❌ 设置配置失败: ${error instanceof Error ? error.message : String(error)}`));
  }
}

/**
 * 列出所有配置
 */
async function listConfig(configManager: ConfigManager): Promise<void> {
  const config = configManager.load();
  
  console.log(chalk.blue('\n📋 当前配置:\n'));
  console.log(JSON.stringify(config, null, 2));
}

/**
 * 验证配置
 */
async function validateConfig(configManager: ConfigManager): Promise<void> {
  const config = configManager.load();
  const validation = ConfigValidator.validate(config);

  console.log(chalk.blue('\n🔍 配置验证结果:\n'));

  if (validation.isValid) {
    console.log(chalk.green('✅ 配置验证通过'));
  } else {
    console.log(chalk.red('❌ 配置验证失败'));
    console.log(chalk.red('\n错误:'));
    validation.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
  }

  if (validation.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  警告:'));
    validation.warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
  }
}

/**
 * 迁移配置
 */
async function migrateConfig(configManager: ConfigManager): Promise<void> {
  const config = configManager.load();
  const migratedConfig = ConfigMigrator.migrate(config);
  
  configManager.save(migratedConfig);
  console.log(chalk.green('✅ 配置已迁移到最新版本'));
}

/**
 * 重置配置
 */
async function resetConfig(configManager: ConfigManager, global = false): Promise<void> {
  const { default: inquirer } = await import('inquirer');
  const confirm = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `确定要重置${global ? '全局' : '项目'}配置吗？这将删除所有自定义设置。`,
      default: false
    }
  ]);

  if (confirm.confirmed) {
    configManager.reset(global);
    console.log(chalk.green(`✅ ${global ? '全局' : '项目'}配置已重置`));
  } else {
    console.log(chalk.gray('操作已取消'));
  }
}

/**
 * 获取嵌套对象的值
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * 设置嵌套对象的值
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!(key in current)) {
      current[key] = {};
    }
    return current[key];
  }, obj);
  target[lastKey] = value;
}