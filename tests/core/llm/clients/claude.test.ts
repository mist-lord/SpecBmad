jest.mock('@/utils/logger', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { ClaudeLLMClient, createClaudeClient } from '@/core/llm/clients/claude';
import {
  setupFetchMock,
  restoreFetch,
  mockFetchResponse,
  mockClaudeApiResponse,
  mockErrorApiResponse,
} from './llm-clients-test-utils';

describe('ClaudeLLMClient', () => {
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
    it('should use default model when no config provided', () => {
      const client = new ClaudeLLMClient();
      expect(client.name).toBe('Claude');
    });

    it('should use custom config values', () => {
      const client = new ClaudeLLMClient({
        apiKey: 'custom-key',
        baseUrl: 'https://custom.api.com',
        defaultModel: 'claude-3-opus',
      });
      expect(client.name).toBe('Claude');
    });

    it('should default model to claude-3-sonnet-20240229', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockClaudeApiResponse('hello'))
      );

      await client.generateText('test');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.model).toBe('claude-3-sonnet-20240229');
    });
  });

  // ── isAvailable ──────────────────────────────────────────────

  describe('isAvailable', () => {
    it('should return true when API responds ok', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockClaudeApiResponse('hi'))
      );

      const result = await client.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when API responds with error status', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(401, mockErrorApiResponse('Unauthorized'))
      );

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when no API key is configured', async () => {
      const client = new ClaudeLLMClient();
      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when fetch throws a network error', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockRejectedValueOnce(new Error('Network failure'));

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });
  });

  // ── generateText ─────────────────────────────────────────────

  describe('generateText', () => {
    it('should return generated text for a basic prompt', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockClaudeApiResponse('Generated response'))
      );

      const result = await client.generateText('Hello world');
      expect(result).toBe('Generated response');
    });

    it('should include system prompt in requestBody.system', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockClaudeApiResponse('response'))
      );

      await client.generateText('prompt', { systemPrompt: 'You are helpful' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.system).toBe('You are helpful');
    });

    it('should not include system field when no system prompt given', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockClaudeApiResponse('response'))
      );

      await client.generateText('prompt');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.system).toBeUndefined();
    });

    it('should prepend context messages before the main prompt', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockClaudeApiResponse('response'))
      );

      await client.generateText('main prompt', {
        context: ['context 1', 'context 2'],
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.messages).toHaveLength(3);
      expect(body.messages[0]).toEqual({ role: 'user', content: 'context 1' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'context 2' });
      expect(body.messages[2]).toEqual({ role: 'user', content: 'main prompt' });
    });

    it('should throw when API returns a non-ok response', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(500, mockErrorApiResponse('Server error'))
      );

      await expect(client.generateText('prompt')).rejects.toThrow('失败');
    });

    it('should throw when no API key is configured', async () => {
      const client = new ClaudeLLMClient();

      await expect(client.generateText('prompt')).rejects.toThrow('API Key');
    });

    it('should throw when response has no content[0].text', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, { content: [] })
      );

      await expect(client.generateText('prompt')).rejects.toThrow('失败');
    });

    it('should throw when response content is null', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, { content: null })
      );

      await expect(client.generateText('prompt')).rejects.toThrow('失败');
    });

    it('should pass temperature and maxTokens from options', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockClaudeApiResponse('ok'))
      );

      await client.generateText('prompt', {
        temperature: 0.5,
        maxTokens: 1000,
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(1000);
    });
  });

  // ── generateStructured ──────────────────────────────────────

  describe('generateStructured', () => {
    const schema = { type: 'object', properties: { name: { type: 'string' } } };

    it('should parse valid JSON response', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockClaudeApiResponse('{"name":"Alice"}'))
      );

      const result = await client.generateStructured<{ name: string }>(
        'generate a name',
        schema
      );
      expect(result).toEqual({ name: 'Alice' });
    });

    it('should extract JSON from surrounding text via regex', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(
          200,
          mockClaudeApiResponse('Here is the result: {"name":"Bob"} done')
        )
      );

      const result = await client.generateStructured<{ name: string }>(
        'generate a name',
        schema
      );
      expect(result).toEqual({ name: 'Bob' });
    });

    it('should throw when response contains no parseable JSON', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockClaudeApiResponse('no json here at all'))
      );

      await expect(
        client.generateStructured('prompt', schema)
      ).rejects.toThrow('失败');
    });

    it('should include schema in the prompt sent to the API', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockClaudeApiResponse('{"name":"Test"}'))
      );

      await client.generateStructured('generate', schema);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const sentPrompt = body.messages[body.messages.length - 1].content;
      expect(sentPrompt).toContain('"type": "object"');
    });
  });

  // ── makeRequest (via generateText) ──────────────────────────

  describe('makeRequest', () => {
    it('should send correct headers including x-api-key and anthropic-version', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockClaudeApiResponse('ok'))
      );

      await client.generateText('prompt');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['x-api-key']).toBe('test-api-key');
      expect(options.headers['anthropic-version']).toBe('2023-06-01');
    });

    it('should use custom baseUrl when provided', async () => {
      const client = new ClaudeLLMClient({
        apiKey: 'test-api-key',
        baseUrl: 'https://custom.api.com/v1/messages',
      });
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, mockClaudeApiResponse('ok'))
      );

      await client.generateText('prompt');

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe('https://custom.api.com/v1/messages');
    });
  });

  // ── Network errors ──────────────────────────────────────────

  describe('network errors', () => {
    it('should throw a formatted error when fetch rejects', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(client.generateText('prompt')).rejects.toThrow(
        'ECONNREFUSED'
      );
    });

    it('should throw a formatted error for generateStructured on network failure', async () => {
      const client = new ClaudeLLMClient({ apiKey: 'test-api-key' });
      fetchMock.mockRejectedValueOnce(new Error('Timeout'));

      await expect(
        client.generateStructured('prompt', { type: 'object' })
      ).rejects.toThrow('Timeout');
    });
  });

  // ── createClaudeClient factory ──────────────────────────────

  describe('createClaudeClient', () => {
    it('should return a ClaudeLLMClient instance', () => {
      const client = createClaudeClient({ apiKey: 'test-api-key' });
      expect(client).toBeInstanceOf(ClaudeLLMClient);
    });

    it('should work without config', () => {
      const client = createClaudeClient();
      expect(client).toBeInstanceOf(ClaudeLLMClient);
    });
  });
});
