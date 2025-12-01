import fs from 'fs';
import path from 'path';
import os from 'os';
import YAML from 'yaml';
import { log } from './logger';
import { PATHS, getProjectPath } from './paths';

export interface ProjectConfig {
  // 项目基础配置
  projectName?: string;
  version?: string;
  description?: string;
  
  // 项目类型和规模
  type?: 'web' | 'mobile' | 'game' | 'enterprise';
  scale_level?: 0 | 1 | 2 | 3 | 4;
  language?: string;
  framework?: string;
  
  // Spec-Kit 配置
  spec_kit?: {
    enabled: boolean;
    ai_agent?: string;
    templates_path?: string;
    constitution_file?: string;
  };
  
  // BMAD-Method 配置
  bmad_method?: {
    enabled: boolean;
    active_modules?: string[];
    agents_config?: string;
    workflow_mode?: 'standard' | 'accelerated';
  };
  
  // AI 代理配置
  agents?: {
    [key: string]: {
      type: string;
      model?: string;
      apiKey?: string;
      baseUrl?: string;
      enabled: boolean;
    };
  };
  
  // 工作流定义（可扩展）
  workflows?: {
    [name: string]: {
      description?: string;
      steps: Array<{
        id: string;
        name: string;
        agent: string;
        input?: Record<string, any>;
      }>;
    };
  };
  
  // 集成配置
  integration?: {
    workflow_mode?: 'hybrid' | 'spec_first' | 'bmad_first';
    output_format?: 'markdown' | 'yaml' | 'json';
    bridge_mode?: 'subprocess' | 'api' | 'direct';
  };
  
  // 输出与模板
  outputDir?: string;
  templatesDir?: string;
  
  // LLM 优化与缓存
  cacheDir?: string;
  llmCacheEnabled?: boolean;
  llmCacheTTLSeconds?: number;
  llmConcurrencyLimit?: number;
  
  // 日志配置
  logLevel?: string;
  logFile?: string;
  
  // 其他配置
  autoSave?: boolean;
  backupEnabled?: boolean;
}

class ConfigManager {
  private configPath: string;
  private altProjectConfigPath: string;
  private configPathYaml: string;
  private altProjectConfigPathYaml: string;
  private globalConfigPath: string;
  private globalConfigPathYaml: string;
  private config: ProjectConfig = {};

  constructor() {
    // 项目配置文件路径（兼容两种路径，使用路径常量）
    this.configPath = getProjectPath(PATHS.CONFIG_FILE_JSON);
    this.altProjectConfigPath = getProjectPath(PATHS.CONFIG_FILE_ALT_JSON);
    this.configPathYaml = getProjectPath(PATHS.CONFIG_FILE_YAML);
    this.altProjectConfigPathYaml = getProjectPath(PATHS.CONFIG_FILE_ALT_YAML);
    // 全局配置文件路径
    this.globalConfigPath = path.join(os.homedir(), '.specbmad', 'config.json');
    this.globalConfigPathYaml = path.join(os.homedir(), '.specbmad', 'config.yaml');
  }

  /**
   * 加载配置
   */
  public load(): ProjectConfig {
    try {
      // 先加载全局配置
      const globalConfig = this.loadGlobalConfig();
      
      // 再加载项目配置（支持两种路径）
      const projectConfig = this.loadProjectConfig();
      
      // 合并配置（项目配置优先）
      this.config = { ...globalConfig, ...projectConfig };
      
      return this.config;
    } catch (error) {
      log.error(`加载配置失败: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  }

  /**
   * 保存配置
   */
  public save(config: Partial<ProjectConfig>, global = false): void {
    try {
      let targetPath = global ? this.globalConfigPath : this.configPath;
      let useYaml = false;

      if (!global) {
        // 若存在新路径或其目录，优先写入新路径以实现路径统一
        const altDir = path.dirname(this.altProjectConfigPath);
        if (fs.existsSync(this.altProjectConfigPathYaml)) {
          targetPath = this.altProjectConfigPathYaml;
          useYaml = true;
        } else if (fs.existsSync(this.configPathYaml)) {
          targetPath = this.configPathYaml;
          useYaml = true;
        } else if (fs.existsSync(this.altProjectConfigPath) || fs.existsSync(altDir)) {
          targetPath = this.altProjectConfigPath;
        }
      } else {
        if (fs.existsSync(this.globalConfigPathYaml)) {
          targetPath = this.globalConfigPathYaml;
          useYaml = true;
        }
      }

      // 确保目录存在
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 读取现有配置
      let existingConfig: ProjectConfig = {};
      if (fs.existsSync(targetPath)) {
        const content = fs.readFileSync(targetPath, 'utf-8');
        existingConfig = targetPath.endsWith('.yaml') || targetPath.endsWith('.yml')
          ? (YAML.parse(content) || {})
          : JSON.parse(content);
      }

      // 合并配置
      const mergedConfig = { ...existingConfig, ...config };

      // 写入文件
      if (useYaml || targetPath.endsWith('.yaml') || targetPath.endsWith('.yml')) {
        const yamlText = YAML.stringify(mergedConfig);
        fs.writeFileSync(targetPath, yamlText, 'utf-8');
      } else {
        fs.writeFileSync(targetPath, JSON.stringify(mergedConfig, null, 2));
      }
      
      // 更新内存中的配置
      this.config = { ...this.config, ...config };
      
      log.success(`配置已保存到 ${global ? '全局' : '项目'} 配置文件`);
    } catch (error) {
      log.error(`保存配置失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 获取配置值
   */
  public get<K extends keyof ProjectConfig>(key: K): ProjectConfig[K] {
    return this.config[key];
  }

  /**
   * 设置配置值
   */
  public set<K extends keyof ProjectConfig>(key: K, value: ProjectConfig[K]): void {
    this.config[key] = value;
  }

  /**
   * 获取所有配置
   */
  public getAll(): ProjectConfig {
    return { ...this.config };
  }

  /**
   * 重置配置
   */
  public reset(global = false): void {
    try {
      if (global) {
        if (fs.existsSync(this.globalConfigPath)) {
          fs.unlinkSync(this.globalConfigPath);
          log.success('全局 配置已重置');
        }
        return;
      }

      // 项目级：同时尝试删除两种路径
      let removed = false;
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
        removed = true;
      }
      if (fs.existsSync(this.altProjectConfigPath)) {
        fs.unlinkSync(this.altProjectConfigPath);
        removed = true;
      }
      if (removed) {
        log.success('项目 配置已重置');
      }
      
      this.config = {};
    } catch (error) {
      log.error(`重置配置失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 检查配置文件是否存在
   */
  public exists(global = false): boolean {
    if (global) return fs.existsSync(this.globalConfigPath);
    return fs.existsSync(this.configPath) || fs.existsSync(this.altProjectConfigPath);
  }

  private loadGlobalConfig(): ProjectConfig {
    try {
      if (fs.existsSync(this.globalConfigPathYaml)) {
        const content = fs.readFileSync(this.globalConfigPathYaml, 'utf-8');
        return YAML.parse(content) || {};
      }
      if (fs.existsSync(this.globalConfigPath)) {
        const content = fs.readFileSync(this.globalConfigPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      log.debug(`加载全局配置失败: ${error instanceof Error ? error.message : String(error)}`);
    }
    return {};
  }

  private loadProjectConfig(): ProjectConfig {
    try {
      // 优先使用新路径 YAML /.specbmad/config.yaml
      if (fs.existsSync(this.altProjectConfigPathYaml)) {
        const content = fs.readFileSync(this.altProjectConfigPathYaml, 'utf-8');
        return YAML.parse(content) || {};
      }
      // 其次使用旧根路径 YAML /.specbmad.yaml
      if (fs.existsSync(this.configPathYaml)) {
        const content = fs.readFileSync(this.configPathYaml, 'utf-8');
        return YAML.parse(content) || {};
      }
      // 再使用新路径 JSON /.specbmad/config.json
      if (fs.existsSync(this.altProjectConfigPath)) {
        const content = fs.readFileSync(this.altProjectConfigPath, 'utf-8');
        return JSON.parse(content);
      }
      // 回退到旧路径 JSON /.specbmad.json
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      log.debug(`加载项目配置失败: ${error instanceof Error ? error.message : String(error)}`);
    }
    return {};
  }
}

// 导出ConfigManager类供测试使用
export { ConfigManager };

// 导出配置管理器实例
export const config = new ConfigManager();

// 便捷函数：获取项目配置
export function getProjectConfig(): ProjectConfig {
  return config.getAll();
}

// 便捷函数：获取特定配置项
export function getConfigValue<K extends keyof ProjectConfig>(key: K): ProjectConfig[K] {
  return config.get(key);
}

// 便捷函数：设置配置项
export function setConfigValue<K extends keyof ProjectConfig>(key: K, value: ProjectConfig[K]): void {
  config.set(key, value);
}

// 便捷函数：保存配置
export function saveConfig(configData: Partial<ProjectConfig>, global = false): void {
  config.save(configData, global);
}

// 导出默认配置
export const defaultConfig: ProjectConfig = {
  projectName: 'SpecKit-BMAD项目',
  version: '0.1.0',
  type: 'web',
  scale_level: 1,
  language: 'typescript',
  framework: 'react',
  
  spec_kit: {
    enabled: true,
    ai_agent: 'claude',
    templates_path: './templates',
    constitution_file: './constitution.md'
  },
  
  bmad_method: {
    enabled: true,
    active_modules: ['bmm'],
    agents_config: './bmad/_cfg/agents',
    workflow_mode: 'standard'
  },
  
  integration: {
    workflow_mode: 'hybrid',
    output_format: 'markdown',
    bridge_mode: 'subprocess'
  },
  
  agents: {
    Architect: {
      type: 'claude',
      model: 'claude-3-sonnet',
      enabled: true
    },
    Developer: {
      type: 'claude',
      model: 'claude-3-sonnet',
      enabled: true
    },
    QA: {
      type: 'claude',
      model: 'claude-3-sonnet',
      enabled: true
    }
  },
  outputDir: './output',
  templatesDir: './templates',
  
  // LLM 缓存默认启用
  cacheDir: PATHS.CACHE_DIR,
  llmCacheEnabled: true,
  llmCacheTTLSeconds: 3600,
  llmConcurrencyLimit: 4,
  
  logLevel: 'info',
  autoSave: true,
  backupEnabled: true
};
