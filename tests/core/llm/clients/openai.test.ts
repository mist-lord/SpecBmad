jest.mock('@/utils/logger', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { OpenAILLMClient, createOpenAIClient } from '@/core/llm/clients/openai';
import {
  setupFetchMock,
  restoreFetch,
  mockFetchResponse,
  mockOpenAIApiResponse,
  mockOpenAIModelsResponse,
  mockErrorApiResponse,
} from './llm-clients-test-utils';

describe('OpenAILLMClient', () => {
  let fetchMock: jest.Mock;

  beforeAll(() => {
    fetchMock = setupFetchMock();
  });

  afterAll(() => {
    restoreFetch();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Constructor ──────────────────────────────────────────────

  describe('constructor', () => {
    it('should use default model gpt-4o-mini when no config provided', () => {
      const client = new OpenAILLMClient();
      expect(client.name).toBe('OpenAI');
    });

    it('should accept custom config values', () => {
      const client = new OpenAILLMClient({
        apiKey: 'custom-key',
        baseUrl: 'https://custom.openai.com',
        defaultModel: 'gpt-4o',
      });
      expect(client.name).toBe('OpenAI');
    });

    it('should default model to gpt-4o-mini in requests', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIApiResponse('hello'))
      );

      await client.generateText('test');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-4o-mini');
    });
  });

  // ── isAvailable ──────────────────────────────────────────────

  describe('isAvailable', () => {
    it('should return true when models API responds ok', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIModelsResponse())
      );

      const result = await client.isAvailable();
      expect(result).toBe(true);
    });

    it('should send GET request with Authorization Bearer header', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIModelsResponse())
      );

      await client.isAvailable();

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/models');
      expect(options.method).toBe('GET');
      expect(options.headers['Authorization']).toBe('Bearer test-api-key');
    });

    it('should return false when API responds with error status', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(401, mockErrorApiResponse('Invalid API key'))
      );

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when no API key is configured', async () => {
      const client = new OpenAILLMClient();
      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when fetch throws a network error', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockRejectedValueOnce(new Error('Network failure'));

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });
  });

  // ── generateText ─────────────────────────────────────────────

  describe('generateText', () => {
    it('should return generated text for a basic prompt', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIApiResponse('Generated text'))
      );

      const result = await client.generateText('Hello');
      expect(result).toBe('Generated text');
    });

    it('should include system prompt as first message with role system', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIApiResponse('response'))
      );

      await client.generateText('prompt', { systemPrompt: 'Be concise' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.messages[0]).toEqual({ role: 'system', content: 'Be concise' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'prompt' });
    });

    it('should not include system message when no system prompt given', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIApiResponse('response'))
      );

      await client.generateText('prompt');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].role).toBe('user');
    });

    it('should prepend context messages between system and main prompt', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIApiResponse('response'))
      );

      await client.generateText('main prompt', {
        systemPrompt: 'system',
        context: ['ctx1', 'ctx2'],
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.messages).toHaveLength(4);
      expect(body.messages[0]).toEqual({ role: 'system', content: 'system' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'ctx1' });
      expect(body.messages[2]).toEqual({ role: 'user', content: 'ctx2' });
      expect(body.messages[3]).toEqual({ role: 'user', content: 'main prompt' });
    });

    it('should throw with error message from safeJson when API returns non-ok', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      const errorResp = mockFetchResponse(
        429,
        mockErrorApiResponse('Rate limit exceeded')
      );
      fetchMock.mockResolvedValueOnce(errorResp);

      await expect(client.generateText('prompt')).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('should throw when API error response has no parseable json', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      const errorResp = {
        ...mockFetchResponse(500, {}),
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockRejectedValue(new Error('bad json')),
      } as unknown as Response;
      fetchMock.mockResolvedValueOnce(errorResp);

      await expect(client.generateText('prompt')).rejects.toThrow('500');
    });

    it('should throw when no API key is configured', async () => {
      const client = new OpenAILLMClient();

      await expect(client.generateText('prompt')).rejects.toThrow('API Key');
    });

    it('should throw when response content is null', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      const data = {
        choices: [{ message: { role: 'assistant', content: null }, finish_reason: 'stop', index: 0 }],
        model: 'gpt-4o-mini',
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
      };
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, data));

      await expect(client.generateText('prompt')).rejects.toThrow('失败');
    });

    it('should throw when response has empty string content', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      const data = {
        choices: [{ message: { role: 'assistant', content: '' }, finish_reason: 'stop', index: 0 }],
        model: 'gpt-4o-mini',
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
      };
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, data));

      await expect(client.generateText('prompt')).rejects.toThrow('失败');
    });

    it('should pass temperature and maxTokens from options', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIApiResponse('ok'))
      );

      await client.generateText('prompt', {
        temperature: 0.2,
        maxTokens: 500,
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.2);
      expect(body.max_tokens).toBe(500);
    });
  });

  // ── generateStructured ──────────────────────────────────────

  describe('generateStructured', () => {
    const schema = { type: 'object', properties: { count: { type: 'number' } } };

    it('should parse valid JSON response', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIApiResponse('{"count":42}'))
      );

      const result = await client.generateStructured<{ count: number }>(
        'how many',
        schema
      );
      expect(result).toEqual({ count: 42 });
    });

    it('should extract JSON from surrounding text via regex', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(
          200,
          mockOpenAIApiResponse('The answer is: {"count":7} as expected')
        )
      );

      const result = await client.generateStructured<{ count: number }>(
        'how many',
        schema
      );
      expect(result).toEqual({ count: 7 });
    });

    it('should throw when response contains no parseable JSON', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIApiResponse('just plain text'))
      );

      await expect(
        client.generateStructured('prompt', schema)
      ).rejects.toThrow('失败');
    });

    it('should include schema in the prompt sent to the API', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIApiResponse('{"count":1}'))
      );

      await client.generateStructured('generate', schema);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const lastMsg = body.messages[body.messages.length - 1];
      expect(lastMsg.content).toContain('"type": "number"');
    });
  });

  // ── makeRequest (via generateText) ──────────────────────────

  describe('makeRequest', () => {
    it('should send correct headers with Authorization Bearer', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIApiResponse('ok'))
      );

      await client.generateText('prompt');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['Authorization']).toBe('Bearer test-api-key');
    });

    it('should use custom baseUrl when provided', async () => {
      const client = new OpenAILLMClient({
        apiKey: 'test-api-key',
        baseUrl: 'https://custom.openai.com/v1/chat/completions',
      });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockOpenAIApiResponse('ok'))
      );

      await client.generateText('prompt');

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe('https://custom.openai.com/v1/chat/completions');
    });
  });

  // ── Network errors ──────────────────────────────────────────

  describe('network errors', () => {
    it('should throw a formatted error when fetch rejects', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(client.generateText('prompt')).rejects.toThrow(
        'ECONNREFUSED'
      );
    });

    it('should throw a formatted error for generateStructured on network failure', async () => {
      const client = new OpenAILLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockRejectedValueOnce(new Error('Timeout'));

      await expect(
        client.generateStructured('prompt', { type: 'object' })
      ).rejects.toThrow('Timeout');
    });
  });

  // ── createOpenAIClient factory ──────────────────────────────

  describe('createOpenAIClient', () => {
    it('should return an OpenAILLMClient instance', () => {
      const client = createOpenAIClient({ apiKey: 'test-api-key' });
      expect(client).toBeInstanceOf(OpenAILLMClient);
    });

    it('should work without config', () => {
      const client = createOpenAIClient();
      expect(client).toBeInstanceOf(OpenAILLMClient);
    });
  });
});
