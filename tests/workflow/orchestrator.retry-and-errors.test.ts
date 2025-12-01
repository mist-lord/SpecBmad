import { Orchestrator } from '../../src/workflow/orchestrator';
import { AgentContext, AgentResult } from '../../src/types';

// Mock LLM manager to avoid real API calls
jest.mock('../../src/core/llm/manager', () => {
  const fakeClient = {
    name: 'test-llm',
    type: 'custom',
    isAvailable: jest.fn().mockResolvedValue(true),
    generateText: jest.fn().mockResolvedValue('OK')
  };
  return {
    llmManager: {
      initialize: jest.fn().mockResolvedValue(undefined),
      getDefaultClient: jest.fn().mockReturnValue(fakeClient)
    }
  };
});

describe('Orchestrator error branches and retry paths', () => {
  test('executeWorkflow throws on empty steps', async () => {
    const orch = new Orchestrator();
    const ctx: AgentContext = { projectState: { projectName: 'X', workflow: { currentStep: '', completedSteps: [] } }, workingDirectory: process.cwd(), inputData: {} } as any;
    await expect(orch.executeWorkflow('no-such', ctx)).rejects.toThrow(/工作流未定义或为空/);
  });

  test('resolveExecutionOrder throws for missing dependency', () => {
    const orch: any = new Orchestrator();
    const steps = [
      { id: 'a', name: 'A', agent: 'ScrumMaster', dependencies: ['b'] }
    ];
    expect(() => orch.resolveExecutionOrder(steps)).toThrow(/依赖不存在/);
  });

  test('resolveExecutionOrder detects cycle or unsatisfied deps', () => {
    const orch: any = new Orchestrator();
    const steps = [
      { id: 'a', name: 'A', agent: 'ScrumMaster', dependencies: ['b'] },
      { id: 'b', name: 'B', agent: 'ScrumMaster', dependencies: ['a'] }
    ];
    expect(() => orch.resolveExecutionOrder(steps)).toThrow(/工作流依赖无法满足/);
  });

  test('executeWithRetry succeeds after a failure', async () => {
    const orch: any = new Orchestrator();
    let first = true;
    const agent = {
      async execute(_ctx: AgentContext): Promise<AgentResult> {
        if (first) { first = false; throw new Error('transient'); }
        return { success: true, output: 'done', metadata: { agent: 'ScrumMaster' } } as any;
      }
    };
    const ctx: AgentContext = { projectState: { projectName: 'X', workflow: { currentStep: '', completedSteps: [] } }, workingDirectory: process.cwd(), inputData: {} } as any;
    const step = { id: 's1', name: 'S1', agent: 'ScrumMaster', input: { retries: 2, retryDelayMs: 1 } } as any;
    const res = await orch.executeWithRetry(agent, ctx, step);
    expect(res.success).toBe(true);
    expect(res.output).toBe('done');
  });

  test('executeWithRetry throws after exhausting retries', async () => {
    const orch: any = new Orchestrator();
    const agent = {
      async execute(_ctx: AgentContext): Promise<AgentResult> {
        throw new Error('always');
      }
    };
    const ctx: AgentContext = { projectState: { projectName: 'X', workflow: { currentStep: '', completedSteps: [] } }, workingDirectory: process.cwd(), inputData: {} } as any;
    const step = { id: 's1', name: 'S1', agent: 'ScrumMaster', input: { retries: 1, retryDelayMs: 1 } } as any;
    await expect(orch.executeWithRetry(agent, ctx, step)).rejects.toThrow(/always/);
  });
});