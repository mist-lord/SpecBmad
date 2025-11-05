// 测试环境设置
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error';

// 模拟chalk模块
jest.mock('chalk', () => {
  const mockChalk = {
    blue: jest.fn((text: string) => text),
    green: jest.fn((text: string) => text),
    yellow: jest.fn((text: string) => text),
    red: jest.fn((text: string) => text),
    gray: jest.fn((text: string) => text),
    bold: jest.fn((text: string) => text)
  };
  return {
    default: mockChalk,
    ...mockChalk
  };
});

// 模拟winston模块
jest.mock('winston', () => ({
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    printf: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    simple: jest.fn(() => ({}))
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn()
  })),
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// 模拟配置模块
jest.mock('@/utils/config', () => ({
  config: {
    load: jest.fn(() => ({})),
    save: jest.fn(),
    get: jest.fn(),
    set: jest.fn()
  }
}));

// 全局测试设置
beforeEach(() => {
  jest.clearAllMocks();
});

// 设置测试超时
jest.setTimeout(10000);