jest.mock('fs', () => ({
  __esModule: true,
  default: {
    mkdirSync: jest.fn(),
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
const mockConfigGetAll = jest.fn();
jest.mock('@/utils/config', () => ({
  config: {
    load: (...args: unknown[]) => mockConfigLoad(...args),
    getAll: (...args: unknown[]) => mockConfigGetAll(...args),
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

const mockRegisterScrumMaster = jest.fn();
jest.mock('@/agents/scrum-master', () => ({
  registerScrumMasterAgent: (...args: unknown[]) => mockRegisterScrumMaster(...args),
}));

const mockStart = jest.fn();
const mockEnd = jest.fn(() => ({ durationMs: 101, memory: { rss: 2048 } }));
jest.mock('@/utils/perf', () => ({
  PerfTracer: jest.fn().mockImplementation(() => ({
    start: mockStart,
    end: mockEnd,
  })),
}));

const mockHandleError = jest.fn();
jest.mock('@/utils/error', () => ({
  handleError: (...args: unknown[]) => mockHandleError(...args),
}));

import path from 'path';
import fs from 'fs';
import { tasksCommand } from '@/commands/tasks';

const mockFs = fs as unknown as {
  mkdirSync: jest.Mock;
  writeFileSync: jest.Mock;
};

describe('tasksCommand', () => {
  const fakeClient = { name: 'mock-client' };
  const fakeResult = {
    success: true,
    output: 'line1\nline2',
    nextSteps: ['step-a', 'step-b'],
  };
  const execute = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigGetAll.mockReturnValue({ projectName: 'task-project' });
    mockHas.mockReturnValue(true);
    mockInitialize.mockResolvedValue(undefined);
    mockGetDefaultClient.mockReturnValue(fakeClient);
    execute.mockResolvedValue(fakeResult);
    mockCreate.mockReturnValue({ execute });
  });

  it('should return when agent type is missing', async () => {
    mockHas.mockReturnValueOnce(false);

    await tasksCommand({ agent: 'Missing' });

    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('未找到代理类型'));
    expect(mockInitialize).not.toHaveBeenCalled();
  });

  it('should return when no default LLM client is available', async () => {
    mockGetDefaultClient.mockReturnValueOnce(null);

    await tasksCommand({});

    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('无可用的 LLM 客户端'));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should return when agent execution fails', async () => {
    execute.mockResolvedValueOnce({ success: false, output: '' });

    await tasksCommand({});

    expect(mockLog.error).toHaveBeenCalledWith('任务规划失败');
  });

  it('should write to --output path when provided', async () => {
    await tasksCommand({ output: 'reports/tasks-out.md' });

    const outPath = path.join(process.cwd(), 'reports/tasks-out.md');
    expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.dirname(outPath), { recursive: true });
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(outPath, 'line1\nline2');
    expect(mockLog.success).toHaveBeenCalledWith(expect.stringContaining('任务规划结果已写入'));
  });

  it('should write to --report-dir with json filename for json format', async () => {
    await tasksCommand({ reportDir: 'reports', format: 'json' });

    const outPath = path.join(process.cwd(), 'reports/tasks.json');
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(outPath, 'line1\nline2');
  });

  it('should print preview and truncation hint when no output target', async () => {
    const longOutput = Array.from({ length: 35 }, (_, i) => `line-${i + 1}`).join('\n');
    execute.mockResolvedValueOnce({ success: true, output: longOutput, nextSteps: [] });

    await tasksCommand({});

    expect(mockLog.info).toHaveBeenCalledWith('任务规划结果（摘要）：');
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('line-1'));
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('输出已截断'));
  });

  it('should print next steps and performance log on success', async () => {
    await tasksCommand({});

    expect(mockLog.info).toHaveBeenCalledWith('下一步建议：');
    expect(mockLog.info).toHaveBeenCalledWith('1. step-a');
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('任务规划性能:'));
    expect(mockLog.success).toHaveBeenCalledWith('任务规划完成！');
  });

  it('should call error handler and rethrow on unexpected errors', async () => {
    const err = new Error('agent-crash');
    execute.mockRejectedValueOnce(err);

    await expect(tasksCommand({})).rejects.toThrow('agent-crash');
    expect(mockHandleError).toHaveBeenCalledWith(err, { command: 'tasks' });
  });
});
