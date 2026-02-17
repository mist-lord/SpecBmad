/**
 * Base LLM Client and Factory Tests
 *
 * Tests for BaseLLMClient abstract class and LLMClientFactory
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

import { BaseLLMClient, LLMClientFactory } from '@/core/llm/base';
import { LLMOptions, AgentType } from '@/types';

// Concrete implementation for testing abstract class
class TestLLMClient extends BaseLLMClient {
  constructor(name: string, config?: {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
  }) {
    super(name, 'claude' as AgentType, config);
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generateText(prompt: string, options?: LLMOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('No API key');
    }
    return `Generated: ${prompt}`;
  }

  async generateStructured<T>(
    prompt: string,
    schema: any,
    options?: LLMOptions
  ): Promise<T> {
    return { result: prompt } as T;
  }
}

describe('BaseLLMClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set name and type properties', () => {
      const client = new TestLLMClient('TestClient');

      expect(client.name).toBe('TestClient');
      expect(client.type).toBe('claude');
    });

    it('should set apiKey when provided', () => {
      const client = new TestLLMClient('TestClient', {
        apiKey: 'test-key-123',
      });

      expect((client as any).apiKey).toBe('test-key-123');
    });

    it('should set baseUrl when provided', () => {
      const client = new TestLLMClient('TestClient', {
        baseUrl: 'https://api.example.com',
      });

      expect((client as any).baseUrl).toBe('https://api.example.com');
    });

    it('should set defaultModel when provided', () => {
      const client = new TestLLMClient('TestClient', {
        defaultModel: 'claude-3-opus',
      });

      expect((client as any).defaultModel).toBe('claude-3-opus');
    });

    it('should handle all config properties together', () => {
      const client = new TestLLMClient('TestClient', {
        apiKey: 'key',
        baseUrl: 'https://api.example.com',
        defaultModel: 'model-1',
      });

      expect((client as any).apiKey).toBe('key');
      expect((client as any).baseUrl).toBe('https://api.example.com');
      expect((client as any).defaultModel).toBe('model-1');
    });

    it('should handle undefined config', () => {
      const client = new TestLLMClient('TestClient', undefined);

      expect((client as any).apiKey).toBeUndefined();
      expect((client as any).baseUrl).toBeUndefined();
      expect((client as any).defaultModel).toBeUndefined();
    });

    it('should handle empty config object', () => {
      const client = new TestLLMClient('TestClient', {});

      expect((client as any).apiKey).toBeUndefined();
      expect((client as any).baseUrl).toBeUndefined();
      expect((client as any).defaultModel).toBeUndefined();
    });
  });

  describe('validateConfig()', () => {
    it('should not throw when apiKey is present', () => {
      const client = new TestLLMClient('TestClient', {
        apiKey: 'test-key',
      });

      expect(() => (client as any).validateConfig()).not.toThrow();
    });

    it('should throw error when apiKey is missing', () => {
      const client = new TestLLMClient('TestClient');

      expect(() => (client as any).validateConfig()).toThrow(
        'TestClient 客户端缺少 API Key'
      );
    });
  });

  describe('handleError()', () => {
    it('should throw error with formatted message', () => {
      const client = new TestLLMClient('TestClient');
      const error = new Error('Network failure');

      expect(() => (client as any).handleError(error, '生成文本')).toThrow(
        'TestClient 生成文本 失败: Network failure'
      );
    });

    it('should handle non-Error objects', () => {
      const client = new TestLLMClient('TestClient');

      expect(() => (client as any).handleError('String error', '操作')).toThrow(
        'TestClient 操作 失败: String error'
      );
    });

    it('should handle errors without message property', () => {
      const client = new TestLLMClient('TestClient');

      expect(() => (client as any).handleError(null, '操作')).toThrow();
    });
  });

  describe('buildRequestOptions()', () => {
    it('should return default options when none provided', () => {
      const client = new TestLLMClient('TestClient', {
        defaultModel: 'model-1',
      });

      const opts = (client as any).buildRequestOptions();

      expect(opts).toEqual({
        model: 'model-1',
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: '',
        context: [],
      });
    });

    it('should merge provided options with defaults', () => {
      const client = new TestLLMClient('TestClient', {
        defaultModel: 'model-1',
      });

      const opts = (client as any).buildRequestOptions({
        model: 'custom-model',
        temperature: 0.5,
      });

      expect(opts).toEqual({
        model: 'custom-model',
        temperature: 0.5,
        maxTokens: 2000,
        systemPrompt: '',
        context: [],
      });
    });

    it('should handle all LLMOptions properties', () => {
      const client = new TestLLMClient('TestClient');

      const opts = (client as any).buildRequestOptions({
        model: 'gpt-4',
        temperature: 0.9,
        maxTokens: 4000,
        systemPrompt: 'You are a helpful assistant',
        context: ['Previous message'],
      });

      expect(opts).toEqual({
        model: 'gpt-4',
        temperature: 0.9,
        maxTokens: 4000,
        systemPrompt: 'You are a helpful assistant',
        context: ['Previous message'],
      });
    });

    it('should handle temperature of 0', () => {
      const client = new TestLLMClient('TestClient');

      const opts = (client as any).buildRequestOptions({
        temperature: 0,
      });

      expect(opts.temperature).toBe(0);
    });

    it('should use empty string for model when not provided', () => {
      const client = new TestLLMClient('TestClient'); // No defaultModel

      const opts = (client as any).buildRequestOptions();

      expect(opts.model).toBe('');
    });
  });
});

describe('LLMClientFactory', () => {
  beforeEach(() => {
    LLMClientFactory.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    LLMClientFactory.clear();
  });

  describe('register()', () => {
    it('should register a client', () => {
      const client = new TestLLMClient('TestClient', { apiKey: 'key' });

      LLMClientFactory.register(client);

      const retrieved = LLMClientFactory.get('TestClient');
      expect(retrieved).toBe(client);
    });

    it('should allow duplicate registration (overwrites)', () => {
      const client1 = new TestLLMClient('TestClient', { apiKey: 'key1' });
      const client2 = new TestLLMClient('TestClient', { apiKey: 'key2' });

      LLMClientFactory.register(client1);
      LLMClientFactory.register(client2);

      const retrieved = LLMClientFactory.get('TestClient');
      expect(retrieved).toBe(client2);
    });

    it('should register multiple clients', () => {
      const client1 = new TestLLMClient('Client1', { apiKey: 'key1' });
      const client2 = new TestLLMClient('Client2', { apiKey: 'key2' });

      LLMClientFactory.register(client1);
      LLMClientFactory.register(client2);

      expect(LLMClientFactory.get('Client1')).toBe(client1);
      expect(LLMClientFactory.get('Client2')).toBe(client2);
    });
  });

  describe('get()', () => {
    it('should return registered client', () => {
      const client = new TestLLMClient('TestClient', { apiKey: 'key' });
      LLMClientFactory.register(client);

      const retrieved = LLMClientFactory.get('TestClient');

      expect(retrieved).toBe(client);
    });

    it('should return undefined for non-existent client', () => {
      const retrieved = LLMClientFactory.get('NonExistent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAll()', () => {
    it('should return all registered clients', () => {
      const client1 = new TestLLMClient('Client1', { apiKey: 'key1' });
      const client2 = new TestLLMClient('Client2', { apiKey: 'key2' });

      LLMClientFactory.register(client1);
      LLMClientFactory.register(client2);

      const all = LLMClientFactory.getAll();

      expect(all).toHaveLength(2);
      expect(all).toContain(client1);
      expect(all).toContain(client2);
    });

    it('should return empty array when no clients registered', () => {
      const all = LLMClientFactory.getAll();

      expect(all).toEqual([]);
    });
  });

  describe('getAvailable()', () => {
    it('should return only available clients', async () => {
      const client1 = new TestLLMClient('Client1', { apiKey: 'key1' }); // Available
      const client2 = new TestLLMClient('Client2'); // Not available (no key)

      LLMClientFactory.register(client1);
      LLMClientFactory.register(client2);

      const available = await LLMClientFactory.getAvailable();

      expect(available).toHaveLength(1);
      expect(available).toContain(client1);
    });

    it('should return empty array when no clients available', async () => {
      const client = new TestLLMClient('Client1'); // No API key

      LLMClientFactory.register(client);

      const available = await LLMClientFactory.getAvailable();

      expect(available).toEqual([]);
    });

    it('should handle isAvailable errors gracefully', async () => {
      const client = new TestLLMClient('Client1', { apiKey: 'key' });
      client.isAvailable = jest.fn().mockRejectedValue(new Error('Network error'));

      LLMClientFactory.register(client);

      const available = await LLMClientFactory.getAvailable();

      expect(available).toEqual([]);
    });
  });

  describe('getByType()', () => {
    it('should return clients matching the type', () => {
      const claudeClient = new TestLLMClient('Claude', { apiKey: 'key1' });

      LLMClientFactory.register(claudeClient);

      const claudeClients = LLMClientFactory.getByType('claude' as AgentType);

      expect(claudeClients).toHaveLength(1);
      expect(claudeClients).toContain(claudeClient);
    });

    it('should return empty array for non-matching type', () => {
      const claudeClient = new TestLLMClient('Claude', { apiKey: 'key1' });

      LLMClientFactory.register(claudeClient);

      const openaiClients = LLMClientFactory.getByType('openai' as AgentType);

      expect(openaiClients).toEqual([]);
    });

    it('should return multiple clients of the same type', () => {
      const client1 = new TestLLMClient('Claude1', { apiKey: 'key1' });
      const client2 = new TestLLMClient('Claude2', { apiKey: 'key2' });

      LLMClientFactory.register(client1);
      LLMClientFactory.register(client2);

      const claudeClients = LLMClientFactory.getByType('claude' as AgentType);

      expect(claudeClients).toHaveLength(2);
    });
  });

  describe('clear()', () => {
    it('should remove all registered clients', () => {
      const client1 = new TestLLMClient('Client1', { apiKey: 'key1' });
      const client2 = new TestLLMClient('Client2', { apiKey: 'key2' });

      LLMClientFactory.register(client1);
      LLMClientFactory.register(client2);

      LLMClientFactory.clear();

      expect(LLMClientFactory.getAll()).toEqual([]);
      expect(LLMClientFactory.get('Client1')).toBeUndefined();
      expect(LLMClientFactory.get('Client2')).toBeUndefined();
    });

    it('should allow re-registration after clear', () => {
      const client1 = new TestLLMClient('Client1', { apiKey: 'key1' });

      LLMClientFactory.register(client1);
      LLMClientFactory.clear();

      const client2 = new TestLLMClient('Client2', { apiKey: 'key2' });
      LLMClientFactory.register(client2);

      expect(LLMClientFactory.getAll()).toHaveLength(1);
      expect(LLMClientFactory.get('Client2')).toBe(client2);
    });
  });
});
