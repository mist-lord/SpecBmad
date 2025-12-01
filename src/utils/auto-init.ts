import fs from 'fs';
import path from 'path';
import { log } from './logger';
import { ConfigManager } from './config';
import { ProjectStatusManager } from '@/core/project/status';
import { ConfigMigrator } from './config-migrator';
import { LEGACY_PATHS } from './paths';
import { PATHS, getProjectPath } from './paths';
import chalk from 'chalk';

import { stackManager } from '@/core/stack';

/**
 * 自动检测项目语言
 */
function detectLanguage(): string | null {
  const cwd = process.cwd();
  
  // 使用插件系统检测
  const plugin = stackManager.detectStack(cwd);
  if (plugin) {
    return plugin.name;
  }

  // 如果插件系统未检测到，尝试使用旧的检测逻辑作为后备（或直接返回 null）
  // 由于我们已经迁移了所有检测逻辑到插件中，这里可以直接返回 plugin.name 或 null
  
  // 检查 package.json
  const packageJsonPath = path.join(cwd, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      // ... (保留部分旧逻辑以防万一，或者完全信任插件)
      // 鉴于我们已经迁移了核心逻辑，这里我们可以简化
      if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) {
        return 'typescript';
      }
      return 'javascript';
    } catch {
      // 忽略
    }
  }

  return null;
}

/**
 * 自动检测项目框架
 */
function detectFramework(): string | null {
  const cwd = process.cwd();
  const packageJsonPath = path.join(cwd, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      // React
      if (deps.react) {
        if (deps.next) return 'nextjs';
        if (deps['react-native']) return 'react-native';
        return 'react';
      }
      
      // Vue
      if (deps.vue) {
        if (deps.nuxt) return 'nuxt';
        return 'vue';
      }
      
      // Svelte
      if (deps.svelte) {
        return 'svelte';
      }
      
      // NestJS
      if (deps['@nestjs/core']) {
        return 'nest';
      }
      
      // Express
      if (deps.express) {
        return 'express';
      }
    } catch {
      // 忽略解析错误
    }
  }
  
  return null;
}

/**
 * 自动检测项目类型
 */
function detectProjectType(): 'web' | 'mobile' | 'game' | 'enterprise' {
  const cwd = process.cwd();
  const packageJsonPath = path.join(cwd, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      // 移动应用
      if (deps['react-native'] || deps['@capacitor/core'] || deps['@ionic/core']) {
        return 'mobile';
      }
      
      // Web 应用
      if (deps.react || deps.vue || deps.svelte || deps.next || deps.nuxt) {
        return 'web';
      }
      
      // API 服务（归类为企业应用）
      if (deps.express || deps['@nestjs/core'] || deps.fastify || deps.koa) {
        return 'enterprise';
      }
    } catch {
      // 忽略解析错误
    }
  }
  
  // 检查是否有 bin 字段（CLI 工具，归类为企业应用）
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.bin) {
        return 'enterprise';
      }
    } catch {
      // 忽略解析错误
    }
  }
  
  return 'web'; // 默认
}

/**
 * 确保项目已初始化，如果未初始化则自动初始化
 */
export async function ensureProjectInitialized(silent: boolean = false): Promise<void> {
  const statusManager = new ProjectStatusManager();
  
  if (statusManager.isInitialized()) {
    if (!silent) {
      log.debug('项目已初始化');
    }
    return;
  }
  
  // 检查是否需要迁移旧配置
  if (ConfigMigrator.needsMigration()) {
    if (!silent) {
      log.info('🔄 检测到旧版本配置，正在自动迁移...');
    }
    try {
      ConfigMigrator.migrate(false); // false = 非干跑模式
      if (!silent) {
        log.success('✅ 配置迁移完成');
      }
      // 迁移后再次检查
      if (statusManager.isInitialized()) {
        return;
      }
    } catch (error) {
      log.warn(`配置迁移失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // 自动初始化
  if (!silent) {
    log.info(chalk.cyan('🔄 自动初始化项目...'));
  }
  
  await autoInit();
  
  if (!silent) {
    log.success('✅ 项目已自动初始化');
  }
}

/**
 * 自动初始化项目配置
 */
async function autoInit(): Promise<void> {
  const projectName = path.basename(process.cwd());
  
  // 自动检测
  const detected = {
    language: detectLanguage() || 'typescript',
    framework: detectFramework() || undefined,
    type: detectProjectType()
  };
  
  if (detected.language || detected.framework) {
    log.debug(`自动检测: 语言=${detected.language}, 框架=${detected.framework || '无'}, 类型=${detected.type}`);
  }
  
  // 保存配置
  const config = new ConfigManager();
  config.save({
    projectName,
    language: detected.language,
    framework: detected.framework,
    type: detected.type,
    scale_level: 1, // 默认中等规模
    spec_kit: {
      enabled: true,
      ai_agent: 'auto' // 自动选择
    },
    bmad_method: {
      enabled: true,
      active_modules: ['bmm'],
      workflow_mode: 'standard'
    },
    integration: {
      workflow_mode: 'hybrid',
      output_format: 'markdown',
      bridge_mode: 'direct' // 默认使用直接模式，无需 Python
    },
    cacheDir: PATHS.ARTIFACTS_DIR,
    llmCacheEnabled: true,
    autoSave: true
  });
  
  // 确保必要的目录存在
  const dirs = [
    PATHS.CONFIG_DIR,
    PATHS.ARTIFACTS_DIR,
    PATHS.SPECIFICATIONS_DIR
  ];
  
  for (const dir of dirs) {
    const fullPath = getProjectPath(dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}

/**
 * 自动配置 LLM，优先使用真实 LLM，否则使用 Mock
 */
export async function autoConfigureLLM(silent: boolean = false): Promise<void> {
  const { llmManager } = await import('@/core/llm/manager');
  
  try {
    await llmManager.initialize();
    
    // 检查可用的客户端
    const clientStatus = await llmManager.getClientStatus();
    const availableClients = clientStatus.filter(c => c.available && c.name !== 'Mock');
    
    if (availableClients.length > 0) {
      const client = availableClients[0];
      if (!silent) {
        log.info(`✅ 使用 LLM: ${chalk.cyan(client.name)}`);
      }
    } else {
      if (!silent) {
        log.info('💡 未检测到 LLM API Key，使用离线 Mock 模式');
        log.info('   提示：设置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY 可使用真实 AI');
      }
    }
  } catch (error) {
    if (!silent) {
      log.warn(`LLM 配置检查失败: ${error instanceof Error ? error.message : String(error)}`);
      log.info('💡 将使用离线 Mock 模式');
    }
  }
}

