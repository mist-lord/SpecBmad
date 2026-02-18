jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    green: (s: string) => s,
    gray: (s: string) => s,
    red: (s: string) => s,
  },
}));

const mockLog = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  success: jest.fn(),
};
jest.mock('@/utils/logger', () => ({ log: mockLog }));

const mockLoad = jest.fn();
const mockSave = jest.fn();
const MockConfigManager = jest.fn().mockImplementation(() => ({
  load: (...args: unknown[]) => mockLoad(...args),
  save: (...args: unknown[]) => mockSave(...args),
}));
jest.mock('@/utils/config', () => ({
  ConfigManager: MockConfigManager,
}));

const mockInitialize = jest.fn();
const mockGetClientStatus = jest.fn();
jest.mock('@/core/llm', () => ({
  llmManager: {
    initialize: (...args: unknown[]) => mockInitialize(...args),
    getClientStatus: (...args: unknown[]) => mockGetClientStatus(...args),
  },
}));

const mockGetAvailableAgents = jest.fn();
jest.mock('@/agents/factory', () => ({
  AgentFactory: {
    getAvailableAgents: (...args: unknown[]) => mockGetAvailableAgents(...args),
  },
}));

const mockRegisterBuiltInAgents = jest.fn();
jest.mock('@/agents', () => ({
  registerBuiltInAgents: (...args: unknown[]) => mockRegisterBuiltInAgents(...args),
}));

import { agentsCommand } from '@/commands/agents';

describe('agentsCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoad.mockReturnValue({ agents: {} });
    mockGetAvailableAgents.mockReturnValue([]);
    mockGetClientStatus.mockResolvedValue([]);
    mockInitialize.mockResolvedValue(undefined);
  });

  it('should list empty registered/configured agents with warnings', async () => {
    await agentsCommand({ list: true });

    expect(mockRegisterBuiltInAgents).toHaveBeenCalled();
    expect(mockInitialize).toHaveBeenCalled();
    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('尚未注册任何代理类型'));
    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('项目未配置任何代理'));
  });

  it('should list registered and configured agents', async () => {
    mockGetAvailableAgents.mockReturnValueOnce(['Analyst', 'QA']);
    mockLoad.mockReturnValueOnce({
      agents: {
        claude: { type: 'claude', enabled: true, model: 'sonnet' },
        openai: { type: 'openai', enabled: false },
      },
    });

    await agentsCommand({ list: true });

    expect(mockLog.info).toHaveBeenCalledWith('- Analyst');
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('claude (claude:sonnet) [enabled]'));
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('openai (openai) [disabled]'));
  });

  it('should print status for empty and non-empty client status', async () => {
    await agentsCommand({ status: true });
    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('尚未注册任何 LLM 客户端'));
    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('暂无已注册代理类型'));

    mockGetClientStatus.mockResolvedValueOnce([
      { name: 'claude', type: 'anthropic', available: true },
      { name: 'openai', type: 'openai', available: false, error: 'bad key' },
    ]);
    mockGetAvailableAgents.mockReturnValueOnce(['Architect']);
    await agentsCommand({ status: true });

    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('claude [anthropic] 可用'));
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('openai [openai] 不可用 - bad key'));
    expect(mockLog.info).toHaveBeenCalledWith('- Architect');
  });

  it('should enable an agent with defaults and disable existing/missing agents', async () => {
    await agentsCommand({ enable: 'newAgent' });
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        agents: expect.objectContaining({
          newAgent: expect.objectContaining({
            type: 'claude',
            model: 'claude-3-sonnet',
            enabled: true,
          }),
        }),
      }),
    );
    expect(mockLog.success).toHaveBeenCalledWith(expect.stringContaining('已启用代理: newAgent'));

    mockLoad.mockReturnValueOnce({
      agents: {
        qa: { type: 'qa', enabled: true },
      },
    });
    await agentsCommand({ disable: 'qa' });
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        agents: expect.objectContaining({
          qa: expect.objectContaining({ enabled: false }),
        }),
      }),
    );
    expect(mockLog.success).toHaveBeenCalledWith(expect.stringContaining('已禁用代理: qa'));

    mockLoad.mockReturnValueOnce({ agents: {} });
    await agentsCommand({ disable: 'missing' });
    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('代理未配置: missing'));
  });

  it('should show operation hint when no option is provided', async () => {
    await agentsCommand({});
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('请指定代理操作'));
  });

  it('should log and rethrow errors from command execution', async () => {
    MockConfigManager.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await expect(agentsCommand({ list: true })).rejects.toThrow('boom');
    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('代理操作失败: boom'));
  });
});
