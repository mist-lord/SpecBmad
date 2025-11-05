import { LLMClient, AgentType } from '@/types';
import { LLMClientFactory } from './base';
import { createClaudeClient } from './claude';
import { getProjectConfig, ConfigManager } from '@/utils/config';
import { log } from '@/utils/logger';

/**
 * LLM管理器
 * 负责初始化、管理和协调所有LLM客户端
 */
export class LLMManager {
  private static instance: LLMManager;
  private initialized = false;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): LLMManager {
    if (!LLMManager.instance) {
      LLMManager.instance = new LLMManager();
    }
    return LLMManager.instance;
  }

  /**
   * 初始化LLM管理器
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      log.info('正在初始化 LLM 管理器...');

      // 加载配置
      const configManager = new ConfigManager();
      const projectConfig = configManager.load();
      
      // 初始化默认客户端
      await this.initializeDefaultClients();
      
      // 从配置中初始化自定义客户端
      if (projectConfig.agents) {
        await this.initializeConfiguredClients(projectConfig.agents);
      }

      this.initialized = true;
      log.success('LLM 管理器初始化完成');
    } catch (error) {
      log.error(`LLM 管理器初始化失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 获取客户端
   */
  public getClient(name: string): LLMClient | undefined {
    return LLMClientFactory.get(name);
  }

  /**
   * 获取默认客户端
   */
  public getDefaultClient(): LLMClient | undefined {
    const projectConfig = getProjectConfig();
    const defaultAgentName = projectConfig.spec_kit?.ai_agent || 'Claude';
    return this.getClient(defaultAgentName);
  }

  /**
   * 获取所有可用客户端
   */
  public async getAvailableClients(): Promise<LLMClient[]> {
    return await LLMClientFactory.getAvailable();
  }

  /**
   * 按类型获取客户端
   */
  public getClientsByType(type: AgentType): LLMClient[] {
    return LLMClientFactory.getByType(type);
  }

  /**
   * 检查客户端是否存在
   */
  public hasClient(name: string): boolean {
    return LLMClientFactory.get(name) !== undefined;
  }

  /**
   * 添加客户端
   */
  public addClient(client: LLMClient): void {
    LLMClientFactory.register(client);
  }

  /**
   * 获取客户端状态
   */
  public async getClientStatus(): Promise<Array<{
    name: string;
    type: AgentType;
    available: boolean;
    error?: string;
  }>> {
    const clients = LLMClientFactory.getAll();
    const status = [];

    for (const client of clients) {
      try {
        const available = await client.isAvailable();
        status.push({
          name: client.name,
          type: client.type,
          available
        });
      } catch (error) {
        status.push({
          name: client.name,
          type: client.type,
          available: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return status;
  }

  /**
   * 初始化默认客户端
   */
  private async initializeDefaultClients(): Promise<void> {
    // 初始化Claude客户端
    const claudeApiKey = process.env['ANTHROPIC_API_KEY'];
    if (claudeApiKey) {
      const claudeClient = createClaudeClient({
        apiKey: claudeApiKey
      });
      LLMClientFactory.register(claudeClient);
      log.info('已注册 Claude 客户端');
    } else {
      log.warn('未找到 ANTHROPIC_API_KEY 环境变量，Claude 客户端将不可用');
    }

    // TODO: 添加其他默认客户端（OpenAI等）
  }

  /**
   * 从配置初始化客户端
   */
  private async initializeConfiguredClients(agentsConfig: Record<string, any>): Promise<void> {
    for (const [name, agentConfig] of Object.entries(agentsConfig)) {
      try {
        if (!agentConfig.enabled) {
          continue;
        }

        switch (agentConfig.type) {
          case 'claude':
            if (!this.hasClient(name)) {
              const client = createClaudeClient({
                apiKey: agentConfig.apiKey,
                baseUrl: agentConfig.baseUrl,
                defaultModel: agentConfig.model
              });
              // 重命名客户端
              (client as any).name = name;
              LLMClientFactory.register(client);
              log.info(`已注册配置的 Claude 客户端: ${name}`);
            }
            break;
          
          // TODO: 添加其他客户端类型的支持
          default:
            log.warn(`不支持的代理类型: ${agentConfig.type}`);
        }
      } catch (error) {
        log.error(`初始化客户端 ${name} 失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * 重置管理器
   */
  public reset(): void {
    LLMClientFactory.clear();
    this.initialized = false;
  }
}

// 导出单例实例
export const llmManager = LLMManager.getInstance();