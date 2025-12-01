import { AgentContext, AgentMemory } from '@/types';
import { log } from '@/utils/logger';
import { PATHS, getProjectPath } from '@/utils/paths';
import fs from 'fs';
import path from 'path';

export interface ContextBuildOptions {
  maxContextTokens?: number;
  maxHistory?: number;
  relevanceThreshold?: number; // 0~1，越高越严格
  preferRecent?: boolean;
}

/**
 * 上下文管理器：负责构建、评分与截断上下文消息
 */
export class ContextManager {
  private readonly defaultMaxContextTokens = 1200;
  private readonly defaultMaxHistory = 20;
  private readonly defaultRelevanceThreshold = 0.05;

  /**
   * 从 AgentContext 与 AgentMemory 构建上下文消息
   */
  public buildContext(
    prompt: string,
    context: AgentContext,
    memory: AgentMemory,
    options?: ContextBuildOptions
  ): string[] {
    const opts: Required<ContextBuildOptions> = {
      maxContextTokens: options?.maxContextTokens ?? this.defaultMaxContextTokens,
      maxHistory: options?.maxHistory ?? this.defaultMaxHistory,
      relevanceThreshold: options?.relevanceThreshold ?? this.defaultRelevanceThreshold,
      preferRecent: options?.preferRecent ?? true,
    };

    const candidates: string[] = [];

    // 1) 工作流状态摘要
    const currentStep = context.projectState?.workflow?.currentStep || '';
    const completedSteps = (context.projectState?.workflow?.completedSteps || []).join(', ');
    const projectName = context.projectState?.projectName || '';
    candidates.push(`Project=${projectName}; CurrentStep=${currentStep}; Completed=[${completedSteps}]`);

    // 2) 输入数据摘要
    if (context.inputData) {
      try {
        const trimmed = JSON.stringify(context.inputData);
        candidates.push(`InputData=${trimmed}`);
      } catch {
        // ignore
      }
    }

    // 3) Memory 中的短期记忆与上下文痕迹
    for (const [k, v] of Object.entries(memory.shortTerm)) {
      const val = typeof v === 'string' ? v : safeJson(v);
      candidates.push(`Memory:${k}=${val}`);
    }

    // 历史上下文（只保留最近 maxHistory 条）
    const history = (memory.context || []).slice(-opts.maxHistory);
    for (const h of history) {
      candidates.push(`History=${h}`);
    }

    // 4) 可选：从 artifacts 提取最近的要点（轻量实现）
    const artifactsDir = getProjectPath(PATHS.ARTIFACTS_DIR);
    try {
      if (fs.existsSync(artifactsDir)) {
        const files = fs.readdirSync(artifactsDir).filter(f => f.endsWith('.md'));
        const latestMd = files.sort((a, b) => {
          const aTime = fs.statSync(path.join(artifactsDir, a)).mtimeMs;
          const bTime = fs.statSync(path.join(artifactsDir, b)).mtimeMs;
          return bTime - aTime;
        })[0];
        if (latestMd) {
          const content = fs.readFileSync(path.join(artifactsDir, latestMd), 'utf-8');
          const summary = extractKeyPoints(content, 8);
          if (summary.length > 0) {
            candidates.push(`Artifacts=${summary.join(' | ')}`);
          }
        }
      }
    } catch (e) {
      log.debug(`读取artifacts失败: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 5) 相关性评分与筛选
    const scored = scoreByRelevance(prompt, candidates);
    let filtered = scored
      .filter(s => s.score >= opts.relevanceThreshold)
      .map(s => s.text);

    // 6) 偏好最近：将包含时间戳或带 History 的条目优先
    if (opts.preferRecent) {
      filtered = filtered.sort((a, b) => {
        const ar = recentWeight(a);
        const br = recentWeight(b);
        return br - ar;
      });
    }

    // 7) Token 预算截断
    const output: string[] = [];
    let used = 0;
    for (const msg of filtered) {
      const t = estimateTokens(msg);
      if (used + t > opts.maxContextTokens) break;
      output.push(msg);
      used += t;
    }

    return output;
  }
}

function extractKeyPoints(md: string, maxPoints: number): string[] {
  const lines = md.split('\n');
  const points: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(?:[-*]\s|\d+[.)]\s)/.test(trimmed)) {
      points.push(trimmed.replace(/^\d+[.)]\s|^[-*]\s/, ''));
      if (points.length >= maxPoints) break;
    }
  }
  return points;
}

function scoreByRelevance(prompt: string, texts: string[]): Array<{ text: string; score: number }> {
  const pTokens = tokenize(prompt);
  const res: Array<{ text: string; score: number }> = [];
  for (const t of texts) {
    const tt = tokenize(t);
    const score = jaccard(pTokens, tt);
    res.push({ text: t, score });
  }
  return res;
}

function tokenize(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .split(/[^a-zA-Z0-9_\u4e00-\u9fa5]+/)
    .filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const inter = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return inter.size / union.size;
}

function recentWeight(text: string): number {
  // 带 History/时间戳的上下文给更高权重
  let w = 0;
  if (/history/i.test(text)) w += 0.2;
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) w += 0.3;
  if (/currentstep|completed/i.test(text)) w += 0.1;
  return w;
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  const len = text.length;
  return Math.ceil(len / 2.5);
}

function safeJson(v: any): string {
  try { return JSON.stringify(v); } catch { return String(v); }
}

export const contextManager = new ContextManager();