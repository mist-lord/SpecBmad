import { ScrumMasterAgent } from '@/agents/scrum-master';
import { LLMClient, AgentType } from '@/types';
import { createMockLLMClient } from '@/core/llm';
import { LLMClientFactory } from '@/core/llm/base';
import { createTestAgentContext, assertAgentResultValid } from './agent-test-utils';

jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() }
}));

describe('ScrumMasterAgent', () => {
  let agent: ScrumMasterAgent;
  let mockClient: LLMClient;

  beforeEach(() => {
    LLMClientFactory.clear();
    mockClient = createMockLLMClient('Mock');
    LLMClientFactory.register(mockClient);
    agent = new ScrumMasterAgent(mockClient);
  });

  describe('constructor', () => {
    it('should initialize with correct name and role', () => {
      expect(agent.name).toBe('ScrumMaster');
      expect(agent.role).toBe('Agile Scrum Master');
    });

    it('should have 5 capabilities', () => {
      expect(agent.capabilities).toHaveLength(5);
      expect(agent.capabilities).toContain('sprint-planning');
      expect(agent.capabilities).toContain('story-refinement');
      expect(agent.capabilities).toContain('task-prioritization');
      expect(agent.capabilities).toContain('ceremony-facilitation');
      expect(agent.capabilities).toContain('impediment-tracking');
    });
  });

  describe('execute()', () => {
    it('should return a valid AgentResult', async () => {
      const ctx = createTestAgentContext({ mode: 'plan' });
      const result = await agent.execute(ctx);
      assertAgentResultValid(result);
      expect(result.success).toBe(true);
    });

    it('should default to plan mode when no mode specified', async () => {
      const ctx = createTestAgentContext();
      const result = await agent.execute(ctx);
      expect(result.metadata?.mode).toBe('plan');
    });

    it('should use the provided mode', async () => {
      const ctx = createTestAgentContext({ mode: 'refine' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.mode).toBe('refine');
    });

    it('should include sprint in metadata when provided', async () => {
      const ctx = createTestAgentContext({ mode: 'plan', sprint: 'Sprint 3' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.sprint).toBe('Sprint 3');
    });

    it('should set prioritize flag from priority input', async () => {
      const ctx = createTestAgentContext({ mode: 'plan', priority: true });
      const result = await agent.execute(ctx);
      expect(result.metadata?.prioritize).toBe(true);
    });

    it('should default prioritize to false', async () => {
      const ctx = createTestAgentContext({ mode: 'plan' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.prioritize).toBe(false);
    });

    it('should default format to markdown', async () => {
      const ctx = createTestAgentContext({ mode: 'plan' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.format).toBe('markdown');
    });

    it('should support json format', async () => {
      const ctx = createTestAgentContext({ mode: 'plan', format: 'json' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.format).toBe('json');
    });

    it('should include agent name in metadata', async () => {
      const ctx = createTestAgentContext({ mode: 'plan' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.agent).toBe('ScrumMaster');
    });

    it('should include metrics in metadata', async () => {
      const ctx = createTestAgentContext({ mode: 'plan' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.metrics).toBeDefined();
    });

    it('should extract next steps from output', async () => {
      const ctx = createTestAgentContext({ mode: 'plan' });
      const result = await agent.execute(ctx);
      expect(result.nextSteps).toBeDefined();
      expect(Array.isArray(result.nextSteps)).toBe(true);
    });

    it('should return empty artifacts array', async () => {
      const ctx = createTestAgentContext({ mode: 'plan' });
      const result = await agent.execute(ctx);
      expect(result.artifacts).toEqual([]);
    });
  });

  describe('registerScrumMasterAgent()', () => {
    it('should register ScrumMaster in AgentFactory', () => {
      const { AgentFactory } = require('@/agents/factory');
      AgentFactory.clear();
      const { registerScrumMasterAgent } = require('@/agents/scrum-master');
      registerScrumMasterAgent();
      expect(AgentFactory.has('ScrumMaster')).toBe(true);
    });
  });
});
