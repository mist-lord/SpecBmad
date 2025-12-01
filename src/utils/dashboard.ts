import { AgentResult } from '@/types';
import { llmConcurrency } from '@/core/llm/concurrency';

export function renderLlmUsageDashboard(results: AgentResult[]): string {
  // 聚合指标
  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;
  let totalLatency = 0;

  const byAgent: Record<string, { calls: number; in: number; out: number; cost: number; latency: number }> = {};
  const byModel: Record<string, { calls: number; in: number; out: number; cost: number; latency: number }> = {};

  let cacheHits = 0;

  for (const r of results) {
    const m = (r.metadata?.metrics as any) || {};
    const agent = (r.metadata?.agent as string) || 'unknown';
    const model = (m.model as string) || 'unknown';

    const inTok = Number(m.inputTokens || 0);
    const outTok = Number(m.outputTokens || 0);
    const cost = Number(m.costUSD || 0);
    const lat = Number(m.latencyMs || 0);

    totalIn += inTok; totalOut += outTok; totalCost += cost; totalLatency += lat;

    byAgent[agent] = byAgent[agent] || { calls: 0, in: 0, out: 0, cost: 0, latency: 0 };
    byAgent[agent].calls++; byAgent[agent].in += inTok; byAgent[agent].out += outTok; byAgent[agent].cost += cost; byAgent[agent].latency += lat;

    byModel[model] = byModel[model] || { calls: 0, in: 0, out: 0, cost: 0, latency: 0 };
    byModel[model].calls++; byModel[model].in += inTok; byModel[model].out += outTok; byModel[model].cost += cost; byModel[model].latency += lat;

    if (lat === 0) cacheHits++;
  }

  const totalCalls = results.length;
  const avgLatency = totalCalls ? Math.round((totalLatency / totalCalls) * 100) / 100 : 0;
  const cacheHitRate = totalCalls ? Math.round((cacheHits / totalCalls) * 10000) / 100 : 0;

  const conc = llmConcurrency.getStats();

  const lines: string[] = [];
  lines.push('# LLM 使用指标仪表板');
  lines.push('');
  lines.push('## 概览');
  lines.push(`- 总调用数: ${totalCalls}`);
  lines.push(`- Tokens In: ${totalIn}`);
  lines.push(`- Tokens Out: ${totalOut}`);
  lines.push(`- Tokens Total: ${totalIn + totalOut}`);
  lines.push(`- 平均延迟(ms): ${avgLatency}`);
  lines.push(`- 估算成本(USD): ${round4(totalCost)}`);
  lines.push(`- 缓存命中率(%): ${cacheHitRate}`);
  lines.push(`- 并发限制: ${conc.limit}`);
  lines.push(`- 并发峰值: ${conc.peakActive}`);
  lines.push(`- 队列总计: ${conc.totalQueued}`);
  lines.push('');

  lines.push('## 按代理');
  lines.push('| 代理 | 调用数 | Tokens In | Tokens Out | 成本(USD) | 平均延迟(ms) |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const [agent, m] of Object.entries(byAgent)) {
    const avg = m.calls ? Math.round((m.latency / m.calls) * 100) / 100 : 0;
    lines.push(`| ${agent} | ${m.calls} | ${m.in} | ${m.out} | ${round4(m.cost)} | ${avg} |`);
  }
  lines.push('');

  lines.push('## 按模型');
  lines.push('| 模型 | 调用数 | Tokens In | Tokens Out | 成本(USD) | 平均延迟(ms) |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const [model, m] of Object.entries(byModel)) {
    const avg = m.calls ? Math.round((m.latency / m.calls) * 100) / 100 : 0;
    lines.push(`| ${model} | ${m.calls} | ${m.in} | ${m.out} | ${round4(m.cost)} | ${avg} |`);
  }

  return lines.join('\n');
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}