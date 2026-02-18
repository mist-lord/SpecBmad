import { AnalystAgent } from '@/agents/analyst';
import { LLMClient } from '@/types';
import { createMockLLMClient } from '@/core/llm';
import { LLMClientFactory } from '@/core/llm/base';
import { createTestAgentContext, assertAgentResultValid } from './agent-test-utils';

jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() }
}));

jest.mock('@/core/llm/cache', () => ({
  llmCache: { makeKey: jest.fn(() => ''), get: jest.fn(() => null), set: jest.fn() }
}));

const mockProposal = {
  id: 'prop-1',
  title: 'Add authentication',
  description: 'Implement OAuth2 authentication flow'
};

jest.mock('@/core/change/manager', () => ({
  changeManager: {
    getProposal: jest.fn((id: string) => id === 'prop-1' ? mockProposal : undefined)
  }
}));

describe('AnalystAgent', () => {
  let agent: AnalystAgent;
  let mockClient: LLMClient;

  beforeEach(() => {
    jest.clearAllMocks();
    LLMClientFactory.clear();
    mockClient = createMockLLMClient('Mock');
    LLMClientFactory.register(mockClient);
    agent = new AnalystAgent(mockClient);
  });

  describe('constructor', () => {
    it('should initialize with correct name and role', () => {
      expect(agent.name).toBe('Analyst');
      expect(agent.role).toBe('Business Analyst');
    });

    it('should have 5 capabilities', () => {
      expect(agent.capabilities).toHaveLength(5);
      expect(agent.capabilities).toContain('requirement-analysis');
      expect(agent.capabilities).toContain('stakeholder-analysis');
      expect(agent.capabilities).toContain('risk-identification');
      expect(agent.capabilities).toContain('user-story-creation');
      expect(agent.capabilities).toContain('change-impact-analysis');
    });
  });

  describe('execute() - analysis modes', () => {
    it('should default to brief mode', async () => {
      const ctx = createTestAgentContext();
      const result = await agent.execute(ctx);
      assertAgentResultValid(result);
      expect(result.metadata?.mode).toBe('brief');
    });

    it('should execute in brief mode', async () => {
      const ctx = createTestAgentContext({ mode: 'brief' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.mode).toBe('brief');
    });

    it('should execute in comprehensive mode', async () => {
      const ctx = createTestAgentContext({ mode: 'comprehensive' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.mode).toBe('comprehensive');
    });

    it('should execute in brainstorm mode', async () => {
      const ctx = createTestAgentContext({ mode: 'brainstorm' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.mode).toBe('brainstorm');
    });

    it('should execute in risk mode', async () => {
      const ctx = createTestAgentContext({ mode: 'risk' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.mode).toBe('risk');
    });

    it('should execute in research mode', async () => {
      const ctx = createTestAgentContext({ mode: 'research' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.mode).toBe('research');
    });

    it('should fall back to brief prompt for unknown mode', async () => {
      const ctx = createTestAgentContext({ mode: 'unknown-mode' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
    });

    it('should include agent name in metadata', async () => {
      const ctx = createTestAgentContext({ mode: 'brief' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.agent).toBe('Analyst');
    });

    it('should include metrics in metadata', async () => {
      const ctx = createTestAgentContext({ mode: 'brief' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.metrics).toBeDefined();
    });

    it('should return empty artifacts', async () => {
      const ctx = createTestAgentContext({ mode: 'brief' });
      const result = await agent.execute(ctx);
      expect(result.artifacts).toEqual([]);
    });
  });

  describe('execute() - proposal analysis', () => {
    it('should analyze a valid proposal', async () => {
      const ctx = createTestAgentContext({ proposalId: 'prop-1' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.mode).toBe('proposal-analysis');
      expect(result.metadata?.proposalId).toBe('prop-1');
    });

    it('should throw for non-existent proposal', async () => {
      const ctx = createTestAgentContext({ proposalId: 'non-existent' });
      await expect(agent.execute(ctx)).rejects.toThrow('无法分析：提案 non-existent 不存在');
    });

    it('should prioritize proposalId over mode', async () => {
      const ctx = createTestAgentContext({ proposalId: 'prop-1', mode: 'comprehensive' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.mode).toBe('proposal-analysis');
    });
  });

  describe('extractNextSteps()', () => {
    it('should extract steps with keyword markers', async () => {
      // The extractNextSteps is protected, test via execute
      const spy = jest.spyOn(mockClient, 'generateText').mockResolvedValue(
        '## Analysis\n- 建议优化架构\n- 行动：创建原型\n- Some other line\n- 步骤一：需求确认'
      );
      const ctx = createTestAgentContext({ mode: 'brief' });
      const result = await agent.execute(ctx);
      expect(result.nextSteps).toBeDefined();
      // Should only include lines with keywords
      expect(result.nextSteps!.length).toBeGreaterThanOrEqual(1);
      spy.mockRestore();
    });

    it('should extract numbered list items with keywords', async () => {
      const spy = jest.spyOn(mockClient, 'generateText').mockResolvedValue(
        '## Plan\n1) Next step: review code\n2) 建议增加测试\n3) Regular line'
      );
      const ctx = createTestAgentContext({ mode: 'brief' });
      const result = await agent.execute(ctx);
      expect(result.nextSteps!.length).toBeGreaterThanOrEqual(1);
      spy.mockRestore();
    });

    it('should limit to 10 next steps', async () => {
      const lines = Array.from({ length: 15 }, (_, i) => `- 建议 ${i + 1}`).join('\n');
      const spy = jest.spyOn(mockClient, 'generateText').mockResolvedValue(lines);
      const ctx = createTestAgentContext({ mode: 'brief' });
      const result = await agent.execute(ctx);
      expect(result.nextSteps!.length).toBeLessThanOrEqual(10);
      spy.mockRestore();
    });
  });

  describe('registerAnalystAgent()', () => {
    it('should register Analyst in AgentFactory', () => {
      const { AgentFactory } = require('@/agents/factory');
      AgentFactory.clear();
      const { registerAnalystAgent } = require('@/agents/analyst');
      registerAnalystAgent();
      expect(AgentFactory.has('Analyst')).toBe(true);
    });

    it('should not re-register if already exists', () => {
      const { AgentFactory } = require('@/agents/factory');
      AgentFactory.clear();
      const { registerAnalystAgent } = require('@/agents/analyst');
      registerAnalystAgent();
      registerAnalystAgent(); // second call should not throw
      expect(AgentFactory.has('Analyst')).toBe(true);
    });
  });
});
