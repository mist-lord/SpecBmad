import { ArchitectAgent } from '@/agents/architect';
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

describe('ArchitectAgent', () => {
  let agent: ArchitectAgent;
  let mockClient: LLMClient;

  beforeEach(() => {
    jest.clearAllMocks();
    LLMClientFactory.clear();
    mockClient = createMockLLMClient('Mock');
    LLMClientFactory.register(mockClient);
    agent = new ArchitectAgent(mockClient);
  });

  describe('constructor', () => {
    it('should initialize with correct name and role', () => {
      expect(agent.name).toBe('Architect');
      expect(agent.role).toBe('Technical Architect');
    });

    it('should have 5 capabilities', () => {
      expect(agent.capabilities).toHaveLength(5);
      expect(agent.capabilities).toContain('system-design');
      expect(agent.capabilities).toContain('technology-selection');
      expect(agent.capabilities).toContain('architecture-diagram');
      expect(agent.capabilities).toContain('api-design');
      expect(agent.capabilities).toContain('scalability');
    });
  });

  describe('execute() - planning types', () => {
    it('should default to technical type', async () => {
      const ctx = createTestAgentContext();
      const result = await agent.execute(ctx);
      assertAgentResultValid(result);
      expect(result.metadata?.type).toBe('technical');
    });

    it('should execute technical planning', async () => {
      const ctx = createTestAgentContext({ type: 'technical' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('technical');
    });

    it('should execute architecture planning', async () => {
      const ctx = createTestAgentContext({ type: 'architecture' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('architecture');
    });

    it('should execute business planning', async () => {
      const ctx = createTestAgentContext({ type: 'business' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('business');
    });

    it('should execute resource planning', async () => {
      const ctx = createTestAgentContext({ type: 'resource' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('resource');
    });

    it('should execute timeline planning', async () => {
      const ctx = createTestAgentContext({ type: 'timeline' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe('timeline');
    });

    it('should fall back to technical for unknown type', async () => {
      const ctx = createTestAgentContext({ type: 'unknown' });
      const result = await agent.execute(ctx);
      expect(result.success).toBe(true);
    });
  });

  describe('execute() - scale parameter', () => {
    it('should include scale in metadata', async () => {
      const ctx = createTestAgentContext({ type: 'technical', scale: '3' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.scale).toBe('3');
    });

    it('should default scale to 1', async () => {
      const ctx = createTestAgentContext({ type: 'technical' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.scale).toBe('1');
    });

    it('should handle scale 0 (small)', async () => {
      const ctx = createTestAgentContext({ type: 'technical', scale: '0' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.scale).toBe('0');
    });

    it('should handle scale 4 (enterprise)', async () => {
      const ctx = createTestAgentContext({ type: 'technical', scale: '4' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.scale).toBe('4');
    });
  });

  describe('execute() - result structure', () => {
    it('should include agent name in metadata', async () => {
      const ctx = createTestAgentContext({ type: 'technical' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.agent).toBe('Architect');
    });

    it('should include metrics in metadata', async () => {
      const ctx = createTestAgentContext({ type: 'technical' });
      const result = await agent.execute(ctx);
      expect(result.metadata?.metrics).toBeDefined();
    });

    it('should return empty artifacts', async () => {
      const ctx = createTestAgentContext({ type: 'technical' });
      const result = await agent.execute(ctx);
      expect(result.artifacts).toEqual([]);
    });
  });

  describe('registerArchitectAgent()', () => {
    it('should register Architect in AgentFactory', () => {
      const { AgentFactory } = require('@/agents/factory');
      AgentFactory.clear();
      const { registerArchitectAgent } = require('@/agents/architect');
      registerArchitectAgent();
      expect(AgentFactory.has('Architect')).toBe(true);
    });
  });
});
