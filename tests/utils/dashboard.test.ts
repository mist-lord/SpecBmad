jest.mock('@/core/llm/concurrency', () => ({
  llmConcurrency: {
    getStats: jest.fn().mockReturnValue({ limit: 5, peakActive: 3, totalQueued: 10 }),
  },
}));

import { renderLlmUsageDashboard } from '@/utils/dashboard';
import { createAgentResult, createMultipleAgentResults, createAgentResultNoMetrics } from './utils-test-utils';

describe('renderLlmUsageDashboard', () => {
  it('should return dashboard markdown for empty results', () => {
    const output = renderLlmUsageDashboard([]);

    expect(output).toContain('# LLM 使用指标仪表板');
    expect(output).toContain('总调用数: 0');
    expect(output).toContain('Tokens In: 0');
    expect(output).toContain('Tokens Out: 0');
    expect(output).toContain('平均延迟(ms): 0');
  });

  it('should aggregate metrics for a single result', () => {
    const results = [createAgentResult()];
    const output = renderLlmUsageDashboard(results);

    expect(output).toContain('总调用数: 1');
    expect(output).toContain('Tokens In: 100');
    expect(output).toContain('Tokens Out: 50');
    expect(output).toContain('Tokens Total: 150');
  });

  it('should aggregate metrics across multiple results', () => {
    const results = createMultipleAgentResults();
    const output = renderLlmUsageDashboard(results);

    expect(output).toContain('总调用数: 3');
    // 100 + 200 + 50 = 350
    expect(output).toContain('Tokens In: 350');
    // 50 + 100 + 25 = 175
    expect(output).toContain('Tokens Out: 175');
    expect(output).toContain('Tokens Total: 525');
  });

  it('should group by agent in table', () => {
    const results = createMultipleAgentResults();
    const output = renderLlmUsageDashboard(results);

    expect(output).toContain('## 按代理');
    expect(output).toContain('| Analyst |');
    expect(output).toContain('| Architect |');
  });

  it('should group by model in table', () => {
    const results = createMultipleAgentResults();
    const output = renderLlmUsageDashboard(results);

    expect(output).toContain('## 按模型');
    expect(output).toContain('| gpt-4 |');
    expect(output).toContain('| claude-3 |');
  });

  it('should calculate cache hit rate from zero-latency results', () => {
    const results = createMultipleAgentResults();
    // Third result has latencyMs: 0, so 1 cache hit out of 3
    const output = renderLlmUsageDashboard(results);

    expect(output).toContain('缓存命中率(%): 33.33');
  });

  it('should include concurrency stats', () => {
    const results = [createAgentResult()];
    const output = renderLlmUsageDashboard(results);

    expect(output).toContain('并发限制: 5');
    expect(output).toContain('并发峰值: 3');
    expect(output).toContain('队列总计: 10');
  });

  it('should handle results with no metrics gracefully', () => {
    const results = [createAgentResultNoMetrics()];
    const output = renderLlmUsageDashboard(results);

    expect(output).toContain('总调用数: 1');
    expect(output).toContain('Tokens In: 0');
    expect(output).toContain('| unknown |');
  });

  it('should calculate cost with 4 decimal precision', () => {
    const results = [createAgentResult({
      metadata: {
        metrics: { costUSD: 0.00123456, inputTokens: 10, outputTokens: 5, latencyMs: 100, model: 'test' },
      },
    })];
    const output = renderLlmUsageDashboard(results);

    expect(output).toContain('估算成本(USD): 0.0012');
  });
});
