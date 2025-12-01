import { BaseAgent } from '../../src/agents/base/agent';
import { AgentContext, AgentResult, LLMClient, AgentType } from '../../src/types';
import { createMockLLMClient } from '../../src/core/llm/mock';
import { LLMClientFactory, BaseLLMClient } from '../../src/core/llm/base';

class TestAgent extends BaseAgent {
  constructor(llm: LLMClient) {
    super('TestAgent', 'Tester', ['testing'], llm);
  }
  async execute(context: AgentContext): Promise<AgentResult> {
    const output = await this.generateResponse('return well-structured markdown', context, { model: 'mock-1' } as any);
    return { success: true, output, metadata: { agent: 'TestAgent' } } as any;
  }
}

class FailingLLMClient extends BaseLLMClient {
  constructor() { super('Failing', AgentType.CUSTOM); }
  async isAvailable(): Promise<boolean> { return true; }
  async generateText(_prompt: string, _options?: any): Promise<string> { throw new Error('fail'); }
  async generateStructured<T>(_prompt: string, _schema: any, _options?: any): Promise<T> { throw new Error('fail'); }
}

describe('BaseAgent generateResponse', () => {
  beforeEach(() => {
    LLMClientFactory.clear();
  });

  test('caches responses and returns from cache on subsequent calls', async () => {
    const client = createMockLLMClient('Mock');
    LLMClientFactory.register(client);
    const agent = new TestAgent(client);

    const ctx: AgentContext = { projectState: { projectName: 'X', workflow: { currentStep: 's1', completedSteps: [] } }, workingDirectory: process.cwd(), inputData: {} } as any;

    const spy = jest.spyOn(client, 'generateText');

    const r1 = await agent.execute(ctx);
    expect(r1.output).toContain('Sprint Planning Summary');
    expect(spy).toHaveBeenCalledTimes(1);

    const r2 = await agent.execute(ctx);
    expect(r2.output).toContain('Sprint Planning Summary');
    // Second call should come from cache and not call generateText again
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('falls back to Mock client when primary fails repeatedly', async () => {
    const mock = createMockLLMClient('Mock');
    LLMClientFactory.register(mock);

    const failing = new FailingLLMClient();
    const agent = new TestAgent(failing as unknown as LLMClient);

    const ctx: AgentContext = { projectState: { projectName: 'Y', workflow: { currentStep: 's2', completedSteps: [] } }, workingDirectory: process.cwd(), inputData: {} } as any;
    const result = await agent.execute(ctx);
    expect(result.output).toMatch(/Mocked response|Next Actions|创建任务列表并排期/);
  });
});