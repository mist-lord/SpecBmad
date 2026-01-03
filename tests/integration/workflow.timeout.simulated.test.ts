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

// TimeoutAgent：模拟超时异常（通过抛错实现）
class TimeoutAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super('TimeoutAgent', 'Timeout Simulated Agent', ['timeout'], llmClient);
  }
  async execute(context: AgentContext): Promise<AgentResult> {
    const stepId = String(context.projectState?.workflow?.currentStep || context.inputData?.stepId || 'unknown');
    throw new Error(`Timeout simulated for step ${stepId}`);
  }
}

// 注册 TimeoutAgent 代理
if (!AgentFactory.has('TimeoutAgent')) {
  AgentFactory.register('TimeoutAgent', TimeoutAgent as any);
}

// 使用 mocked 配置模块返回自定义工作流定义
const mockedConfig = require('@/utils/config').config;
const testWorkflowConfig = {
  workflows: {
    'timeout-simulated': {
      description: 'Simulate timeout on first step',
      steps: [
        { id: 't1', name: 'Timeout-first', agent: 'TimeoutAgent', input: { stepId: 't1', retries: 0 } }
      ]
    }
  }
};

const stateFile = getProjectPath(PATHS.WORKFLOW_STATE_FILE);

describe('Simulated timeout workflow', () => {
  beforeAll(() => {
    mockedConfig.getAll.mockReturnValue(testWorkflowConfig);
    mockedConfig.get.mockImplementation((key: string) => (testWorkflowConfig as any)[key]);
    mockedConfig.load.mockReturnValue(testWorkflowConfig);
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  });

  afterAll(() => {
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  });

  test('first run fails at t1 and persists state', async () => {
    let thrown: any = null;
    try {
      await workflowCommand({ name: 'timeout-simulated', format: 'json', reportDir: PATHS.ARTIFACTS_DIR } as any);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(String(thrown.message || thrown)).toMatch(/Timeout simulated/);
    expect(fs.existsSync(stateFile)).toBe(true);
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    expect(s.status).toBe('failed');
    expect(s.currentStep).toBe('t1');
    expect(String(s.lastError)).toMatch(/Timeout simulated/);
  });
});