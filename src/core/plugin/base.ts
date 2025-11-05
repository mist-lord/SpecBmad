import { EventEmitter } from 'events';
import { Plugin } from '@/types';
import { log } from '@/utils/logger';

/**
 * 插件生命周期钩子
 */
export interface PluginHooks {
  beforeInit?: () => Promise<void> | void;
  afterInit?: () => Promise<void> | void;
  beforeDestroy?: () => Promise<void> | void;
  afterDestroy?: () => Promise<void> | void;
}

/**
 * 插件配置
 */
export interface PluginConfig {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  enabled?: boolean;
  settings?: Record<string, any>;
}

/**
 * 基础插件类
 */
export abstract class BasePlugin extends EventEmitter implements Plugin {
  public readonly name: string;
  public readonly version: string;
  public readonly description?: string;
  public readonly dependencies: string[];
  protected enabled: boolean;
  protected settings: Record<string, any>;
  protected initialized: boolean = false;

  constructor(config: PluginConfig) {
    super();
    this.name = config.name;
    this.version = config.version;
    if (config.description !== undefined) {
      this.description = config.description;
    }
    this.dependencies = config.dependencies || [];
    this.enabled = config.enabled !== false;
    this.settings = config.settings || {};
  }

  /**
   * 初始化插件
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      log.warn(`插件 ${this.name} 已经初始化`);
      return;
    }

    try {
      await this.onBeforeInit();
      await this.onInit();
      await this.onAfterInit();
      
      this.initialized = true;
      this.emit('initialized', { plugin: this.name });
      
      log.info(`插件 ${this.name} 初始化成功`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`插件 ${this.name} 初始化失败: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 销毁插件
   */
  async destroy(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await this.onBeforeDestroy();
      await this.onDestroy();
      await this.onAfterDestroy();
      
      this.initialized = false;
      this.removeAllListeners();
      this.emit('destroyed', { plugin: this.name });
      
      log.info(`插件 ${this.name} 销毁成功`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`插件 ${this.name} 销毁失败: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 启用插件
   */
  enable(): void {
    this.enabled = true;
    this.emit('enabled', { plugin: this.name });
    log.info(`插件 ${this.name} 已启用`);
  }

  /**
   * 禁用插件
   */
  disable(): void {
    this.enabled = false;
    this.emit('disabled', { plugin: this.name });
    log.info(`插件 ${this.name} 已禁用`);
  }

  /**
   * 检查插件是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 检查插件是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取插件设置
   */
  getSetting<T = any>(key: string, defaultValue?: T): T | undefined {
    return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
  }

  /**
   * 设置插件配置
   */
  setSetting(key: string, value: any): void {
    this.settings[key] = value;
    this.emit('settingChanged', { plugin: this.name, key, value });
  }

  /**
   * 获取所有设置
   */
  getAllSettings(): Record<string, any> {
    return { ...this.settings };
  }

  /**
   * 更新设置
   */
  updateSettings(settings: Record<string, any>): void {
    this.settings = { ...this.settings, ...settings };
    this.emit('settingsUpdated', { plugin: this.name, settings: this.settings });
  }

  /**
   * 获取插件信息
   */
  getInfo(): { name: string; version: string; description?: string; enabled: boolean; initialized: boolean } {
    const info: { name: string; version: string; description?: string; enabled: boolean; initialized: boolean } = {
      name: this.name,
      version: this.version,
      enabled: this.enabled,
      initialized: this.initialized
    };
    
    if (this.description !== undefined) {
      info.description = this.description;
    }
    
    return info;
  }

  /**
   * 清理插件资源
   */
  async cleanup(): Promise<void> {
    await this.destroy();
  }

  // 抽象方法，由子类实现
  protected abstract onInit(): Promise<void> | void;
  protected abstract onDestroy(): Promise<void> | void;

  // 生命周期钩子，子类可以重写
  protected async onBeforeInit(): Promise<void> {}
  protected async onAfterInit(): Promise<void> {}
  protected async onBeforeDestroy(): Promise<void> {}
  protected async onAfterDestroy(): Promise<void> {}
}