import { LLMManager } from '../../../src/core/llm/manager';

beforeEach(() => {
  process.env.BMAD_MOCK_LLM = '1';
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

describe('LLMManager initialize and defaults', () => {
  test('initializes and returns Mock client as default when enabled', async () => {
    const mgr = new LLMManager();
    await mgr.initialize();
    const client = mgr.getDefaultClient();
    expect(client).not.toBeNull();
    expect(client!.name).toBe('Mock');
    const status = await mgr.getClientStatus();
    expect(status.some((s: { name: string; available: boolean }) => s.name === 'Mock' && s.available)).toBe(true);
  });

  test('normalizeDefaultClientName handles aliases', () => {
    const mgr: any = new LLMManager();
    expect(mgr.normalizeDefaultClientName('claude-3-sonnet')).toBe('Claude');
    expect(mgr.normalizeDefaultClientName('gpt-4o-mini')).toBe('OpenAI');
    expect(mgr.normalizeDefaultClientName('offline')).toBe('Mock');
    expect(mgr.normalizeDefaultClientName('customX')).toBe('customX');
  });
});