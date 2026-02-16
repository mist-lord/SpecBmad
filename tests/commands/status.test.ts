jest.mock('chalk', () => {
  const passthrough = Object.assign((s: string) => s, {
    bold: (s: string) => s,
  });
  return {
    __esModule: true,
    default: {
      bold: (s: string) => s,
      cyan: passthrough,
      yellow: passthrough,
    },
  };
});

jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    success: jest.fn(),
  },
}));

const mockIsInitialized = jest.fn();
const mockGetStatus = jest.fn();

jest.mock('@/core/project/status', () => ({
  ProjectStatusManager: jest.fn().mockImplementation(() => ({
    isInitialized: mockIsInitialized,
    getStatus: mockGetStatus,
  })),
}));

import { statusCommand } from '@/commands/status';
import { log } from '@/utils/logger';

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    project: { name: 'demo-project', version: '1.2.3' },
    tasks: { total: 8, pending: 2, inProgress: 3, completed: 2, blocked: 1 },
    files: {
      specifications: ['spec/a.md', 'spec/b.md'],
      plans: ['plan/roadmap.md'],
      implementations: ['src/a.ts'],
      tests: ['tests/a.test.ts'],
    },
    agents: { available: ['Analyst', 'Architect'] },
    lastActivity: new Date().toISOString(),
    health: 'healthy' as 'healthy' | 'warning' | 'error',
    issues: ['issue-a', 'issue-b'],
    ...overrides,
  };
}

describe('statusCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsInitialized.mockReturnValue(true);
    mockGetStatus.mockResolvedValue(makeStatus());
  });

  it('should warn and return when project is not initialized', async () => {
    mockIsInitialized.mockReturnValue(false);

    await statusCommand({});

    expect(mockGetStatus).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('项目尚未初始化'));
  });

  it('should display basic status when detailed option is false', async () => {
    await statusCommand({ detailed: false });

    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('项目状态'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('项目: demo-project'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('状态: ✅ healthy'));
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('阻塞: 1'));
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('issue-a'));
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('issue-b'));
  });

  it('should display detailed status and list all files/agents', async () => {
    await statusCommand({ detailed: true });

    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('详细信息'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('规范文档:'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('spec/a.md'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('计划文档:'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('实现文件:'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('测试文件:'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('可用代理详情'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('✓ Analyst'));
  });

  it('should render warning and error emojis for corresponding health status', async () => {
    mockGetStatus.mockResolvedValueOnce(makeStatus({ health: 'warning', issues: [] }));
    await statusCommand({});
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('状态: ⚠️ warning'));

    mockGetStatus.mockResolvedValueOnce(makeStatus({ health: 'error', issues: [] }));
    await statusCommand({});
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('状态: ❌ error'));
  });

  it('should skip blocked warning/issues and details lists when data is empty', async () => {
    mockGetStatus.mockResolvedValueOnce(
      makeStatus({
        tasks: { total: 1, pending: 1, inProgress: 0, completed: 0, blocked: 0 },
        files: { specifications: [], plans: [], implementations: [], tests: [] },
        agents: { available: [] },
        issues: [],
      }),
    );

    await statusCommand({ detailed: true });

    expect(log.warn).not.toHaveBeenCalledWith(expect.stringContaining('阻塞'));
    expect(log.warn).not.toHaveBeenCalledWith(expect.stringContaining('注意事项'));
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('可用: 0 个'));
    expect(log.info).not.toHaveBeenCalledWith(expect.stringContaining('可用代理详情'));
  });

  it('should log and rethrow when getStatus fails', async () => {
    const error = new Error('boom');
    mockGetStatus.mockRejectedValueOnce(error);

    await expect(statusCommand({})).rejects.toThrow('boom');
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('状态查看失败'));
  });
});
