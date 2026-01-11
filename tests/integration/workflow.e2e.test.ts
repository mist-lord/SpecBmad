import fs from 'fs';
import path from 'path';
import { AgentFactory } from '@/agents/factory';
import { BaseAgent } from '@/agents/base/agent';
import { Orchestrator } from '@/core/workflow/orchestrator';
import { config } from '@/utils/config';
import { PATHS, getProjectPath } from '@/utils/paths';
import { AgentContext, AgentResult, LLMClient } from '@/types';

// FlakyAgent: 第一次调用指定 stepId 失败；若设置 retries，会在重试时成功
const attempts: Record<string, number> = {};
class FlakyAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super('Flaky', 'Flaky Test Agent', ['e2e'], llmClient);
  }
  async execute(context: AgentContext): Promise<AgentResult> {
    const stepId = String(context.projectState?.workflow?.currentStep || context.inputData?.stepId || 'unknown');
    attempts[stepId] = (attempts[stepId] || 0) + 1;
    // 仅第一次尝试失败
    if (attempts[stepId] === 1) {
      throw new Error(`Flaky step ${stepId} failed once`);
    }
    return {
      success: true,
      output: `OK ${stepId}`,
      artifacts: [],
      nextSteps: [],
      metadata: { agent: 'Flaky', mode: 'test' }
    };
  }
}

// 注册 Flaky 代理
if (!AgentFactory.has('Flaky')) {
  AgentFactory.register('Flaky', FlakyAgent as any);
}

// Mock LLM manager to avoid real API calls
jest.mock('@/core/llm/manager', () => {
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

const stateFile = getProjectPath(PATHS.WORKFLOW_STATE_FILE);

describe('E2E workflow resume & retry', () => {
  beforeAll(() => {
    // 直接写入到项目配置路径，确保工作流存在
    const altDir = path.dirname(getProjectPath(PATHS.CONFIG_FILE_ALT_JSON));
    const altPath = getProjectPath(PATHS.CONFIG_FILE_ALT_JSON);
    if (!fs.existsSync(altDir)) fs.mkdirSync(altDir, { recursive: true });
    let existing: any = {};
    if (fs.existsSync(altPath)) {
      try { existing = JSON.parse(fs.readFileSync(altPath, 'utf-8')); } catch { existing = {}; }
    }
    const merged = {
      ...existing,
      workflows: {
        ...(existing.workflows || {}),
        'e2e-flaky': {
          description: 'E2E: flaky first step, retry second',
          steps: [
            { id: 's1', name: 'Flaky-first-fails', agent: 'Flaky', input: { stepId: 's1', retries: 0 } },
            { id: 's2', name: 'Flaky-with-retry', agent: 'Flaky', input: { stepId: 's2', retries: 1, retryDelayMs: 1 } }
          ]
        }
      }
    };
    fs.writeFileSync(altPath, JSON.stringify(merged, null, 2), 'utf-8');

    // 清理状态文件
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  });

  afterAll(() => {
    // 清理状态文件，避免影响其他测试
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  });

  // 使用测试版 Orchestrator，避开配置 mock，直接返回测试工作流定义
  class TestOrchestrator extends Orchestrator {
    getWorkflowDefinition(name: string) {
      if (name === 'e2e-flaky') {
        return {
          name,
          description: 'E2E: flaky first step, retry second',
          steps: [
            { id: 's1', name: 'Flaky-first-fails', agent: 'Flaky', input: { stepId: 's1', retries: 0 } },
            { id: 's2', name: 'Flaky-with-retry', agent: 'Flaky', input: { stepId: 's2', retries: 1, retryDelayMs: 1 } }
          ]
        };
      }
      return super.getWorkflowDefinition(name);
    }
  }

  test('first run fails at s1 and persists state with resource sample', async () => {
    // 移除对 config.load 的依赖，直接使用 TestOrchestrator
    const orchestrator = new TestOrchestrator();
    const context: AgentContext = {
      projectState: { projectName: 'E2E', workflow: { currentStep: '', completedSteps: [] } },
      workingDirectory: process.cwd(),
      inputData: {}
    };

    let thrown: any = null;
    try {
      await orchestrator.executeWorkflow('e2e-flaky', context);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(fs.existsSync(stateFile)).toBe(true);
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    expect(s.status).toBe('failed');
    expect(s.currentStep).toBe('s1');
    expect(typeof s.lastError).toBe('string');
    expect(String(s.lastError)).toMatch(/Flaky step s1 failed once|failed/i);
    expect(Array.isArray(s.resourceSamples)).toBe(true);
    expect(s.resourceSamples.length).toBeGreaterThanOrEqual(1);
    const last = s.resourceSamples[s.resourceSamples.length - 1];
    expect(last.phase).toBe('persist');
    expect(last.stepId).toBe('s1');
    expect(last.memory).toBeDefined();
    expect(last.cpu).toBeDefined();
    expect(last.gc).toBeDefined();
  });

  test('second run resumes and completes, s2 uses retry', async () => {
    // 移除对 config.load 的依赖，直接使用 TestOrchestrator
    const orchestrator = new TestOrchestrator();
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    const context: AgentContext = {
      projectState: { projectName: 'E2E', workflow: { currentStep: '', completedSteps: s.completedSteps || [] } },
      workingDirectory: process.cwd(),
      inputData: {}
    };

    const results = await orchestrator.executeWorkflow('e2e-flaky', context);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);

    const finalState = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    expect(finalState.status).toBe('completed');
    expect(finalState.completedSteps).toEqual(['s1', 's2']);
    expect(finalState.resourceSamples.length).toBeGreaterThanOrEqual(2);
  });
});