import { StackPlugin } from './interface';
import { log } from '@/utils/logger';

export class StackManager {
  private static instance: StackManager;
  private plugins: Map<string, StackPlugin> = new Map();

  private constructor() {}

  public static getInstance(): StackManager {
    if (!StackManager.instance) {
      StackManager.instance = new StackManager();
    }
    return StackManager.instance;
  }

  /**
   * 注册插件
   */
  public register(plugin: StackPlugin): void {
    if (this.plugins.has(plugin.name)) {
      log.warn(`Stack plugin '${plugin.name}' already registered, overwriting.`);
    }
    this.plugins.set(plugin.name, plugin);
    
    // 注册别名
    if (plugin.aliases) {
      for (const alias of plugin.aliases) {
        this.plugins.set(alias, plugin);
      }
    }
  }

  /**
   * 获取指定插件
   */
  public getPlugin(name: string): StackPlugin | undefined {
    return this.plugins.get(name.toLowerCase());
  }

  /**
   * 自动检测技术栈
   */
  public detectStack(cwd: string): StackPlugin | undefined {
    for (const plugin of this.plugins.values()) {
      // 避免重复检测（因为别名指向同一个对象）
      if (plugin.detect(cwd)) {
        return plugin;
      }
    }
    return undefined;
  }

  /**
   * 获取所有已注册的插件名称
   */
  public getRegisteredStacks(): string[] {
    // 使用 Set 去重（因为有别名）
    const stacks = new Set<string>();
    for (const plugin of this.plugins.values()) {
      stacks.add(plugin.name);
    }
    return Array.from(stacks);
  }
}

export const stackManager = StackManager.getInstance();

