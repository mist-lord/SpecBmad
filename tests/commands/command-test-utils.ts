/**
 * 共享的Command测试工具
 *
 * 提供可复用的mock工厂、测试fixtures和常用断言
 *
 * @see tests/commands/go.command.test.ts - 参考实现
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MockLLMClient } from '@/core/llm/clients/mock';

/**
 * Mock chalk避免颜色格式问题
 */
export function mockChalk() {
  return {
    cyan: Object.assign(jest.fn((s: string) => s), { bold: jest.fn((s: string) => s) }),
    yellow: Object.assign(jest.fn((s: string) => s), { bold: jest.fn((s: string) => s) }),
    green: Object.assign(jest.fn((s: string) => s), { bold: jest.fn((s: string) => s) }),
    gray: jest.fn((s: string) => s),
    red: jest.fn((s: string) => s),
    blue: jest.fn((s: string) => s),
    magenta: jest.fn((s: string) => s),
  };
}

/**
 * Mock logger (info, error, debug, success, warn)
 */
export function mockLogger() {
  return {
    log: {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      success: jest.fn(),
      warn: jest.fn(),
    },
  };
}

/**
 * Mock PerfTracer
 */
export function mockPerfTracer() {
  return {
    PerfTracer: jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      end: jest.fn().mockReturnValue({ durationMs: 100 }),
    })),
  };
}

/**
 * Mock error handler
 */
export function mockErrorHandler() {
  return {
    handleError: jest.fn(),
  };
}

/**
 * Mock auto-init utilities
 */
export function mockAutoInit() {
  return {
    ensureProjectInitialized: jest.fn().mockResolvedValue(undefined),
    autoConfigureLLM: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Mock config manager
 */
export function mockConfig() {
  const mockConfigData = {
    projectName: 'test-project',
    version: '1.0.0',
    type: 'web',
    llm: {
      provider: 'mock',
      model: 'mock-1',
    },
  };

  return {
    config: {
      load: jest.fn(),
      save: jest.fn(),
      get: jest.fn((key: string) => (mockConfigData as any)[key]),
      getAll: jest.fn(() => mockConfigData),
      set: jest.fn(),
    },
  };
}

/**
 * 创建可控的Mock LLM Client
 * @param responses 自定义响应映射 { promptKeyword: response }
 */
export function createMockLLMClient(responses?: Record<string, string>) {
  const client = new MockLLMClient('test-mock');

  if (responses) {
    // 如果提供了自定义响应，override generateText
    const originalGenerate = client.generateText.bind(client);
    client.generateText = jest.fn(async (prompt: string, options?: any) => {
      const matchingKey = Object.keys(responses).find((key) =>
        prompt.toLowerCase().includes(key.toLowerCase())
      );
      if (matchingKey) {
        return responses[matchingKey];
      }
      return originalGenerate(prompt, options);
    });
  }

  return client;
}

/**
 * Mock LLM Manager
 * @param customClient 自定义LLM客户端（如果不提供则使用默认MockLLMClient）
 */
export function mockLLMManager(customClient?: any) {
  const fakeClient = customClient || createMockLLMClient();

  return {
    llmManager: {
      initialize: jest.fn().mockResolvedValue(undefined),
      getDefaultClient: jest.fn().mockReturnValue(fakeClient),
      addClient: jest.fn(),
      reset: jest.fn(),
      listClients: jest.fn().mockReturnValue([fakeClient]),
    },
  };
}

/**
 * Mock Orchestrator
 */
export function mockOrchestrator() {
  const mockResults = {
    steps: [
      { name: 'Phase 0: Specification', status: 'completed', duration: 100 },
      { name: 'Phase 1: Architecture', status: 'completed', duration: 150 },
    ],
    summary: 'Workflow completed successfully',
  };

  return {
    Orchestrator: jest.fn().mockImplementation(() => ({
      executeWorkflow: jest.fn().mockResolvedValue(mockResults),
      executePhaseWorkflow: jest.fn().mockResolvedValue(mockResults),
      executeWithRetry: jest.fn().mockResolvedValue(mockResults),
    })),
  };
}

/**
 * Mock PhaseController
 */
export function mockPhaseController() {
  return {
    PhaseController: jest.fn().mockImplementation(() => ({
      getCurrentPhase: jest.fn().mockReturnValue(0),
      transitionTo: jest.fn().mockResolvedValue(true),
      canTransition: jest.fn().mockReturnValue(true),
      getPhaseConfig: jest.fn().mockReturnValue({
        name: 'Specification',
        description: 'Define requirements',
        gates: [],
      }),
    })),
    phaseController: {
      getCurrentPhase: jest.fn().mockReturnValue(0),
      transitionTo: jest.fn().mockResolvedValue(true),
      canTransition: jest.fn().mockReturnValue(true),
    },
  };
}

/**
 * Mock EventStore
 */
export function mockEventStore() {
  return {
    EventStore: jest.fn().mockImplementation(() => ({
      record: jest.fn(),
      query: jest.fn().mockReturnValue([]),
      clear: jest.fn(),
    })),
    eventStore: {
      record: jest.fn(),
      query: jest.fn().mockReturnValue([]),
    },
  };
}

/**
 * Mock SpecKit
 */
export function mockSpecKit() {
  return {
    SpecKit: jest.fn().mockImplementation(() => ({
      generate: jest.fn().mockResolvedValue({
        spec: 'Generated spec content',
        path: '/spec/intent.yaml',
      }),
      validate: jest.fn().mockReturnValue(true),
    })),
  };
}

/**
 * Mock AgentFactory
 */
export function mockAgentFactory() {
  return {
    AgentFactory: {
      register: jest.fn(),
      create: jest.fn().mockReturnValue({
        name: 'TestAgent',
        execute: jest.fn().mockResolvedValue({
          success: true,
          output: 'Agent execution result',
        }),
      }),
    },
  };
}

/**
 * 创建临时测试目录
 * @param prefix 目录前缀
 * @returns 临时目录路径（记得在afterAll中清理）
 */
export function createTempDir(prefix: string = 'specbmad-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * 清理临时目录
 * @param dirPath 要清理的目录路径
 */
export function cleanupTempDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * 创建测试fixtures（常用的测试数据结构）
 */
export const testFixtures = {
  /**
   * 有效的AgentContext
   */
  validAgentContext: {
    workingDirectory: process.cwd(),
    projectState: {
      projectName: 'test-project',
      workflow: {
        currentStep: 'Phase 0',
        completedSteps: [],
      },
    },
    inputData: {
      requirement: 'Build a todo app',
    },
  },

  /**
   * 有效的WorkflowOptions
   */
  validWorkflowOptions: {
    name: 'full-development',
    format: 'markdown' as const,
    output: undefined,
    reportDir: undefined,
    phase: false,
    startPhase: 0,
    endPhase: 3,
  },

  /**
   * 有效的PhaseOptions
   */
  validPhaseOptions: {
    phase: 0,
    force: false,
    validate: true,
  },
};

/**
 * 断言辅助函数：验证文件是否存在且包含内容
 */
export function assertFileContains(filePath: string, expectedContent: string): void {
  expect(fs.existsSync(filePath)).toBe(true);
  const content = fs.readFileSync(filePath, 'utf-8');
  expect(content).toContain(expectedContent);
}

/**
 * 断言辅助函数：验证目录结构
 */
export function assertDirectoryStructure(basePath: string, expectedDirs: string[]): void {
  for (const dir of expectedDirs) {
    const fullPath = path.join(basePath, dir);
    expect(fs.existsSync(fullPath)).toBe(true);
    expect(fs.statSync(fullPath).isDirectory()).toBe(true);
  }
}

/**
 * 等待异步操作完成的辅助函数
 * @param ms 等待毫秒数
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
