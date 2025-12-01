import fs from 'fs';
import path from 'path';
import { BaseAgent } from '../src/agents/base/agent';
import { AgentFactory } from '../src/agents/factory';
import { AgentContext, AgentResult, LLMClient } from '../src/types';
import { workflowCommand } from '../src/commands/workflow';
import { PATHS, getProjectPath } from '../src/utils/paths';

// Mock LLM manager to avoid real API calls
jest.mock('../src/core/llm/manager', () => {
  const fakeClient = {
    name: 'test-llm',
    type: 'custom',
    isAvailable: jest.fn().mockResolvedValue(true),
    generateText: jest.fn().mockResolvedValue('OK')
  };
  return {
    llmManager: {
      initialize: jest.fn().mockResolvedValue(undefined),
      getDefaultClient: jest.fn().mockReturnValue(fakeClient),
      addClient: jest.fn(),
      reset: jest.fn()
    }
  };
});

// FailOnce 代理：每个 stepId 的第一次调用失败，之后成功
const attempts: Record<string, number> = {};
class FailOnceAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super('FailOnce', 'Fail Once Test Agent', ['resume'], llmClient);
  }
  async execute(context: AgentContext): Promise<AgentResult> {
    const stepId = String(context.projectState?.workflow?.currentStep || context.inputData?.stepId || 'unknown');
    attempts[stepId] = (attempts[stepId] || 0) + 1;
    if (attempts[stepId] === 1) {
      throw new Error(`FailOnce for step ${stepId}`);
    }
    return {
      success: true,
      output: `OK ${stepId}`,
      artifacts: [],
      nextSteps: [],
      metadata: { agent: 'FailOnce', mode: 'test' }
    };
  }
}

// 注册 FailOnce 代理
if (!AgentFactory.has('FailOnce')) {
  AgentFactory.register('FailOnce', FailOnceAgent as any);
}

// 使用 mocked 配置模块返回自定义工作流定义
const mockedConfig = require('@/utils/config').config;
const testWorkflowConfig = {
  workflows: {
    'resume-flaky': {
      description: 'Resume flaky workflow: s1 fails once, s2 retries',
      steps: [
        { id: 's1', name: 'FailOnce-first', agent: 'FailOnce', input: { stepId: 's1', retries: 0 } },
        { id: 's2', name: 'FailOnce-retry', agent: 'FailOnce', input: { stepId: 's2', retries: 1, retryDelayMs: 1 } }
      ]
    }
  }
};

const stateFile = getProjectPath(PATHS.WORKFLOW_STATE_FILE);

describe('CLI resume for workflowCommand', () => {
  beforeAll(() => {
    // 提供自定义配置给被测代码
    mockedConfig.getAll.mockReturnValue(testWorkflowConfig);
    mockedConfig.get.mockImplementation((key: string) => (testWorkflowConfig as any)[key]);
    mockedConfig.load.mockReturnValue(testWorkflowConfig);
    // 清理状态文件
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  });

  afterAll(() => {
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  });

  test('first run fails at s1 and persists state', async () => {
    let thrown: any = null;
    try {
      await workflowCommand({ name: 'resume-flaky', format: 'json', reportDir: PATHS.ARTIFACTS_DIR } as any);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(fs.existsSync(stateFile)).toBe(true);
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    expect(s.status).toBe('failed');
    expect(s.currentStep).toBe('s1');
    expect(typeof s.lastError).toBe('string');
    expect(String(s.lastError)).toMatch(/FailOnce for step s1|failed/i);
  });

  test('second run resumes and completes s1+s2', async () => {
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    expect(Array.isArray(s.completedSteps)).toBe(true);
    // resume 执行
    await workflowCommand({ name: 'resume-flaky', format: 'json', reportDir: path.join(process.cwd(), '.bmad'), resume: true } as any);
    const final = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    expect(final.status).toBe('completed');
    // 只包含 s1、s2 两步
    expect(final.completedSteps).toEqual(['s1', 's2']);
  });
});