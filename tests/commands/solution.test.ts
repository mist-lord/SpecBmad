import { EventEmitter } from 'events';

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

const mockSpawn = jest.fn();
const mockSpawnSync = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
}));

async function runSolution(args: string[]) {
  jest.resetModules();
  const { solutionCommand } = await import('@/commands/solution');
  await solutionCommand.parseAsync(['node', 'test', ...args]);
}

describe('solutionCommand', () => {
  let child: EventEmitter;

  beforeEach(() => {
    jest.clearAllMocks();
    child = new EventEmitter();
    mockSpawn.mockReturnValue(child as unknown as ReturnType<typeof mockSpawn>);
    mockSpawnSync.mockReturnValue({ status: 0, error: null });
    mockConfigLoad.mockReturnValue({ bmad_method: { enabled: true } });
  });

  it('should warn and return when BMAD-Method is disabled', async () => {
    mockConfigLoad.mockReturnValueOnce({ bmad_method: { enabled: false } });

    await runSolution([]);

    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('BMAD-Method未启用'));
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('should use python when available and spawn bridge process', async () => {
    await runSolution(['--type', 'integration', '--agent', 'Architect', '--depth', '4']);

    expect(mockSpawnSync).toHaveBeenCalledWith('python', ['--version']);
    expect(mockSpawn).toHaveBeenCalledWith(
      'python',
      expect.arrayContaining([
        expect.stringContaining('python/bmad_bridge.py'),
        'solution',
        '--type',
        'integration',
        '--agent',
        'Architect',
        '--depth',
        '4',
        '--output',
        'json',
      ]),
      expect.objectContaining({
        stdio: 'inherit',
        cwd: process.cwd(),
        env: expect.objectContaining({
          PYTHONPATH: expect.stringContaining('python'),
        }),
      }),
    );
  });

  it('should fallback to python3 when python check fails', async () => {
    mockSpawnSync.mockReturnValueOnce({ status: 1, error: new Error('missing python') });

    await runSolution([]);

    expect(mockSpawn).toHaveBeenCalledWith(
      'python3',
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('should log completion on close code 0 and failure on non-zero code', async () => {
    await runSolution([]);
    child.emit('close', 0);
    child.emit('close', 2);

    expect(mockLog.info).toHaveBeenCalledWith('解决方案设计完成');
    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('退出码: 2'));
  });

  it('should log process error events', async () => {
    await runSolution([]);
    child.emit('error', new Error('spawn broken'));

    expect(mockLog.error).toHaveBeenCalledWith('执行解决方案设计时出错:', 'spawn broken');
  });

  it('should log command error when config load throws', async () => {
    mockConfigLoad.mockImplementationOnce(() => {
      throw new Error('config-failed');
    });

    await runSolution([]);

    expect(mockLog.error).toHaveBeenCalledWith('解决方案命令执行失败:', expect.any(Error));
  });
});
