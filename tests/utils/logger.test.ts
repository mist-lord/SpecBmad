import { log } from '../../src/utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('应该有基本的日志方法', () => {
    expect(typeof log.info).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.success).toBe('function');
  });

  test('info方法应该正常工作', () => {
    // 由于winston被模拟了，这里只测试方法是否存在和可调用
    expect(() => log.info('测试信息')).not.toThrow();
  });

  test('error方法应该正常工作', () => {
    expect(() => log.error('测试错误')).not.toThrow();
  });

  test('success方法应该正常工作', () => {
    expect(() => log.success('测试成功')).not.toThrow();
  });
});