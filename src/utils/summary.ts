import { AgentResult } from '@/types';

export function renderWorkflowMarkdownSummary(workflowName: string, results: AgentResult[]): string {
  const lines: string[] = [];
  lines.push(`# 工作流汇总: ${workflowName}`);
  lines.push('');
  lines.push(`共执行步骤: ${results.length}`);
  lines.push('');

  const goals: string[] = [];
  const actions: string[] = [];
  const stories: Array<{ id?: string; title?: string; priority?: string; estimate?: string }> = [];

  // 指标聚合
  let totalIn = 0;
  let totalOut = 0;
  let totalLatency = 0;
  let totalCost = 0;

  for (const r of results) {
    // 尝试解析 JSON 输出以提取结构化数据
    try {
      const obj = typeof r.output === 'string' ? JSON.parse(r.output) : r.output;
      if (Array.isArray(obj?.goals)) {
        goals.push(...obj.goals);
      }
      if (Array.isArray(obj?.actions)) {
        actions.push(...obj.actions);
      }
      if (Array.isArray(obj?.stories)) {
        for (const s of obj.stories) {
          stories.push({ id: s.id, title: s.title, priority: s.priority, estimate: s.estimate });
        }
      }
    } catch { /* 非 JSON 输出，忽略 */ }

    if (Array.isArray(r.nextSteps)) {
      actions.push(...r.nextSteps);
    }

    // 统计 LLM 指标
    const m = r.metadata?.metrics as any;
    if (m) {
      totalIn += Number(m.inputTokens || 0);
      totalOut += Number(m.outputTokens || 0);
      totalLatency += Number(m.latencyMs || 0);
      totalCost += Number(m.costUSD || 0);
    }
  }

  // 迭代目标
  if (goals.length > 0) {
    lines.push('## Sprint Goals');
    for (const g of unique(goals)) {
      lines.push(`- ${g}`);
    }
    lines.push('');
  }

  // 用户故事表
  if (stories.length > 0) {
    lines.push('## Stories');
    lines.push('| ID | Title | Priority | Estimate |');
    lines.push('|---|---|---|---|');
    for (const s of uniqueObjects(stories, (x) => `${x.id}:${x.title}`)) {
      lines.push(`| ${s.id ?? ''} | ${s.title ?? ''} | ${s.priority ?? ''} | ${s.estimate ?? ''} |`);
    }
    lines.push('');
  }

  // 建议下一步
  if (actions.length > 0) {
    lines.push('## Next Actions');
    for (const a of unique(actions)) {
      lines.push(`- ${a}`);
    }
    lines.push('');
  }

  // LLM 使用指标
  lines.push('## LLM Usage');
  const totalTokens = totalIn + totalOut;
  const avgLatency = results.length > 0 ? Math.round((totalLatency / results.length) * 100) / 100 : 0;
  lines.push(`- Tokens In: ${totalIn}`);
  lines.push(`- Tokens Out: ${totalOut}`);
  lines.push(`- Tokens Total: ${totalTokens}`);
  lines.push(`- Avg Latency (ms): ${avgLatency}`);
  lines.push(`- Cost (USD): ${round4(totalCost)}`);
  lines.push('');

  // 步骤摘要
  lines.push('## Steps Summary');
  let i = 1;
  for (const r of results) {
    const meta = r.metadata || {};
    const m = (meta as any).metrics || {};
    const agent = (meta as any).agent || 'unknown';
    const mode = (meta as any).mode || '';
    const model = m.model || '';
    const inTok = Number(m.inputTokens || 0);
    const outTok = Number(m.outputTokens || 0);
    const latency = Number(m.latencyMs || 0);
    const cost = Number(m.costUSD || 0);
    lines.push(`- Step ${i}: agent=${agent} mode=${mode} model=${model} tokens_in=${inTok} tokens_out=${outTok} latency_ms=${Math.round(latency)} cost_usd=${round4(cost)}`);
    i += 1;
  }

  return lines.join('\n');
}

function unique(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

function uniqueObjects<T>(arr: T[], keyFn: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}