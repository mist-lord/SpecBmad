import { AgentFactory } from '@/agents/factory';
import { BaseAgent } from '@/agents/base/agent';
import { AgentContext, AgentResult, LLMClient, AgentType } from '@/types';
import { createMockLLMClient } from '@/core/llm';
import { LLMClientFactory } from '@/core/llm/base';

jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() }
}));

class StubAgent extends BaseAgent {
  constructor(llm: LLMClient) {
    super('Stub', 'Test stub', ['testing'], llm);
  }
  async execute(context: AgentContext): Promise<AgentResult> {
    return { success: true, output: 'stub', artifacts: [], nextSteps: [], metadata: { agent: this.name } };
  }
}

class AnotherAgent extends BaseAgent {
  constructor(llm: LLMClient) {
    super('Another', 'Another stub', ['other'], llm);
  }
  async execute(context: AgentContext): Promise<AgentResult> {
    return { success: true, output: 'another', artifacts: [], nextSteps: [], metadata: { agent: this.name } };
  }
}

describe('AgentFactory', () => {
  let mockClient: LLMClient;

  beforeEach(() => {
    AgentFactory.clear();
    LLMClientFactory.clear();
    mockClient = createMockLLMClient('Mock');
    LLMClientFactory.register(mockClient);
  });

  describe('register()', () => {
    it('should register an agent class by type', () => {
      AgentFactory.register('Stub', StubAgent);
      expect(AgentFactory.has('Stub')).toBe(true);
    });

    it('should allow overwriting an existing registration', () => {
      AgentFactory.register('Stub', StubAgent);
      AgentFactory.register('Stub', AnotherAgent);
      const agent = AgentFactory.create('Stub', mockClient);
      expect(agent.name).toBe('Another');
    });
  });

  describe('create()', () => {
    it('should create an agent instance with the provided LLM client', () => {
      AgentFactory.register('Stub', StubAgent);
      const agent = AgentFactory.create('Stub', mockClient);
      expect(agent).toBeInstanceOf(StubAgent);
      expect(agent.name).toBe('Stub');
    });

    it('should throw error for unregistered agent type', () => {
      expect(() => AgentFactory.create('NonExistent', mockClient))
        .toThrow('未知代理类型: NonExistent');
    });
  });

  describe('has()', () => {
    it('should return true for registered types', () => {
      AgentFactory.register('Stub', StubAgent);
      expect(AgentFactory.has('Stub')).toBe(true);
    });

    it('should return false for unregistered types', () => {
      expect(AgentFactory.has('Unknown')).toBe(false);
    });
  });

  describe('getAvailableAgents()', () => {
    it('should return empty array when no agents registered', () => {
      expect(AgentFactory.getAvailableAgents()).toEqual([]);
    });

    it('should return all registered agent type names', () => {
      AgentFactory.register('Stub', StubAgent);
      AgentFactory.register('Another', AnotherAgent);
      const available = AgentFactory.getAvailableAgents();
      expect(available).toContain('Stub');
      expect(available).toContain('Another');
      expect(available).toHaveLength(2);
    });
  });

  describe('clear()', () => {
    it('should remove all registered agents', () => {
      AgentFactory.register('Stub', StubAgent);
      AgentFactory.register('Another', AnotherAgent);
      AgentFactory.clear();
      expect(AgentFactory.getAvailableAgents()).toEqual([]);
      expect(AgentFactory.has('Stub')).toBe(false);
    });
  });

  describe('registerBuiltInAgents integration', () => {
    it('should register built-in agents and aliases', () => {
      // Import inline to avoid module-level side effects
      const { registerBuiltInAgents } = require('@/agents/index');
      registerBuiltInAgents();

      expect(AgentFactory.has('ScrumMaster')).toBe(true);
      expect(AgentFactory.has('Developer')).toBe(true);
      expect(AgentFactory.has('QA')).toBe(true);
      expect(AgentFactory.has('Analyst')).toBe(true);
      expect(AgentFactory.has('Architect')).toBe(true);
      expect(AgentFactory.has('SecurityExpert')).toBe(true);

      // Aliases
      expect(AgentFactory.has('PM')).toBe(true);
      expect(AgentFactory.has('TEA')).toBe(true);
      expect(AgentFactory.has('Security')).toBe(true);
      expect(AgentFactory.has('SecOps')).toBe(true);
      expect(AgentFactory.has('GameDeveloper')).toBe(true);
      expect(AgentFactory.has('GameArchitect')).toBe(true);
    });
  });
});
