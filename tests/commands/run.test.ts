import { EventEmitter } from 'events';
import path from 'path';

const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
};
jest.mock('fs', () => ({
  __esModule: true,
  default: mockFs,
}));

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

const mockHttpGet = jest.fn();
jest.mock('http', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockHttpGet(...args),
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

const mockStart = jest.fn();
const mockEnd = jest.fn(() => ({ durationMs: 88 }));
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

import { runCommand } from '@/commands/run';

type ProcLike = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: jest.Mock;
};

function createProc(): ProcLike {
  const proc = new EventEmitter() as ProcLike;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn();
  return proc;
}

describe('runCommand', () => {
  let proc: ProcLike;

  beforeEach(() => {
    jest.clearAllMocks();
    proc = createProc();
    mockSpawn.mockReturnValue(proc);
    mockFs.existsSync.mockReturnValue(true);
    mockHttpGet.mockImplementation((_opts: unknown, cb: (res: any) => void) => {
      const req = new EventEmitter();
      const res = new EventEmitter() as any;
      res.statusCode = 200;
      res.setEncoding = jest.fn();
      cb(res);
      process.nextTick(() => {
        res.emit('data', 'ok');
        res.emit('end');
      });
      return req;
    });
  });

  it('should run py-cli with python main.py and capture output', async () => {
    const promise = runCommand({ dir: 'generated/project', stack: 'py-cli' });
    proc.stdout.emit('data', Buffer.from('hello'));
    proc.emit('exit', 0);
    const output = await promise;

    expect(mockSpawn).toHaveBeenCalledWith(
      'python',
      ['main.py'],
      expect.objectContaining({ stdio: 'pipe' }),
    );
    expect(output).toContain('hello');
    expect(mockLog.success).toHaveBeenCalledWith(expect.stringContaining('程序运行完成'));
  });

  it('should return early with warning when cpp executable is missing', async () => {
    mockFs.existsSync.mockImplementation((p: string) => !String(p).includes('/build/'));

    const output = await runCommand({ stack: 'cpp-cli' });

    expect(output).toContain('C++ 项目需要先构建');
    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('请先运行'));
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('should run cpp executable when build artifact exists', async () => {
    mockFs.existsSync.mockReturnValue(true);

    const promise = runCommand({ stack: 'cpp-app' });
    proc.emit('exit', 0);
    await promise;

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringContaining(path.join('build', 'project')),
      [],
      expect.any(Object),
    );
  });

  it('should fallback to inline node script when ts entry cannot be created', async () => {
    mockFs.existsSync.mockImplementation((p: string) => !String(p).endsWith(path.join('src', 'index.js')));

    const promise = runCommand({ stack: 'ts-cli' });
    proc.emit('exit', 0);
    await promise;

    expect(mockSpawn).toHaveBeenCalledWith(
      'node',
      ['-e', 'console.log("hello")'],
      expect.any(Object),
    );
  });

  it('should run ts-api health check and kill process', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
      cb();
      return 0 as any;
    });

    const output = await runCommand({ stack: 'ts-api', port: 3456 });

    expect(mockSpawn).toHaveBeenCalledWith(
      'node',
      ['src/server.js'],
      expect.objectContaining({
        env: expect.objectContaining({ PORT: '3456' }),
      }),
    );
    expect(mockHttpGet).toHaveBeenCalledWith(
      expect.objectContaining({ host: '127.0.0.1', port: 3456, path: '/health' }),
      expect.any(Function),
    );
    expect(output).toContain('HEALTH 200: ok');
    expect(proc.kill).toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });

  it('should call handleError and throw when process exits non-zero', async () => {
    const promise = runCommand({ stack: 'ts-cli' });
    proc.emit('exit', 2);

    await expect(promise).rejects.toThrow('运行失败，退出码 2');
    expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), { command: 'run' });
  });

  it('should call handleError and throw on process error event', async () => {
    const promise = runCommand({ stack: 'ts-cli' });
    proc.emit('error', new Error('spawn-failed'));

    await expect(promise).rejects.toThrow('spawn-failed');
    expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), { command: 'run' });
  });
});
