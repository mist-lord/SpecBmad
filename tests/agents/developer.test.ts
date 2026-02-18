import { DeveloperAgent } from '@/agents/developer';
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

describe('DeveloperAgent', () => {
  let agent: DeveloperAgent;
  let mockClient: LLMClient;

  beforeEach(() => {
    jest.clearAllMocks();
    LLMClientFactory.clear();
    mockClient = createMockLLMClient('Mock');
    LLMClientFactory.register(mockClient);
    agent = new DeveloperAgent(mockClient);
  });

  describe('constructor', () => {
    it('should initialize with correct name and role', () => {
      expect(agent.name).toBe('Developer');
      expect(agent.role).toBe('Software Developer');
    });

    it('should have 5 capabilities', () => {
      expect(agent.capabilities).toHaveLength(5);
      expect(agent.capabilities).toContain('code-implementation');
      expect(agent.capabilities).toContain('tdd');
      expect(agent.capabilities).toContain('refactoring');
      expect(agent.capabilities).toContain('unit-testing');
      expect(agent.capabilities).toContain('code-review');
    });
  });

  describe('execute() - specializations', () => {
    it('should execute without specialization', async () => {
      const ctx = createTestAgentContext();
      const result = await agent.execute(ctx);
      assertAgentResultValid(result);
      expect(result.success).toBe(true);
    });

    it('should execute with web specialization', async () => {
      const ctx = createTestAgentContext({ specialist: 'web' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
    });

    it('should execute with backend specialization', async () => {
      const ctx = createTestAgentContext({ specialist: 'backend' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
    });

    it('should execute with algorithm specialization', async () => {
      const ctx = createTestAgentContext({ specialist: 'algorithm' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
    });
  });

  describe('execute() - review mode', () => {
    it('should set review to false by default', async () => {
      const ctx = createTestAgentContext();
      const result = await agent.execute(ctx);
      expect(result.metadata?.review).toBe(false);
    });

    it('should enable review mode', async () => {
      const ctx = createTestAgentContext({ review: true });
      const result = await agent.execute(ctx);
      expect(result.metadata?.review).toBe(true);
    });
  });

  describe('execute() - parameters', () => {
    it('should include taskId in metadata', async () => {
      const ctx = createTestAgentContext({ task: 'TASK-123' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.taskId).toBe('TASK-123');
    });

    it('should set taskId to undefined when not provided', async () => {
      const ctx = createTestAgentContext();
      const result = await agent.execute(ctx);
      expect(result.metadata?.taskId).toBeUndefined();
    });

    it('should include file in metadata', async () => {
      const ctx = createTestAgentContext({ file: 'src/index.ts' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.file).toBe('src/index.ts');
    });

    it('should set file to undefined when not provided', async () => {
      const ctx = createTestAgentContext();
      const result = await agent.execute(ctx);
      expect(result.metadata?.file).toBeUndefined();
    });

    it('should include agent name in metadata', async () => {
      const ctx = createTestAgentContext();
      const result = await agent.execute(ctx);
      expect(result.metadata?.agent).toBe('Developer');
    });

    it('should include metrics in metadata', async () => {
      const ctx = createTestAgentContext();
      const result = await agent.execute(ctx);
      expect(result.metadata?.metrics).toBeDefined();
    });

    it('should return empty artifacts', async () => {
      const ctx = createTestAgentContext();
      const result = await agent.execute(ctx);
      expect(result.artifacts).toEqual([]);
    });
  });

  describe('prompt building', () => {
    it('should include specialist in prompt when provided', async () => {
      const spy = jest.spyOn(mockClient, 'generateText');
      const ctx = createTestAgentContext({ specialist: 'web' });
      await agent.execute(ctx);
      const prompt = spy.mock.calls[0][0];
      expect(prompt).toContain('specialized in web');
      spy.mockRestore();
    });

    it('should include project name in prompt', async () => {
      const spy = jest.spyOn(mockClient, 'generateText');
      const ctx = createTestAgentContext();
      await agent.execute(ctx);
      const prompt = spy.mock.calls[0][0];
      expect(prompt).toContain('TestProject');
      spy.mockRestore();
    });
  });

  describe('registerDeveloperAgent()', () => {
    it('should register Developer in AgentFactory', () => {
      const { AgentFactory } = require('@/agents/factory');
      AgentFactory.clear();
      const { registerDeveloperAgent } = require('@/agents/developer');
      registerDeveloperAgent();
      expect(AgentFactory.has('Developer')).toBe(true);
    });

    it('should register Implementation alias', () => {
      const { AgentFactory } = require('@/agents/factory');
      AgentFactory.clear();
      const { registerDeveloperAgent } = require('@/agents/developer');
      registerDeveloperAgent();
      expect(AgentFactory.has('Implementation')).toBe(true);
    });
  });
});
