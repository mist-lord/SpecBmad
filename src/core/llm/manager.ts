import { log } from '@/utils/logger';
import { LLMClientFactory } from './base';
import { createClaudeClient } from './clients/claude';
import { createOpenAIClient } from './clients/openai';
import { createMockLLMClient } from './clients/mock';
import { ConfigManager, getProjectConfig } from '@/utils/config';
import { AgentType, LLMClient } from '@/types';

export class LLMManager {
  private initialized = false;
  private readonly clients: Map<string, LLMClient> = new Map();

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    const configManager = new ConfigManager();
    const projectConfig = configManager.load();

    // 注册默认可用的客户端（基于环境变量）
    this.initializeDefaultClients();

    // 基于项目配置注册客户端
    this.initializeConfiguredClients(projectConfig);

    this.initialized = true;
    log.info('LLM 管理器初始化完成');
  }

  private initializeDefaultClients(): void {
    const mockEnabled = process.env.BMAD_MOCK_LLM === '1';
    if (mockEnabled && !this.hasClient('Mock')) {
      const mockClient = createMockLLMClient('Mock');
      LLMClientFactory.register(mockClient);
      this.clients.set('Mock', mockClient);
      log.info('已注册默认 Mock LLM 客户端（离线支持）');
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicApiKey) {
      const claudeClient = createClaudeClient({
        apiKey: anthropicApiKey,
        defaultModel: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet',
        baseUrl: process.env.ANTHROPIC_BASE_URL
      });
      LLMClientFactory.register(claudeClient);
      this.clients.set('Claude', claudeClient);
      log.info('已注册默认 Claude LLM 客户端');
    } else {
      log.warn('未找到 ANTHROPIC_API_KEY，Claude 客户端不可用');
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      const openaiClient = createOpenAIClient({
        apiKey: openaiApiKey,
        defaultModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        baseUrl: process.env.OPENAI_BASE_URL
      });
      LLMClientFactory.register(openaiClient);
      this.clients.set('OpenAI', openaiClient);
      log.info('已注册默认 OpenAI LLM 客户端');
    } else {
      log.warn('未找到 OPENAI_API_KEY，OpenAI 客户端不可用');
    }
  }

  private initializeConfiguredClients(projectConfig: ReturnType<ConfigManager['load']>): void {
    const agentsCfg = projectConfig.agents || {};

    for (const [name, agentCfg] of Object.entries(agentsCfg)) {
      if (!agentCfg.enabled) continue;

      const type = (agentCfg.type || '').toLowerCase();
      switch (type) {
        case 'claude': {
          if (!this.hasClient(name)) {
            const client = createClaudeClient({
              apiKey: agentCfg.apiKey,
              defaultModel: agentCfg.model || 'claude-3-sonnet',
              baseUrl: agentCfg.baseUrl
            });
            // 重命名客户端以匹配配置名称
            (client as any).name = name;
            LLMClientFactory.register(client);
            this.clients.set(name, client);
            log.info(`已注册配置的 Claude 客户端: ${name}`);
          }
          break;
        }
        case 'openai': {
          if (!this.hasClient(name)) {
            const client = createOpenAIClient({
              apiKey: agentCfg.apiKey,
              defaultModel: agentCfg.model || 'gpt-4o-mini',
              baseUrl: agentCfg.baseUrl
            });
            // 重命名客户端以匹配配置名称
            (client as any).name = name;
            LLMClientFactory.register(client);
            this.clients.set(name, client);
            log.info(`已注册配置的 OpenAI 客户端: ${name}`);
          }
          break;
        }
        case 'mock': {
          if (!this.hasClient(name)) {
            const client = createMockLLMClient(name);
            LLMClientFactory.register(client);
            this.clients.set(name, client);
            log.info(`已注册配置的 Mock 客户端: ${name}`);
          }
          break;
        }
        default:
          log.warn(`不支持的代理类型: ${agentCfg.type}`);
      }
    }
  }

  private hasClient(name: string): boolean {
    return this.clients.has(name) || !!LLMClientFactory.get(name);
  }

  public async getClientStatus(): Promise<{ name: string; type: AgentType; available: boolean; error?: string }[]> {
    const results: { name: string; type: AgentType; available: boolean; error?: string }[] = [];
    const allClients = LLMClientFactory.getAll();

    for (const client of allClients) {
      try {
        const available = await client.isAvailable();
        results.push({ name: client.name, type: client.type, available });
      } catch (err) {
        results.push({
          name: client.name,
          type: client.type,
          available: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
    return results;
  }

  public getDefaultClient(): LLMClient | null {
    // 从项目配置选择默认客户端，若不可用则回退至 Mock
    const project = getProjectConfig();
    const defaultNameRaw = project?.spec_kit?.ai_agent || 'Claude';
    const defaultName = this.normalizeDefaultClientName(defaultNameRaw);

    const client = LLMClientFactory.get(defaultName) || LLMClientFactory.get(defaultNameRaw);
    if (client) return client;

    // 回退到 Mock
    const mock = LLMClientFactory.get('Mock');
    if (mock) return mock;

    log.warn(`未找到默认 LLM 客户端: ${defaultNameRaw}。请检查配置或环境。`);
    return null;
  }

  private normalizeDefaultClientName(name: string): string {
    const n = (name || '').trim().toLowerCase();
    switch (n) {
      case 'claude':
      case 'anthropic':
      case 'sonnet':
      case 'claude-3-sonnet':
        return 'Claude';
      case 'openai':
      case 'gpt':
      case 'gpt-4':
      case 'gpt-4o':
      case 'gpt-4o-mini':
        return 'OpenAI';
      case 'mock':
      case 'fake':
      case 'offline':
        return 'Mock';
      default:
        return name;
    }
  }
}

export const llmManager = new LLMManager();