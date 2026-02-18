jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() },
}));

jest.mock('@/utils/config', () => ({
  config: {
    load: jest.fn().mockReturnValue({}),
  },
}));

// Mock child_process to prevent actual Python execution
jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    on: jest.fn((event: string, cb: (...args: any[]) => void) => {
      if (event === 'close') setTimeout(() => cb(0), 0);
    }),
  }),
  spawnSync: jest.fn().mockReturnValue({ status: 0, error: null }),
}));

import { bmmCommand } from '@/commands/bmm';

describe('bmmCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bmmCommand.exitOverride();
  });

  it('should be a Command instance', () => {
    expect(bmmCommand).toBeDefined();
    expect(bmmCommand.name()).toBe('bmm');
  });

  it('should have expected options', () => {
    const optionNames = bmmCommand.options.map(o => o.long);
    expect(optionNames).toContain('--operation');
    expect(optionNames).toContain('--agent');
    expect(optionNames).toContain('--output');
    expect(optionNames).toContain('--verbose');
  });

  it('should have default operation value of analyze', () => {
    const opOption = bmmCommand.options.find(o => o.long === '--operation');
    expect(opOption?.defaultValue).toBe('analyze');
  });

  it('should have default agent value of BusinessAnalyst', () => {
    const agentOption = bmmCommand.options.find(o => o.long === '--agent');
    expect(agentOption?.defaultValue).toBe('BusinessAnalyst');
  });

  it('should warn when bmad_method is not enabled', async () => {
    const { config } = require('@/utils/config');
    config.load.mockReturnValue({ bmad_method: { enabled: false } });

    await bmmCommand.parseAsync(['node', 'test']);

    const { log } = require('@/utils/logger');
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('未启用'));
  });

  it('should warn when bmad_method is undefined', async () => {
    const { config } = require('@/utils/config');
    config.load.mockReturnValue({});

    await bmmCommand.parseAsync(['node', 'test']);

    const { log } = require('@/utils/logger');
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('未启用'));
  });

  it('should proceed when bmad_method is enabled', async () => {
    const { config } = require('@/utils/config');
    config.load.mockReturnValue({ bmad_method: { enabled: true } });

    const { spawn } = require('child_process');

    await bmmCommand.parseAsync(['node', 'test']);

    const { log } = require('@/utils/logger');
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('BMM'));
    expect(spawn).toHaveBeenCalled();
  });

  it('should pass --verbose flag when verbose option is set', async () => {
    const { config } = require('@/utils/config');
    config.load.mockReturnValue({ bmad_method: { enabled: true } });
    const { spawn } = require('child_process');

    await bmmCommand.parseAsync(['node', 'test', '--verbose']);

    const spawnArgs = spawn.mock.calls[0][1];
    expect(spawnArgs).toContain('--verbose');
  });

  it('should fall back to python3 when python check fails', async () => {
    const { config } = require('@/utils/config');
    config.load.mockReturnValue({ bmad_method: { enabled: true } });
    const { spawn, spawnSync } = require('child_process');
    spawnSync.mockReturnValue({ status: 1, error: new Error('not found') });

    await bmmCommand.parseAsync(['node', 'test']);

    expect(spawn.mock.calls[0][0]).toBe('python3');
  });

  it('should log error when process exits with non-zero code', async () => {
    const { config } = require('@/utils/config');
    config.load.mockReturnValue({ bmad_method: { enabled: true } });
    const { spawn } = require('child_process');
    const { log } = require('@/utils/logger');

    spawn.mockReturnValue({
      on: jest.fn((event: string, cb: (...args: any[]) => void) => {
        if (event === 'close') setTimeout(() => cb(1), 0);
      }),
    });

    await bmmCommand.parseAsync(['node', 'test']);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('退出码'));
  });

  it('should handle process error event', async () => {
    const { config } = require('@/utils/config');
    config.load.mockReturnValue({ bmad_method: { enabled: true } });
    const { spawn } = require('child_process');
    const { log } = require('@/utils/logger');

    spawn.mockReturnValue({
      on: jest.fn((event: string, cb: (...args: any[]) => void) => {
        if (event === 'error') setTimeout(() => cb(new Error('spawn failed')), 0);
      }),
    });

    await bmmCommand.parseAsync(['node', 'test']);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining('出错'),
      expect.stringContaining('spawn failed')
    );
  });
});
