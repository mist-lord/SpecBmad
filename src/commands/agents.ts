import chalk from 'chalk';
import { log } from '@/utils/logger';
import { AgentFactory } from '@/agents/factory';
import { llmManager } from '@/core/llm';
import { ConfigManager } from '@/utils/config';
import { registerBuiltInAgents } from '@/agents';

interface AgentsOptions {
  list?: boolean;
  status?: boolean;
  enable?: string;
  disable?: string;
}

export async function agentsCommand(options: AgentsOptions): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const projectConfig = configManager.load();

    // 确保内置代理已注册（用于 --list / --status 展示）
    registerBuiltInAgents();

    if (options.list) {
      await llmManager.initialize();
      const registered = AgentFactory.getAvailableAgents();
      const configured = Object.keys(projectConfig.agents || {});

      log.info('可用的AI代理类型 (已注册):');
      if (registered.length === 0) {
        log.warn('尚未注册任何代理类型。可后续注册 analyst/architect/developer/qa 等。');
      } else {
        for (const name of registered) {
          log.info(`- ${name}`);
        }
      }

      log.info('项目配置中的代理 (agents):');
      if (configured.length === 0) {
        log.warn('项目未配置任何代理。使用 config 命令或 --enable 进行配置。');
      } else {
        for (const key of configured) {
          const a = projectConfig.agents![key];
          const enabledStr = a.enabled ? chalk.green('enabled') : chalk.gray('disabled');
          log.info(`- ${key} (${a.type}${a.model ? `:${a.model}` : ''}) [${enabledStr}]`);
        }
      }
      return;
    }

    if (options.status) {
      await llmManager.initialize();
      const status = await llmManager.getClientStatus();

      log.info('LLM 客户端状态:');
      if (status.length === 0) {
        log.warn('尚未注册任何 LLM 客户端。请设置 ANTHROPIC_API_KEY 或在配置中启用代理。');
      } else {
        for (const s of status) {
          const ok = s.available ? chalk.green('可用') : chalk.red('不可用');
          log.info(`- ${s.name} [${s.type}] ${ok}${s.error ? ` - ${s.error}` : ''}`);
        }
      }

      const registered = AgentFactory.getAvailableAgents();
      log.info('已注册的代理类型:');
      if (registered.length === 0) {
        log.warn('暂无已注册代理类型');
      } else {
        for (const name of registered) log.info(`- ${name}`);
      }
      return;
    }

    if (options.enable) {
      const key = options.enable;
      const agents = { ...(projectConfig.agents || {}) };
      const exists = agents[key];

      agents[key] = {
        type: exists?.type || 'claude',
        model: exists?.model || 'claude-3-sonnet',
        enabled: true,
        apiKey: exists?.apiKey,
        baseUrl: exists?.baseUrl
      } as any;

      configManager.save({ agents });
      log.success(`已启用代理: ${key}`);
      return;
    }

    if (options.disable) {
      const key = options.disable;
      const agents = { ...(projectConfig.agents || {}) };
      if (!agents[key]) {
        log.warn(`代理未配置: ${key}`);
      } else {
        agents[key].enabled = false;
        configManager.save({ agents });
        log.success(`已禁用代理: ${key}`);
      }
      return;
    }

    log.info('请指定代理操作 (--list, --status, --enable, --disable)');
  } catch (error) {
    log.error(`代理操作失败: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}