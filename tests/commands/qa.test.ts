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
jest.mock('@/utils/logger', () => ({ log: mockLog }));

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

const mockRegisterQA = jest.fn();
jest.mock('@/agents/qa', () => ({
  registerQAAgent: (...args: unknown[]) => mockRegisterQA(...args),
}));

const mockStart = jest.fn();
const mockEnd = jest.fn(() => ({ durationMs: 66, memory: { rss: 1234 } }));
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

const mockGetProjectPath = jest.fn();
jest.mock('@/utils/paths', () => ({
  PATHS: { ARTIFACTS_DIR: '.specbmad/artifacts' },
  getProjectPath: (...args: unknown[]) => mockGetProjectPath(...args),
}));

import path from 'path';
import fs from 'fs';
import { qaCommand } from '@/commands/qa';

const mockFs = fs as unknown as {
  mkdirSync: jest.Mock;
  writeFileSync: jest.Mock;
};

describe('qaCommand', () => {
  const execute = jest.fn();
  const fakeClient = { name: 'mock-llm' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigGetAll.mockReturnValue({ projectName: 'qa-project' });
    mockGetProjectPath.mockReturnValue(path.join(process.cwd(), '.specbmad/artifacts'));
    mockHas.mockReturnValue(true);
    mockInitialize.mockResolvedValue(undefined);
    mockGetDefaultClient.mockReturnValue(fakeClient);
    execute.mockResolvedValue({ success: true, output: 'qa-line-1\nqa-line-2', nextSteps: ['fix-a'] });
    mockCreate.mockReturnValue({ execute });
  });

  it('should return when agent type is missing', async () => {
    mockHas.mockReturnValueOnce(false);
    await qaCommand({ agent: 'Missing' });
    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('未找到代理类型'));
  });

  it('should return when no default llm client is available', async () => {
    mockGetDefaultClient.mockReturnValueOnce(null);
    await qaCommand({});
    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('无可用的 LLM 客户端'));
  });

  it('should return when qa agent execution fails', async () => {
    execute.mockResolvedValueOnce({ success: false, output: '' });
    await qaCommand({});
    expect(mockLog.error).toHaveBeenCalledWith('质量保证检查失败');
  });

  it('should write markdown output to default artifacts path', async () => {
    await qaCommand({ type: 'integration', fix: true });

    const outPath = path.join(process.cwd(), '.specbmad/artifacts', 'qa.md');
    expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.join(process.cwd(), '.specbmad/artifacts'), { recursive: true });
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(outPath, 'qa-line-1\nqa-line-2', 'utf-8');
    expect(mockLog.success).toHaveBeenCalledWith(expect.stringContaining('检查结果已写入'));
    expect(mockLog.info).toHaveBeenCalledWith('下一步建议：');
    expect(mockLog.info).toHaveBeenCalledWith('1. fix-a');
  });

  it('should write json output to explicit --output path', async () => {
    await qaCommand({ format: 'json', output: 'reports/qa.json', type: 'unit', file: 'a.ts' });

    const outPath = path.join(process.cwd(), 'reports/qa.json');
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      outPath,
      expect.stringContaining('"success": true'),
      'utf-8',
    );
    expect(mockLog.info).toHaveBeenCalledWith('检查结果（摘要）：');
  });

  it('should use reportDir override and print truncation hint', async () => {
    const longOutput = Array.from({ length: 40 }, (_, i) => `line-${i + 1}`).join('\n');
    execute.mockResolvedValueOnce({ success: true, output: longOutput, nextSteps: [] });

    await qaCommand({ reportDir: 'qa-reports' });

    const outPath = path.join(process.cwd(), 'qa-reports', 'qa.md');
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(outPath, longOutput, 'utf-8');
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('输出已截断'));
  });

  it('should call error handler and rethrow unexpected errors', async () => {
    const err = new Error('qa-crash');
    execute.mockRejectedValueOnce(err);

    await expect(qaCommand({})).rejects.toThrow('qa-crash');
    expect(mockHandleError).toHaveBeenCalledWith(err, { command: 'qa' });
  });
});
