import { EventEmitter } from 'events';
import { BasePlugin, PluginConfig } from './base';
import { log } from '@/utils/logger';

/**
 * 插件管理器
 */
export class PluginManager extends EventEmitter {
  private plugins: Map<string, BasePlugin> = new Map();
  private pluginConfigs: Map<string, PluginConfig> = new Map();

  constructor() {
    super();
  }

  /**
   * 注册插件配置
   */
  registerPlugin(config: PluginConfig, pluginClass: new (config: PluginConfig) => BasePlugin): void {
    this.pluginConfigs.set(config.name, config);
    
    // 创建插件实例
    const plugin = new pluginClass(config);
    this.plugins.set(config.name, plugin);
    
    // 设置事件监听
    this.setupPluginListeners(plugin);
    
    log.debug(`注册插件: ${config.name}`);
  }

  /**
   * 初始化插件
   */
  async initializePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`插件不存在: ${name}`);
    }

    if (!plugin.isEnabled()) {
      log.warn(`插件 ${name} 未启用，跳过初始化`);
      return;
    }

    await plugin.initialize();
  }

  /**
   * 初始化所有插件
   */
  async initializeAll(): Promise<void> {
    const plugins = Array.from(this.plugins.values());
    
    // 按依赖关系排序
    const sortedPlugins = this.sortPluginsByDependencies(plugins);
    
    for (const plugin of sortedPlugins) {
      if (plugin.isEnabled()) {
        try {
          await plugin.initialize();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error(`初始化插件 ${plugin.name} 失败: ${errorMessage}`);
          // 继续初始化其他插件
        }
      }
    }
  }

  /**
   * 销毁插件
   */
  async destroyPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`插件不存在: ${name}`);
    }

    await plugin.destroy();
  }

  /**
   * 销毁所有插件
   */
  async destroyAll(): Promise<void> {
    const plugins = Array.from(this.plugins.values());
    
    // 反向销毁（与初始化顺序相反）
    const sortedPlugins = this.sortPluginsByDependencies(plugins).reverse();
    
    for (const plugin of sortedPlugins) {
      if (plugin.isInitialized()) {
        try {
          await plugin.destroy();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error(`销毁插件 ${plugin.name} 失败: ${errorMessage}`);
        }
      }
    }
  }

  /**
   * 启用插件
   */
  enablePlugin(name: string): void {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`插件不存在: ${name}`);
    }

    plugin.enable();
  }

  /**
   * 禁用插件
   */
  disablePlugin(name: string): void {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`插件不存在: ${name}`);
    }

    plugin.disable();
  }

  /**
   * 获取插件
   */
  getPlugin(name: string): BasePlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): BasePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取启用的插件
   */
  getEnabledPlugins(): BasePlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.isEnabled());
  }

  /**
   * 获取已初始化的插件
   */
  getInitializedPlugins(): BasePlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.isInitialized());
  }

  /**
   * 检查插件是否存在
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * 移除插件
   */
  async removePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return;
    }

    // 先销毁插件
    if (plugin.isInitialized()) {
      await plugin.destroy();
    }

    // 移除事件监听
    plugin.removeAllListeners();
    
    // 从管理器中移除
    this.plugins.delete(name);
    this.pluginConfigs.delete(name);
    
    log.info(`移除插件: ${name}`);
  }

  /**
   * 清理所有插件
   */
  async cleanup(): Promise<void> {
    await this.destroyAll();
    
    for (const plugin of this.plugins.values()) {
      plugin.removeAllListeners();
    }
    
    this.plugins.clear();
    this.pluginConfigs.clear();
  }

  /**
   * 按依赖关系排序插件
   */
  private sortPluginsByDependencies(plugins: BasePlugin[]): BasePlugin[] {
    const sorted: BasePlugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (plugin: BasePlugin): void => {
      if (visiting.has(plugin.name)) {
        throw new Error(`检测到循环依赖: ${plugin.name}`);
      }
      
      if (visited.has(plugin.name)) {
        return;
      }

      visiting.add(plugin.name);

      // 处理依赖
      for (const depName of plugin.dependencies) {
        const depPlugin = this.plugins.get(depName);
        if (depPlugin) {
          visit(depPlugin);
        } else {
          log.warn(`插件 ${plugin.name} 的依赖 ${depName} 不存在`);
        }
      }

      visiting.delete(plugin.name);
      visited.add(plugin.name);
      sorted.push(plugin);
    };

    for (const plugin of plugins) {
      if (!visited.has(plugin.name)) {
        visit(plugin);
      }
    }

    return sorted;
  }

  /**
   * 设置插件事件监听
   */
  private setupPluginListeners(plugin: BasePlugin): void {
    plugin.on('initialized', (data) => {
      this.emit('pluginInitialized', data);
    });

    plugin.on('destroyed', (data) => {
      this.emit('pluginDestroyed', data);
    });

    plugin.on('enabled', (data) => {
      this.emit('pluginEnabled', data);
    });

    plugin.on('disabled', (data) => {
      this.emit('pluginDisabled', data);
    });

    plugin.on('settingChanged', (data) => {
      this.emit('pluginSettingChanged', data);
    });

    plugin.on('settingsUpdated', (data) => {
      this.emit('pluginSettingsUpdated', data);
    });
  }
}

// 导出单例实例
export const pluginManager = new PluginManager();