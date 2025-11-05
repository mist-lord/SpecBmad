import { BaseLLMClient } from './base';
import { LLMOptions, AgentType } from '@/types';
import { log } from '@/utils/logger';

/**
 * Claude LLM客户端实现
 */
export class ClaudeLLMClient extends BaseLLMClient {
  private readonly defaultApiUrl = 'https://api.anthropic.com/v1/messages';

  constructor(config?: {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
  }) {
    super('Claude', AgentType.CLAUDE, {
      ...config,
      defaultModel: config?.defaultModel || 'claude-3-sonnet-20240229'
    });
  }

  /**
   * 检查Claude客户端是否可用
   */
  public async isAvailable(): Promise<boolean> {
    try {
      this.validateConfig();
      
      // 简单的健康检查 - 发送一个最小的请求
      const response = await this.makeRequest({
        model: this.defaultModel || 'claude-3-sonnet-20240229',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: 'Hi'
        }]
      });

      return response.ok;
    } catch (error) {
      log.debug(`Claude客户端不可用: ${error}`);
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
      
      const messages: any[] = [];
      
      // 添加上下文消息
      if (requestOptions.context.length > 0) {
        requestOptions.context.forEach(ctx => {
          messages.push({
            role: 'user',
            content: ctx
          });
        });
      }

      // 添加主要提示
      messages.push({
        role: 'user',
        content: prompt
      });

      const requestBody: any = {
        model: requestOptions.model,
        max_tokens: requestOptions.maxTokens,
        temperature: requestOptions.temperature,
        messages
      };

      // 添加系统提示
      if (requestOptions.systemPrompt) {
        requestBody.system = requestOptions.systemPrompt;
      }

      const response = await this.makeRequest(requestBody);
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      if (data.content && data.content[0] && data.content[0].text) {
        return data.content[0].text;
      }

      throw new Error('API响应格式不正确');
    } catch (error) {
      this.handleError(error, '文本生成');
    }
  }

  /**
   * 生成结构化数据
   */
  public async generateStructured<T>(
    prompt: string, 
    schema: any, 
    options?: LLMOptions
  ): Promise<T> {
    try {
      // 构建包含JSON Schema的提示
      const structuredPrompt = `
${prompt}

请按照以下JSON Schema格式返回结果：
${JSON.stringify(schema, null, 2)}

重要：只返回有效的JSON，不要包含任何其他文本或解释。
`;

      const response = await this.generateText(structuredPrompt, options);
      
      // 尝试解析JSON响应
      try {
        return JSON.parse(response.trim());
      } catch (parseError) {
        // 如果直接解析失败，尝试提取JSON部分
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
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });
  }
}

/**
 * 创建Claude客户端实例
 */
export function createClaudeClient(config?: {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}): ClaudeLLMClient {
  return new ClaudeLLMClient(config);
}