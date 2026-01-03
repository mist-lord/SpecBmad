import { BaseAgent } from '@/agents/base/agent';
import { AgentContext, AgentResult, AgentType, LLMClient, LLMOptions } from '@/types';
import { LLMClientFactory } from '@/core/llm/base';
import { createMockLLMClient } from '@/core/llm/mock';

class FailingLLM implements LLMClient {
  name = 'Failing';
  type = AgentType.CUSTOM;
  async isAvailable(): Promise<boolean> { return true; }
  async generateText(_prompt: string, _options?: LLMOptions): Promise<string> {
    throw new Error('Simulated failure');
  }
  async generateStructured<T>(_prompt: string, _schema: any, _options?: LLMOptions): Promise<T> {
    throw new Error('Simulated failure');
  }
}

class DummyAgent extends BaseAgent {
  constructor(llm: LLMClient) {
    super('DummyAgent', 'tester', ['testing'], llm);
  }
  async execute(context: AgentContext): Promise<AgentResult> {
    const output = await this.generateResponse('Return well-structured markdown with next steps', context, { model: 'mock-1' });
    return { success: true, output, artifacts: [], nextSteps: this.extractNextSteps(output) };
  }
}

describe('BaseAgent retry & fallback', () => {
  beforeAll(() => {
    // 注册 Mock 客户端用于回退
    const mock = createMockLLMClient('Mock');
    LLMClientFactory.register(mock);
  });

  it('falls back to Mock when primary LLM fails after retries', async () => {
    const failing = new FailingLLM();
    const agent = new DummyAgent(failing);
    const context: AgentContext = {
      projectState: { projectName: 'SpecBmad', workflow: { currentStep: 'test', completedSteps: [] } },
      workingDirectory: process.cwd()
    };

    const result = await agent.execute(context);
    expect(result.success).toBe(true);
    expect(typeof result.output).toBe('string');
    // Mock 客户端默认包含列表项，验证回退产生的合理输出
    expect(result.nextSteps && result.nextSteps.length).toBeGreaterThan(0);
  });
});