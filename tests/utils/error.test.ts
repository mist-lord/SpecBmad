import { CliError, handleError } from '../../src/utils/error';

// Mock logger to capture outputs
jest.mock('../../src/utils/logger', () => {
  return {
    log: {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      success: jest.fn(),
      fail: jest.fn(),
      progress: jest.fn(),
    }
  };
});

import { log } from '../../src/utils/logger';

describe('utils/error handleError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handles CliError with code and hint', () => {
    const err = new CliError('E001', '发生错误', '检查配置文件路径');
    handleError(err, { command: 'tasks', phase: 'run' });
    expect((log.error as any)).toHaveBeenCalledWith('(E001) 发生错误');
    expect((log.warn as any)).toHaveBeenCalled();
  });

  test('handles native Error with optional command prefix', () => {
    const err = new Error('boom');
    handleError(err, { command: 'workflow' });
    expect((log.error as any)).toHaveBeenCalledWith('[workflow] boom');
  });

  test('handles unknown error types', () => {
    const err: any = 12345;
    handleError(err);
    expect((log.error as any)).toHaveBeenCalledWith('未知错误: 12345');
  });
});