import { Agent, LLMClient } from '@/types';
import { log } from '@/utils/logger';

/**
 * 代理工厂：负责注册与创建具体代理实例
 */
export class AgentFactory {
  private static registry: Map<string, new (llmClient: LLMClient) => Agent> = new Map();

  /**
   * 注册代理类型
   */
  public static register(type: string, agentClass: new (llmClient: LLMClient) => Agent): void {
    this.registry.set(type, agentClass);
    log.info(`已注册代理类型: ${type}`);
  }

  /**
   * 创建代理实例
   */
  public static create(type: string, llmClient: LLMClient): Agent {
    const AgentClass = this.registry.get(type);
    if (!AgentClass) {
      throw new Error(`未知代理类型: ${type}`);
    }
    return new AgentClass(llmClient);
  }

  /**
   * 获取已注册的代理类型列表
   */
  public static getAvailableAgents(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * 检查是否已注册指定代理类型
   */
  public static has(type: string): boolean {
    return this.registry.has(type);
  }

  /**
   * 清空注册表（测试与重置场景）
   */
  public static clear(): void {
    this.registry.clear();
  }
}