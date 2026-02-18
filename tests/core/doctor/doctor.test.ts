import { Doctor } from '@/core/doctor';
import { NodeCheck } from '@/core/doctor/checks/node';
import { GitCheck } from '@/core/doctor/checks/git';
import { StackEnvCheck } from '@/core/doctor/checks/stack';

jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() }
}));

jest.mock('chalk', () => {
  const passThrough = (s: string) => s;
  const obj: any = passThrough;
  obj.green = passThrough;
  obj.red = passThrough;
  obj.yellow = passThrough;
  obj.gray = passThrough;
  obj.bold = passThrough;
  obj.cyan = passThrough;
  return { __esModule: true, default: obj };
});

jest.mock('execa', () => ({
  execa: jest.fn()
}));

jest.mock('semver', () => ({
  __esModule: true,
  default: { lt: jest.fn((v: string, min: string) => {
    const major = parseInt(v.replace('v', '').split('.')[0], 10);
    const minMajor = parseInt(min.split('.')[0], 10);
    return major < minMajor;
  })}
}));

jest.mock('@/core/stack/manager', () => ({
  stackManager: { detectStack: jest.fn(() => undefined) }
}));

const { execa } = require('execa');
const { stackManager } = require('@/core/stack/manager');

describe('Doctor', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('diagnose()', () => {
    it('should run all checks and log results', async () => {
      (execa as jest.Mock).mockResolvedValue({ stdout: 'v20.0.0' });
      (stackManager.detectStack as jest.Mock).mockReturnValue(undefined);

      const doctor = new Doctor();
      await doctor.diagnose();

      // Should have console output for each check
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log success when all checks pass', async () => {
      (execa as jest.Mock).mockImplementation(async (cmd: string) => {
        if (cmd === 'node') return { stdout: 'v20.0.0' };
        if (cmd === 'git') return { stdout: 'git version 2.40.0' };
        return { stdout: '' };
      });
      (stackManager.detectStack as jest.Mock).mockReturnValue(undefined);

      const doctor = new Doctor();
      await doctor.diagnose();

      const { log } = require('@/utils/logger');
      expect(log.success).toHaveBeenCalledWith(expect.stringContaining('healthy'));
    });

    it('should log warning when a check fails', async () => {
      (execa as jest.Mock).mockImplementation(async (cmd: string) => {
        if (cmd === 'node') return { stdout: 'v16.0.0' }; // too old
        if (cmd === 'git') return { stdout: 'git version 2.40.0' };
        return { stdout: '' };
      });
      (stackManager.detectStack as jest.Mock).mockReturnValue(undefined);

      const doctor = new Doctor();
      await doctor.diagnose();

      const { log } = require('@/utils/logger');
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('issues'));
    });
  });
});

describe('NodeCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass when Node.js >= 18', async () => {
    (execa as jest.Mock).mockResolvedValue({ stdout: 'v20.0.0' });
    const check = new NodeCheck();
    const result = await check.run();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('v20.0.0');
  });

  it('should fail when Node.js < 18', async () => {
    (execa as jest.Mock).mockResolvedValue({ stdout: 'v16.0.0' });
    const check = new NodeCheck();
    const result = await check.run();
    expect(result.status).toBe('fail');
    expect(result.suggestion).toContain('upgrade');
  });

  it('should fail when Node.js is not installed', async () => {
    (execa as jest.Mock).mockRejectedValue(new Error('Command not found'));
    const check = new NodeCheck();
    const result = await check.run();
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not installed');
  });
});

describe('GitCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass when git is installed', async () => {
    (execa as jest.Mock).mockResolvedValue({ stdout: 'git version 2.40.0' });
    const check = new GitCheck();
    const result = await check.run();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('git version');
  });

  it('should fail when git is not installed', async () => {
    (execa as jest.Mock).mockRejectedValue(new Error('Command not found'));
    const check = new GitCheck();
    const result = await check.run();
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not installed');
  });
});

describe('StackEnvCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should skip when no stack detected', async () => {
    (stackManager.detectStack as jest.Mock).mockReturnValue(undefined);
    const check = new StackEnvCheck();
    const result = await check.run();
    expect(result.status).toBe('skip');
    expect(result.message).toContain('No specific stack');
  });

  it('should pass for cpp stack with cmake installed', async () => {
    (stackManager.detectStack as jest.Mock).mockReturnValue({ name: 'cpp' });
    (execa as jest.Mock).mockResolvedValue({ stdout: 'cmake version 3.20.0\n...' });
    const check = new StackEnvCheck();
    const result = await check.run();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('C++ Environment');
  });

  it('should fail for cpp stack without cmake', async () => {
    (stackManager.detectStack as jest.Mock).mockReturnValue({ name: 'cpp' });
    (execa as jest.Mock).mockRejectedValue(new Error('not found'));
    const check = new StackEnvCheck();
    const result = await check.run();
    expect(result.status).toBe('fail');
    expect(result.message).toContain('CMake not found');
  });

  it('should pass for python stack with python installed', async () => {
    (stackManager.detectStack as jest.Mock).mockReturnValue({ name: 'python' });
    (execa as jest.Mock).mockResolvedValue({ stdout: 'Python 3.11.0' });
    const check = new StackEnvCheck();
    const result = await check.run();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Python Environment');
  });

  it('should fail for python stack without python', async () => {
    (stackManager.detectStack as jest.Mock).mockReturnValue({ name: 'python' });
    (execa as jest.Mock).mockRejectedValue(new Error('not found'));
    const check = new StackEnvCheck();
    const result = await check.run();
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Python not found');
  });

  it('should pass for other stacks without specific checks', async () => {
    (stackManager.detectStack as jest.Mock).mockReturnValue({ name: 'typescript' });
    const check = new StackEnvCheck();
    const result = await check.run();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('typescript');
  });
});
