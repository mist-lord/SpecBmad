import { QAAgent } from '@/agents/qa';
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

describe('QAAgent', () => {
  let agent: QAAgent;
  let mockClient: LLMClient;

  beforeEach(() => {
    jest.clearAllMocks();
    LLMClientFactory.clear();
    mockClient = createMockLLMClient('Mock');
    LLMClientFactory.register(mockClient);
    agent = new QAAgent(mockClient);
  });

  describe('constructor', () => {
    it('should initialize with correct name and role', () => {
      expect(agent.name).toBe('QA');
      expect(agent.role).toBe('Quality Assurance');
    });

    it('should have 6 capabilities', () => {
      expect(agent.capabilities).toHaveLength(6);
      expect(agent.capabilities).toContain('static-analysis');
      expect(agent.capabilities).toContain('unit-testing');
      expect(agent.capabilities).toContain('integration-testing');
      expect(agent.capabilities).toContain('e2e-testing');
      expect(agent.capabilities).toContain('security-scanning');
      expect(agent.capabilities).toContain('performance-profiling');
    });
  });

  describe('execute() - test types', () => {
    it('should default to unit type', async () => {
      const ctx = createTestAgentContext();
      const result = await agent.execute(ctx);
      assertAgentResultValid(result);
      expect(result.metadata?.type).toBe('unit');
    });

    it('should execute unit testing', async () => {
      const ctx = createTestAgentContext({ type: 'unit' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('unit');
    });

    it('should execute integration testing', async () => {
      const ctx = createTestAgentContext({ type: 'integration' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('integration');
    });

    it('should execute e2e testing', async () => {
      const ctx = createTestAgentContext({ type: 'e2e' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('e2e');
    });

    it('should execute security testing', async () => {
      const ctx = createTestAgentContext({ type: 'security' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('security');
    });

    it('should execute performance testing', async () => {
      const ctx = createTestAgentContext({ type: 'performance' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('performance');
    });

    it('should fall back to unit prompt for unknown type', async () => {
      const ctx = createTestAgentContext({ type: 'unknown-type' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
    });
  });

  describe('execute() - parameters', () => {
    it('should include file in metadata when provided', async () => {
      const ctx = createTestAgentContext({ type: 'unit', file: 'src/utils/helper.ts' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.file).toBe('src/utils/helper.ts');
    });

    it('should set file to undefined when not provided', async () => {
      const ctx = createTestAgentContext({ type: 'unit' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.file).toBeUndefined();
    });

    it('should include fix flag in metadata', async () => {
      const ctx = createTestAgentContext({ type: 'unit', fix: true });
      const result = await agent.execute(ctx);
      expect(result.metadata?.fix).toBe(true);
    });

    it('should default fix to false', async () => {
      const ctx = createTestAgentContext({ type: 'unit' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.fix).toBe(false);
    });

    it('should include agent name in metadata', async () => {
      const ctx = createTestAgentContext({ type: 'unit' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.agent).toBe('QA');
    });

    it('should include metrics in metadata', async () => {
      const ctx = createTestAgentContext({ type: 'unit' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.metrics).toBeDefined();
    });

    it('should return empty artifacts', async () => {
      const ctx = createTestAgentContext({ type: 'unit' });
      const result = await agent.execute(ctx);
      expect(result.artifacts).toEqual([]);
    });
  });

  describe('registerQAAgent()', () => {
    it('should register QA in AgentFactory', () => {
      const { AgentFactory } = require('@/agents/factory');
      AgentFactory.clear();
      const { registerQAAgent } = require('@/agents/qa');
      registerQAAgent();
      expect(AgentFactory.has('QA')).toBe(true);
    });

    it('should not re-register if already exists', () => {
      const { AgentFactory } = require('@/agents/factory');
      AgentFactory.clear();
      const { registerQAAgent } = require('@/agents/qa');
      registerQAAgent();
      registerQAAgent();
      expect(AgentFactory.has('QA')).toBe(true);
    });
  });
});
