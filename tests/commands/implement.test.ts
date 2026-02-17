jest.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
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

const mockRegisterDeveloper = jest.fn();
jest.mock('@/agents/developer', () => ({
  registerDeveloperAgent: (...args: unknown[]) => mockRegisterDeveloper(...args),
}));

const mockStart = jest.fn();
const mockEnd = jest.fn(() => ({ durationMs: 120, memory: { rss: 4096 } }));
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

const mockReadTasksMarkdown = jest.fn();
const mockPlanFromTasks = jest.fn();
const mockWriteSkeleton = jest.fn();
const mockUpdatePackageJson = jest.fn();
const mockBuildTraceability = jest.fn();
const mockWriteConsistencyReport = jest.fn();
const mockStrengthenPlanning = jest.fn();
jest.mock('@/utils/tasks-driven', () => ({
  readTasksMarkdown: (...args: unknown[]) => mockReadTasksMarkdown(...args),
  planFromTasks: (...args: unknown[]) => mockPlanFromTasks(...args),
  writeSkeleton: (...args: unknown[]) => mockWriteSkeleton(...args),
  updatePackageJson: (...args: unknown[]) => mockUpdatePackageJson(...args),
  buildTraceability: (...args: unknown[]) => mockBuildTraceability(...args),
  writeConsistencyReport: (...args: unknown[]) => mockWriteConsistencyReport(...args),
  strengthenPlanning: (...args: unknown[]) => mockStrengthenPlanning(...args),
}));

const mockGetArtifactsPath = jest.fn();
jest.mock('@/utils/paths', () => ({
  getArtifactsPath: (...args: unknown[]) => mockGetArtifactsPath(...args),
}));

import path from 'path';
import fs from 'fs';
import { implementCommand } from '@/commands/implement';

const mockFs = fs as unknown as {
  existsSync: jest.Mock;
  readFileSync: jest.Mock;
  mkdirSync: jest.Mock;
  writeFileSync: jest.Mock;
};

describe('implementCommand', () => {
  const execute = jest.fn();
  const fakeClient = { name: 'mock-client' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigGetAll.mockReturnValue({ projectName: 'impl-project' });
    mockHas.mockReturnValue(true);
    mockInitialize.mockResolvedValue(undefined);
    mockGetDefaultClient.mockReturnValue(fakeClient);
    execute.mockResolvedValue({ success: true, output: 'impl-output', nextSteps: ['n1'] });
    mockCreate.mockReturnValue({ execute });

    mockGetArtifactsPath.mockReturnValue('/fake/artifacts/tasks.md');
    mockReadTasksMarkdown.mockReturnValue(undefined);
    mockPlanFromTasks.mockReturnValue([]);
    mockWriteSkeleton.mockReturnValue({ files: [], tests: [] });
    mockBuildTraceability.mockReturnValue('## Traceability');

    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('');
  });

  it('should return when agent type is missing', async () => {
    mockHas.mockReturnValueOnce(false);

    await implementCommand({ agent: 'Missing' });

    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('未找到代理类型'));
    expect(mockInitialize).not.toHaveBeenCalled();
  });

  it('should return when no LLM client is available', async () => {
    mockGetDefaultClient.mockReturnValueOnce(null);

    await implementCommand({});

    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('无可用的 LLM 客户端'));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should return when agent execution fails', async () => {
    execute.mockResolvedValueOnce({ success: false, output: '' });

    await implementCommand({});

    expect(mockLog.error).toHaveBeenCalledWith('代码实现失败');
  });

  it('should write output file when --output is provided', async () => {
    await implementCommand({ output: 'reports/impl.md' });

    const outPath = path.join(process.cwd(), 'reports/impl.md');
    expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.dirname(outPath), { recursive: true });
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(outPath, 'impl-output');
    expect(mockLog.success).toHaveBeenCalledWith(expect.stringContaining('实现结果已写入'));
  });

  it('should use reportDir and json filename for json format', async () => {
    await implementCommand({ reportDir: 'reports', format: 'json' });

    const outPath = path.join(process.cwd(), 'reports/implement.json');
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(outPath, 'impl-output');
  });

  it('should execute tasks-driven flow and augment output with traceability', async () => {
    const projectDir = path.join(process.cwd(), 'generated', 'project');
    const jsFile = path.join(projectDir, 'src', 'app.js');
    const pkgFile = path.join(projectDir, 'package.json');

    mockReadTasksMarkdown.mockReturnValueOnce('- [ ] task one\n**用户故事** x');
    mockPlanFromTasks.mockReturnValueOnce([{ name: 'Task One' }]);
    mockWriteSkeleton.mockReturnValueOnce({
      files: [jsFile],
      tests: [path.join(projectDir, 'tests', 'app.test.js')],
    });
    mockBuildTraceability.mockReturnValueOnce('## Traceability\ntrace-data');
    mockFs.existsSync.mockImplementation((p: string) => String(p) === pkgFile);
    mockFs.readFileSync.mockImplementation((p: string) => {
      if (String(p) === jsFile) return 'console.log("x")';
      if (String(p) === pkgFile) return JSON.stringify({ scripts: {} });
      return '';
    });
    execute.mockResolvedValueOnce({
      success: true,
      output: '## Implement\nbody',
      nextSteps: [],
    });

    await implementCommand({});

    expect(mockPlanFromTasks).toHaveBeenCalled();
    expect(mockUpdatePackageJson).toHaveBeenCalledWith(projectDir);
    expect(mockStrengthenPlanning).toHaveBeenCalledWith(process.cwd(), ['Task One']);
    expect(mockWriteConsistencyReport).toHaveBeenCalled();
    expect(mockBuildTraceability).toHaveBeenCalled();
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      path.join(projectDir, 'src', 'app.cjs'),
      'console.log("x")',
      'utf-8',
    );
    expect(mockLog.info).toHaveBeenCalledWith('实现结果（摘要）：');
    expect(mockLog.success).toHaveBeenCalledWith('代码实现完成！');
  });

  it('should call error handler and rethrow on unexpected errors', async () => {
    const err = new Error('impl-crash');
    execute.mockRejectedValueOnce(err);

    await expect(implementCommand({})).rejects.toThrow('impl-crash');
    expect(mockHandleError).toHaveBeenCalledWith(err, { command: 'implement' });
  });
});
