import { EventEmitter } from 'events';

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    writeFileSync: jest.fn(),
  },
}));

const mockLog = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  success: jest.fn(),
};
jest.mock('@/utils/logger', () => ({
  log: mockLog,
}));

const mockConfigLoad = jest.fn();
jest.mock('@/utils/config', () => ({
  config: {
    load: (...args: unknown[]) => mockConfigLoad(...args),
  },
}));

const mockInitialize = jest.fn();
const mockGetDefaultClient = jest.fn();
jest.mock('@/core/llm', () => ({
  llmManager: {
    initialize: (...args: unknown[]) => mockInitialize(...args),
    getDefaultClient: (...args: unknown[]) => mockGetDefaultClient(...args),
  },
}));

const mockHas = jest.fn();
const mockCreate = jest.fn();
jest.mock('@/agents/factory', () => ({
  AgentFactory: {
    has: (...args: unknown[]) => mockHas(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

const mockRegisterArchitect = jest.fn();
jest.mock('@/agents/architect', () => ({
  registerArchitectAgent: (...args: unknown[]) => mockRegisterArchitect(...args),
}));

const mockSpawn = jest.fn();
const mockSpawnSync = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
}));

async function runPlan(args: string[]) {
  jest.resetModules();
  const { planCommand } = await import('@/commands/plan');
  await planCommand.parseAsync(['node', 'test', ...args]);
}

describe('planCommand', () => {
  let child: EventEmitter;
  const execute = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    child = new EventEmitter();
    mockSpawn.mockReturnValue(child as unknown as ReturnType<typeof mockSpawn>);
    mockSpawnSync.mockReturnValue({ status: 0, error: null });
    mockConfigLoad.mockReturnValue({
      projectName: 'demo',
      bmad_method: { enabled: true },
      integration: { bridge_mode: 'subprocess' },
    });
    mockHas.mockReturnValue(true);
    mockGetDefaultClient.mockReturnValue({ name: 'llm-client' });
    execute.mockResolvedValue({ success: true, output: 'ok', nextSteps: [] });
    mockCreate.mockReturnValue({ execute });
  });

  it('should warn and return when BMAD method is disabled', async () => {
    mockConfigLoad.mockReturnValueOnce({ bmad_method: { enabled: false } });

    await runPlan([]);

    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('BMAD-Method未启用'));
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('should run direct mode and write output file when out-file provided', async () => {
    mockConfigLoad.mockReturnValueOnce({
      projectName: 'demo',
      bmad_method: { enabled: true },
      integration: { bridge_mode: 'direct' },
    });

    await runPlan(['--out-file', 'reports/plan.txt']);

    const fs = (await import('fs')).default as unknown as { writeFileSync: jest.Mock };
    expect(mockInitialize).toHaveBeenCalled();
    expect(mockRegisterArchitect).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('reports/plan.txt'), 'ok');
    expect(mockLog.success).toHaveBeenCalledWith(expect.stringContaining('规划结果已写入'));
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('should print preview and truncation in direct mode when no out-file', async () => {
    const lines = Array.from({ length: 25 }, (_, i) => `line-${i + 1}`).join('\n');
    execute.mockResolvedValueOnce({ success: true, output: lines });
    mockConfigLoad.mockReturnValueOnce({
      projectName: 'demo',
      bmad_method: { enabled: true },
      integration: { bridge_mode: 'direct' },
    });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await runPlan([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('line-1'));
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('输出已截断'));
    consoleSpy.mockRestore();
  });

  it('should return error when direct mode has no llm client', async () => {
    mockConfigLoad.mockReturnValueOnce({
      projectName: 'demo',
      bmad_method: { enabled: true },
      integration: { bridge_mode: 'direct' },
    });
    mockGetDefaultClient.mockReturnValueOnce(null);

    await runPlan([]);

    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('无可用的 LLM 客户端'));
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('should fallback to subprocess when direct mode agent is missing', async () => {
    mockConfigLoad.mockReturnValueOnce({
      projectName: 'demo',
      bmad_method: { enabled: true },
      integration: { bridge_mode: 'direct' },
    });
    mockHas.mockReturnValueOnce(false);

    await runPlan([]);

    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('将回退到 Python 子进程模式'));
    expect(mockSpawn).toHaveBeenCalled();
  });

  it('should fallback to python3 for subprocess mode when python is unavailable', async () => {
    mockSpawnSync.mockReturnValueOnce({ status: 1, error: new Error('missing python') });

    await runPlan([]);

    expect(mockSpawn).toHaveBeenCalledWith(
      'python3',
      expect.any(Array),
      expect.objectContaining({ stdio: 'inherit' }),
    );
  });

  it('should log close/error events for subprocess mode', async () => {
    await runPlan([]);
    child.emit('close', 0);
    child.emit('close', 2);
    child.emit('error', new Error('spawn-failed'));

    expect(mockLog.info).toHaveBeenCalledWith('规划完成');
    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('退出码: 2'));
    expect(mockLog.error).toHaveBeenCalledWith('执行规划时出错:', 'spawn-failed');
  });

  it('should log command failure when config load throws', async () => {
    mockConfigLoad.mockImplementationOnce(() => {
      throw new Error('config-failed');
    });

    await runPlan([]);

    expect(mockLog.error).toHaveBeenCalledWith('规划命令执行失败:', expect.any(Error));
  });
});
