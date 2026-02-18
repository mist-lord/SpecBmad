import { log, logger } from '@/utils/logger';

describe('Logger - Convenience Methods', () => {
  let infoSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(logger, 'info').mockImplementation();
    errorSpy = jest.spyOn(logger, 'error').mockImplementation();
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
    debugSpy = jest.spyOn(logger, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('basic methods', () => {
    it('log.info should call logger.info', () => {
      log.info('test message');
      expect(infoSpy).toHaveBeenCalledWith('test message', undefined);
    });

    it('log.error should call logger.error', () => {
      log.error('error message');
      expect(errorSpy).toHaveBeenCalledWith('error message', undefined);
    });

    it('log.warn should call logger.warn', () => {
      log.warn('warning');
      expect(warnSpy).toHaveBeenCalledWith('warning', undefined);
    });

    it('log.debug should call logger.debug', () => {
      log.debug('debug info');
      expect(debugSpy).toHaveBeenCalledWith('debug info', undefined);
    });
  });

  describe('convenience methods with prefixes', () => {
    it('log.success should call logger.info with green checkmark', () => {
      log.success('operation done');
      expect(infoSpy).toHaveBeenCalled();
      const msg = infoSpy.mock.calls[0][0];
      expect(msg).toContain('✓');
      expect(msg).toContain('operation done');
    });

    it('log.fail should call logger.error with red X', () => {
      log.fail('operation failed');
      expect(errorSpy).toHaveBeenCalled();
      const msg = errorSpy.mock.calls[0][0];
      expect(msg).toContain('✗');
      expect(msg).toContain('operation failed');
    });

    it('log.progress should call logger.info with hourglass', () => {
      log.progress('loading...');
      expect(infoSpy).toHaveBeenCalled();
      const msg = infoSpy.mock.calls[0][0];
      expect(msg).toContain('⏳');
      expect(msg).toContain('loading...');
    });
  });

  describe('metadata passing', () => {
    it('should pass metadata to logger methods', () => {
      const meta = { duration: 100 };
      log.info('with meta', meta);
      expect(infoSpy).toHaveBeenCalledWith('with meta', meta);
    });

    it('should pass metadata to error', () => {
      const meta = { code: 'ERR_001' };
      log.error('error with meta', meta);
      expect(errorSpy).toHaveBeenCalledWith('error with meta', meta);
    });

    it('should pass metadata to success', () => {
      const meta = { count: 5 };
      log.success('done', meta);
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('done'), meta);
    });
  });
});

describe('Logger - Configuration', () => {
  it('should export logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should export all 7 convenience methods', () => {
    expect(typeof log.info).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.success).toBe('function');
    expect(typeof log.fail).toBe('function');
    expect(typeof log.progress).toBe('function');
  });

  it('should not throw when calling any method', () => {
    const spy = jest.spyOn(logger, 'info').mockImplementation();
    const errSpy = jest.spyOn(logger, 'error').mockImplementation();
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
    const debugSpy = jest.spyOn(logger, 'debug').mockImplementation();

    expect(() => log.info('test')).not.toThrow();
    expect(() => log.error('test')).not.toThrow();
    expect(() => log.warn('test')).not.toThrow();
    expect(() => log.debug('test')).not.toThrow();
    expect(() => log.success('test')).not.toThrow();
    expect(() => log.fail('test')).not.toThrow();
    expect(() => log.progress('test')).not.toThrow();

    spy.mockRestore();
    errSpy.mockRestore();
    warnSpy.mockRestore();
    debugSpy.mockRestore();
  });
});
