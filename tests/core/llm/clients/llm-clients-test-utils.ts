/**
 * Shared test utilities for LLM client tests (Claude, OpenAI)
 */

let originalFetch: typeof global.fetch;

/**
 * Save original fetch and install mock
 */
export function setupFetchMock(): jest.Mock {
  originalFetch = global.fetch;
  global.fetch = jest.fn();
  return global.fetch as jest.Mock;
}

/**
 * Restore original fetch
 */
export function restoreFetch(): void {
  if (originalFetch) {
    global.fetch = originalFetch;
  }
}

/**
 * Create a mock Response object
 */
export function mockFetchResponse(status: number, data: any, ok?: boolean): Response {
  return {
    ok: ok !== undefined ? ok : status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as const,
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    bytes: jest.fn(),
  } as unknown as Response;
}

/**
 * Create a mock Anthropic API response
 */
export function mockClaudeApiResponse(text: string): any {
  return {
    content: [{ type: 'text', text }],
    model: 'claude-3-sonnet-20240229',
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 20 },
  };
}

/**
 * Create a mock OpenAI API response
 */
export function mockOpenAIApiResponse(content: string): any {
  return {
    choices: [
      {
        message: { role: 'assistant', content },
        finish_reason: 'stop',
        index: 0,
      },
    ],
    model: 'gpt-4o-mini',
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

/**
 * Create a mock OpenAI models list response
 */
export function mockOpenAIModelsResponse(): any {
  return {
    data: [
      { id: 'gpt-4o-mini', object: 'model' },
      { id: 'gpt-4o', object: 'model' },
    ],
  };
}

/**
 * Create a mock error API response
 */
export function mockErrorApiResponse(message: string): any {
  return {
    error: { message, type: 'invalid_request_error' },
  };
}
