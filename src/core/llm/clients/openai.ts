import { BaseLLMClient } from '../base';
import { LLMOptions, AgentType } from '@/types';
import { log } from '@/utils/logger';

/**
 * OpenAI LLM 客户端实现
 */
export class OpenAILLMClient extends BaseLLMClient {
  private readonly defaultApiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly modelsApiUrl = 'https://api.openai.com/v1/models';

  constructor(config?: {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
  }) {
    super('OpenAI', AgentType.OPENAI, {
      ...config,
      defaultModel: config?.defaultModel || 'gpt-4o-mini'
    });
  }

  /**
   * 检查OpenAI客户端是否可用
   */
  public async isAvailable(): Promise<boolean> {
    try {
      this.validateConfig();
      const url = this.baseUrl || this.modelsApiUrl;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey!}`
        }
      });
      return response.ok;
    } catch (error) {
      log.debug(`OpenAI 客户端不可用: ${error}`);
      return false;
    }
  }

  /**
   * 生成文本
   */
  public async generateText(prompt: string, options?: LLMOptions): Promise<string> {
    try {
      this.validateConfig();
      this.logApiCall('generateText', prompt, options);

      const requestOptions = this.buildRequestOptions(options);

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

      // 添加系统提示
      if (requestOptions.systemPrompt) {
        messages.push({ role: 'system', content: requestOptions.systemPrompt });
      }

      // 添加上下文
      if (requestOptions.context.length > 0) {
        for (const ctx of requestOptions.context) {
          messages.push({ role: 'user', content: ctx });
        }
      }

      // 主用户提示
      messages.push({ role: 'user', content: prompt });

      const body = {
        model: requestOptions.model || this.defaultModel || 'gpt-4o-mini',
        messages,
        max_tokens: requestOptions.maxTokens,
        temperature: requestOptions.temperature
      } as any;

      const response = await this.makeRequest(body);
      if (!response.ok) {
        const err = await safeJson(response);
        throw new Error(`API请求失败: ${response.status} ${response.statusText}${err?.error?.message ? ` - ${err.error.message}` : ''}`);
      }

      const data = await response.json() as any;
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content) {
        throw new Error('API响应为空或格式不正确');
      }
      return content;
    } catch (error) {
      this.handleError(error, '文本生成');
    }
  }

  /**
   * 生成结构化数据
   */
  public async generateStructured<T>(prompt: string, schema: any, options?: LLMOptions): Promise<T> {
    try {
      const structuredPrompt = `\n${prompt}\n\n请按照以下JSON Schema格式返回结果：\n${JSON.stringify(schema, null, 2)}\n\n重要：只返回有效的JSON，不要包含任何其他文本或解释。`;
      const response = await this.generateText(structuredPrompt, options);

      // 尝试解析JSON
      try {
        return JSON.parse(response.trim());
      } catch (parseError) {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error(`无法解析JSON响应: ${parseError}`);
      }
    } catch (error) {
      this.handleError(error, '结构化数据生成');
    }
  }

  /**
   * 发送API请求
   */
  private async makeRequest(body: any): Promise<Response> {
    const url = this.baseUrl || this.defaultApiUrl;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey!}`
      },
      body: JSON.stringify(body)
    });
  }
}

async function safeJson(response: Response): Promise<any | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * 创建OpenAI客户端实例
 */
export function createOpenAIClient(config?: {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}): OpenAILLMClient {
  return new OpenAILLMClient(config);
}