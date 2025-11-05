import { LLMClient, LLMOptions, AgentType } from '@/types';
import { log } from '@/utils/logger';

/**
 * 抽象LLM客户端基类
 */
export abstract class BaseLLMClient implements LLMClient {
  public readonly name: string;
  public readonly type: AgentType;
  protected apiKey?: string;
  protected baseUrl?: string;
  protected defaultModel?: string;

  constructor(name: string, type: AgentType, config?: {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
  }) {
    this.name = name;
    this.type = type;
    
    // 明确处理可选属性以符合 exactOptionalPropertyTypes
    if (config?.apiKey !== undefined) {
      this.apiKey = config.apiKey;
    }
    if (config?.baseUrl !== undefined) {
      this.baseUrl = config.baseUrl;
    }
    if (config?.defaultModel !== undefined) {
      this.defaultModel = config.defaultModel;
    }
  }

  /**
   * 检查客户端是否可用
   */
  public abstract isAvailable(): Promise<boolean>;

  /**
   * 生成文本
   */
  public abstract generateText(prompt: string, options?: LLMOptions): Promise<string>;

  /**
   * 生成结构化数据
   */
  public abstract generateStructured<T>(
    prompt: string, 
    schema: any, 
    options?: LLMOptions
  ): Promise<T>;

  /**
   * 验证配置
   */
  protected validateConfig(): void {
    if (!this.apiKey) {
      throw new Error(`${this.name} 客户端缺少 API Key`);
    }
  }

  /**
   * 处理API错误
   */
  protected handleError(error: any, context: string): never {
    const message = error?.message || String(error);
    log.error(`${this.name} ${context} 失败: ${message}`);
    throw new Error(`${this.name} ${context} 失败: ${message}`);
  }

  /**
   * 记录API调用
   */
  protected logApiCall(method: string, prompt: string, options?: LLMOptions): void {
    log.debug(`${this.name} API调用: ${method}`, {
      promptLength: prompt.length,
      model: options?.model || this.defaultModel,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens
    });
  }

  /**
   * 构建请求选项
   */
  protected buildRequestOptions(options?: LLMOptions): Required<LLMOptions> {
    return {
      model: options?.model || this.defaultModel || '',
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 2000,
      systemPrompt: options?.systemPrompt || '',
      context: options?.context || []
    };
  }
}

/**
 * LLM客户端工厂
 */
export class LLMClientFactory {
  private static clients = new Map<string, LLMClient>();

  /**
   * 注册客户端
   */
  public static register(client: LLMClient): void {
    this.clients.set(client.name, client);
    log.info(`已注册 LLM 客户端: ${client.name} (${client.type})`);
  }

  /**
   * 获取客户端
   */
  public static get(name: string): LLMClient | undefined {
    return this.clients.get(name);
  }

  /**
   * 获取所有客户端
   */
  public static getAll(): LLMClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * 获取可用的客户端
   */
  public static async getAvailable(): Promise<LLMClient[]> {
    const clients = this.getAll();
    const availableClients: LLMClient[] = [];

    for (const client of clients) {
      try {
        if (await client.isAvailable()) {
          availableClients.push(client);
        }
      } catch (error) {
        log.debug(`客户端 ${client.name} 不可用: ${error}`);
      }
    }

    return availableClients;
  }

  /**
   * 按类型获取客户端
   */
  public static getByType(type: AgentType): LLMClient[] {
    return this.getAll().filter(client => client.type === type);
  }

  /**
   * 清除所有客户端
   */
  public static clear(): void {
    this.clients.clear();
  }
}