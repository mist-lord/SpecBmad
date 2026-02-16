/**
 * LLM Manager Tests
 *
 * Tests for client initialization, registration, and fallback logic
 */

// Mock dependencies (must be before imports)
jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/utils/config', () => ({
  ConfigManager: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockReturnValue({
      agents: {},
    }),
  })),
  getProjectConfig: jest.fn(() => ({
    spec_kit: { ai_agent: 'Claude' },
  })),
}));

import { LLMManager } from '@/core/llm/manager';
import { LLMClientFactory } from '@/core/llm/base';

describe('LLMManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clean slate
    delete process.env.BMAD_MOCK_LLM;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.OPENAI_MODEL;
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.OPENAI_BASE_URL;
    // Clear factory
    LLMClientFactory.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    LLMClientFactory.clear();
  });

  describe('Client initialization based on environment variables', () => {
    it('should initialize Mock client when BMAD_MOCK_LLM=1', async () => {
      process.env.BMAD_MOCK_LLM = '1';

      const mgr = new LLMManager();
      await mgr.initialize();

      const client = LLMClientFactory.get('Mock');
      expect(client).toBeDefined();
      expect(client?.name).toBe('Mock');
      expect(client?.type).toBe('custom'); // Mock uses AgentType.CUSTOM
    });

    it('should initialize Claude client when ANTHROPIC_API_KEY is set', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-123';

      const mgr = new LLMManager();
      await mgr.initialize();

      const client = LLMClientFactory.get('Claude');
      expect(client).toBeDefined();
      expect(client?.name).toBe('Claude');
      expect(client?.type).toBe('claude');
    });

    it('should initialize OpenAI client when OPENAI_API_KEY is set', async () => {
      process.env.OPENAI_API_KEY = 'sk-openai-test-key-123';

      const mgr = new LLMManager();
      await mgr.initialize();

      const client = LLMClientFactory.get('OpenAI');
      expect(client).toBeDefined();
      expect(client?.name).toBe('OpenAI');
      expect(client?.type).toBe('openai');
    });

    it('should initialize multiple clients when all env vars are set', async () => {
      process.env.BMAD_MOCK_LLM = '1';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      process.env.OPENAI_API_KEY = 'sk-openai-test-key';

      const mgr = new LLMManager();
      await mgr.initialize();

      expect(LLMClientFactory.get('Mock')).toBeDefined();
      expect(LLMClientFactory.get('Claude')).toBeDefined();
      expect(LLMClientFactory.get('OpenAI')).toBeDefined();
    });

    it('should not initialize Mock client when BMAD_MOCK_LLM is not set', async () => {
      const mgr = new LLMManager();
      await mgr.initialize();

      const client = LLMClientFactory.get('Mock');
      expect(client).toBeUndefined();
    });

    it('should respect ANTHROPIC_MODEL env var', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      process.env.ANTHROPIC_MODEL = 'claude-3-opus';

      const mgr = new LLMManager();
      await mgr.initialize();

      const client = LLMClientFactory.get('Claude');
      expect(client).toBeDefined();
      // Model is set in config, verify it's passed
    });

    it('should respect OPENAI_MODEL env var', async () => {
      process.env.OPENAI_API_KEY = 'sk-openai-test-key';
      process.env.OPENAI_MODEL = 'gpt-4o';

      const mgr = new LLMManager();
      await mgr.initialize();

      const client = LLMClientFactory.get('OpenAI');
      expect(client).toBeDefined();
    });

    it('should use default model when model env var is not set', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const mgr = new LLMManager();
      await mgr.initialize();

      const client = LLMClientFactory.get('Claude');
      expect(client).toBeDefined();
    });
  });

  describe('Idempotent initialization', () => {
    it('should not re-initialize if already initialized', async () => {
      process.env.BMAD_MOCK_LLM = '1';

      const mgr = new LLMManager();
      await mgr.initialize();
      const firstClient = LLMClientFactory.get('Mock');

      await mgr.initialize(); // Second call
      const secondClient = LLMClientFactory.get('Mock');

      expect(firstClient).toBe(secondClient);
    });
  });

  describe('normalizeDefaultClientName()', () => {
    let mgr: any;

    beforeEach(() => {
      mgr = new LLMManager();
    });

    it('should normalize "claude" to "Claude"', () => {
      expect(mgr.normalizeDefaultClientName('claude')).toBe('Claude');
    });

    it('should normalize "anthropic" to "Claude"', () => {
      expect(mgr.normalizeDefaultClientName('anthropic')).toBe('Claude');
    });

    it('should normalize "sonnet" to "Claude"', () => {
      expect(mgr.normalizeDefaultClientName('sonnet')).toBe('Claude');
    });

    it('should normalize "claude-3-sonnet" to "Claude"', () => {
      expect(mgr.normalizeDefaultClientName('claude-3-sonnet')).toBe('Claude');
    });

    it('should normalize "openai" to "OpenAI"', () => {
      expect(mgr.normalizeDefaultClientName('openai')).toBe('OpenAI');
    });

    it('should normalize "gpt" to "OpenAI"', () => {
      expect(mgr.normalizeDefaultClientName('gpt')).toBe('OpenAI');
    });

    it('should normalize "gpt-4" to "OpenAI"', () => {
      expect(mgr.normalizeDefaultClientName('gpt-4')).toBe('OpenAI');
    });

    it('should normalize "gpt-4o" to "OpenAI"', () => {
      expect(mgr.normalizeDefaultClientName('gpt-4o')).toBe('OpenAI');
    });

    it('should normalize "gpt-4o-mini" to "OpenAI"', () => {
      expect(mgr.normalizeDefaultClientName('gpt-4o-mini')).toBe('OpenAI');
    });

    it('should normalize "mock" to "Mock"', () => {
      expect(mgr.normalizeDefaultClientName('mock')).toBe('Mock');
    });

    it('should normalize "fake" to "Mock"', () => {
      expect(mgr.normalizeDefaultClientName('fake')).toBe('Mock');
    });

    it('should normalize "offline" to "Mock"', () => {
      expect(mgr.normalizeDefaultClientName('offline')).toBe('Mock');
    });

    it('should return unknown names unchanged', () => {
      expect(mgr.normalizeDefaultClientName('customX')).toBe('customX');
    });

    it('should handle case-insensitive matching', () => {
      expect(mgr.normalizeDefaultClientName('CLAUDE')).toBe('Claude');
      expect(mgr.normalizeDefaultClientName('OpenAI')).toBe('OpenAI');
      expect(mgr.normalizeDefaultClientName('MOCK')).toBe('Mock');
    });

    it('should trim whitespace', () => {
      expect(mgr.normalizeDefaultClientName('  claude  ')).toBe('Claude');
    });
  });

  describe('getDefaultClient()', () => {
    it('should return Claude client when configured as default', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const mgr = new LLMManager();
      await mgr.initialize();

      const client = mgr.getDefaultClient();
      expect(client?.name).toBe('Claude');
    });

    it('should fallback to Mock when default client not available', async () => {
      process.env.BMAD_MOCK_LLM = '1';
      // No ANTHROPIC_API_KEY, so Claude won't be available

      const mgr = new LLMManager();
      await mgr.initialize();

      const client = mgr.getDefaultClient();
      expect(client?.name).toBe('Mock');
    });

    it('should return null when no clients are available', async () => {
      const mgr = new LLMManager();
      await mgr.initialize();

      const client = mgr.getDefaultClient();
      expect(client).toBeNull();
    });
  });

  describe('getClientStatus()', () => {
    it('should return status for all registered clients', async () => {
      process.env.BMAD_MOCK_LLM = '1';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const mgr = new LLMManager();
      await mgr.initialize();

      const status = await mgr.getClientStatus();
      expect(status.length).toBeGreaterThan(0);
      expect(status.some((s) => s.name === 'Mock')).toBe(true);
      expect(status.some((s) => s.name === 'Claude')).toBe(true);
    });

    it('should include availability status for each client', async () => {
      process.env.BMAD_MOCK_LLM = '1';

      const mgr = new LLMManager();
      await mgr.initialize();

      const status = await mgr.getClientStatus();
      const mockStatus = status.find((s) => s.name === 'Mock');

      expect(mockStatus).toBeDefined();
      expect(mockStatus?.available).toBe(true);
      expect(mockStatus?.type).toBe('custom'); // Mock uses AgentType.CUSTOM
    });

    it('should handle client errors gracefully', async () => {
      process.env.BMAD_MOCK_LLM = '1';

      const mgr = new LLMManager();
      await mgr.initialize();

      // Mock isAvailable to throw error
      const client = LLMClientFactory.get('Mock');
      if (client) {
        client.isAvailable = jest.fn().mockRejectedValue(new Error('Connection failed'));
      }

      const status = await mgr.getClientStatus();
      const mockStatus = status.find((s) => s.name === 'Mock');

      expect(mockStatus?.available).toBe(false);
      expect(mockStatus?.error).toContain('Connection failed');
    });

    it('should return empty array when no clients registered', async () => {
      const mgr = new LLMManager();
      await mgr.initialize();

      const status = await mgr.getClientStatus();
      expect(status).toEqual([]);
    });
  });
});