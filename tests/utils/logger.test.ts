import { log, logger } from '../../src/utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should have all basic log methods', () => {
    expect(typeof log.info).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.success).toBe('function');
    expect(typeof log.fail).toBe('function');
    expect(typeof log.progress).toBe('function');
  });

  test('info should not throw', () => {
    expect(() => log.info('test info')).not.toThrow();
  });

  test('error should not throw', () => {
    expect(() => log.error('test error')).not.toThrow();
  });

  test('success should not throw', () => {
    expect(() => log.success('test success')).not.toThrow();
  });

  test('fail should not throw', () => {
    expect(() => log.fail('test fail')).not.toThrow();
  });

  test('progress should not throw', () => {
    expect(() => log.progress('test progress')).not.toThrow();
  });

  test('warn should not throw', () => {
    expect(() => log.warn('test warn')).not.toThrow();
  });

  test('debug should not throw', () => {
    expect(() => log.debug('test debug')).not.toThrow();
  });

  test('log methods accept metadata', () => {
    expect(() => log.info('with meta', { key: 'value' })).not.toThrow();
    expect(() => log.error('with meta', { code: 500 })).not.toThrow();
  });

  test('logger default export is a winston logger', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});