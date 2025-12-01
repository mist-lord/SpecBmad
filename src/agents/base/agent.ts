import { Agent, AgentContext, AgentResult, AgentMemory, LLMClient, LLMOptions, LLMMetrics } from '@/types';
import { log } from '@/utils/logger';
import { contextManager } from '@/core/context/manager';
import { promptEngine } from '@/core/prompt/engine';
import { llmCache } from '@/core/llm/cache';
import { llmConcurrency } from '@/core/llm/concurrency';
import { llmManager } from '@/core/llm/manager';
import { LLMClientFactory } from '@/core/llm/base';

/**
 * 抽象代理基类
 */
export abstract class BaseAgent implements Agent {
  public readonly name: string;
  public readonly role: string;
  public readonly capabilities: string[];

  protected llmClient: LLMClient;
  protected memory: AgentMemory;
  protected lastMetrics?: LLMMetrics;

  constructor(name: string, role: string, capabilities: string[], llmClient: LLMClient) {
    this.name = name;
    this.role = role;
    this.capabilities = capabilities;
    this.llmClient = llmClient;
    this.memory = this.initializeMemory();
  }

  abstract execute(context: AgentContext): Promise<AgentResult>;

  validate(input: any): boolean {
    // 基础输入校验
    return input !== null && input !== undefined;
  }

  protected async generateResponse(prompt: string, context: AgentContext, options?: LLMOptions): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);

    // 若提供模板名称，则优先使用模板渲染生成主提示
    const tplName = context.inputData?.templateName as string | undefined;
    const tplData = (context.inputData?.templateData as Record<string, any>) || {};
    if (tplName) {
      try {
        prompt = promptEngine.render(tplName, tplData, { variant: tplData.variant });
      } catch (e) {
        // 模板渲染失败时回退原始提示
        void e;
      }
    }

    // 构建上下文消息（相关性评分 + 自动截断）
    const builtContext = contextManager.buildContext(prompt, context, this.memory, {
      maxContextTokens: options?.maxTokens ? Math.floor(options.maxTokens * 0.5) : 1200,
      maxHistory: 20,
      relevanceThreshold: 0.05,
      preferRecent: true,
    });

    const fullOptions: LLMOptions = {
      ...options,
      systemPrompt,
      context: [...(options?.context || []), ...builtContext],
    };

    log.debug(`[Agent:${this.name}] 生成响应:`, { promptLen: prompt.length, model: fullOptions.model, ctxSize: fullOptions.context?.length });

    // 缓存命中检查
    try {
      const cacheKey = llmCache.makeKey(prompt, fullOptions);
      const cached = llmCache.get(cacheKey);
      if (cached) {
        this.lastMetrics = {
          model: fullOptions.model,
          promptLength: prompt.length,
          outputLength: cached.length,
          inputTokens: this.estimateTokens(prompt),
          outputTokens: this.estimateTokens(cached),
          latencyMs: 0,
          costUSD: 0,
          startedAt: Date.now(),
          finishedAt: Date.now(),
        };
        this.updateMemory('lastResponse', cached);
        this.updateMemory('lastMetrics', this.lastMetrics);
        log.debug(`[Agent:${this.name}] 缓存命中，直接返回`);
        return cached;
      }
    } catch (e) {
      // 缓存系统异常不影响主流程
      void e;
    }

    const startedAt = Date.now();
    try {
      const response = await this.generateWithRetryOrFallback(prompt, fullOptions);
      const finishedAt = Date.now();

      const outputLength = response?.length ?? 0;
      const inputTokens = this.estimateTokens(prompt);
      const outputTokens = this.estimateTokens(response);
      const latencyMs = finishedAt - startedAt;

      this.lastMetrics = {
        model: fullOptions.model,
        promptLength: prompt.length,
        outputLength,
        inputTokens,
        outputTokens,
        latencyMs,
        costUSD: this.estimateCostUSD(fullOptions.model, inputTokens, outputTokens),
        startedAt,
        finishedAt,
      };

      this.updateMemory('lastResponse', response);
      this.updateMemory('lastMetrics', this.lastMetrics);

      // 写入缓存
      try {
        const cacheKey = llmCache.makeKey(prompt, fullOptions);
        llmCache.set(cacheKey, response);
      } catch {}

      return response;
    } catch (error) {
      log.error(`[Agent:${this.name}] 响应生成失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const capabilitiesStr = this.capabilities.join(', ');
    const currentStep = context.projectState?.workflow?.currentStep || '';
    const completed = (context.projectState?.workflow?.completedSteps || []).join(', ');

    return `You are ${this.name}, a ${this.role} with the following capabilities: ${capabilitiesStr}.
    
Project Context:
- Project: ${context.projectState?.projectName || ''}
- Current Step: ${currentStep}
- Completed Steps: ${completed}

Your task is to provide professional, accurate, and actionable output based on your role and capabilities.`;
  }

  protected updateMemory(key: string, value: any): void {
    this.memory.shortTerm[key] = value;
    this.memory.context.push(`${new Date().toISOString()}: ${key} updated`);

    // 保持上下文历史在合理范围内
    if (this.memory.context.length > 100) {
      this.memory.context = this.memory.context.slice(-50);
    }
  }

  protected getMemorySnapshot(): AgentMemory {
    return JSON.parse(JSON.stringify(this.memory));
  }

  protected getLastMetrics(): LLMMetrics | undefined {
    return this.lastMetrics;
  }

  protected extractNextSteps(output: string): string[] {
    // 先尝试解析 JSON 并读取 actions/nextSteps 字段
    try {
      const obj = JSON.parse(output);
      const actions = Array.isArray(obj.actions) ? obj.actions : [];
      const next = Array.isArray(obj.nextSteps) ? obj.nextSteps : [];
      const combined = [...actions, ...next].filter(Boolean);
      if (combined.length > 0) return combined.slice(0, 10);
    } catch {}

    // 退化为从 Markdown/纯文本中提取带列表标记的行
    const lines = output.split('\n').map((l) => l.trim());
    const steps: string[] = [];
    for (const line of lines) {
      if (/^(?:[-*]\s|\d+[.)]\s)/.test(line)) {
        steps.push(line.replace(/^\d+[.)]\s|^[-*]\s/, ''));
      }
    }
    return steps.slice(0, 10);
  }

  private estimateTokens(text: string): number {
    if (!text) return 0;
    // 粗略估算：英文约4字符/Token；混合文本取2.5作为平衡
    const len = text.length;
    return Math.ceil(len / 2.5);
  }

  private estimateCostUSD(model: string | undefined, inputTokens: number, outputTokens: number): number {
    // 简化价格模型（单位：每百万Token）
    const pricing: Record<string, { inUSDPerMTok: number; outUSDPerMTok: number }> = {
      'claude-3.5-sonnet': { inUSDPerMTok: 3, outUSDPerMTok: 15 },
      'claude-3-sonnet': { inUSDPerMTok: 3, outUSDPerMTok: 15 },
      'claude-3-haiku': { inUSDPerMTok: 0.25, outUSDPerMTok: 1.25 },
    };
    const key = (model || '').toLowerCase();
    const p = pricing[key];
    if (!p) return 0;
    const cost = (inputTokens * p.inUSDPerMTok + outputTokens * p.outUSDPerMTok) / 1_000_000;
    // 保留到4位小数
    return Math.round(cost * 10000) / 10000;
  }

  private initializeMemory(): AgentMemory {
    return {
      shortTerm: {},
      longTerm: {},
      context: []
    };
  }

  private async generateWithRetryOrFallback(prompt: string, options: LLMOptions): Promise<string> {
    const maxRetries = 2;
    const backoffBaseMs = 300;
    let attempt = 0;
    let lastErr: any;

    const tryOnce = async () => {
      return await llmConcurrency.run(() => this.llmClient.generateText(prompt, options));
    };

    while (attempt <= maxRetries) {
      try {
        if (attempt > 0) {
          const delay = backoffBaseMs * Math.pow(2, attempt - 1);
          await new Promise((res) => setTimeout(res, delay));
        }
        return await tryOnce();
      } catch (e) {
        lastErr = e;
        log.warn(`[Agent:${this.name}] LLM 调用失败，第 ${attempt + 1}/${maxRetries + 1} 次尝试: ${e instanceof Error ? e.message : String(e)}`);
        attempt++;
      }
    }

    // 尝试回退到 Mock 客户端
    try {
      const mock = LLMClientFactory.get('Mock');
      if (mock && this.llmClient.name !== 'Mock') {
        log.warn(`[Agent:${this.name}] 回退到 Mock 客户端生成响应`);
        return await mock.generateText(prompt, options);
      }
    } catch (err) {
      // 忽略回退错误，抛出原始错误
      void err;
    }

    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'LLM 调用失败'));
  }
}