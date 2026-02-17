import { config as projectConfig } from '@/utils/config';
import { log } from '@/utils/logger';

export class LLMConcurrencyController {
  private limit: number;
  private active: number = 0;
  private peakActive: number = 0;
  private totalRun: number = 0;
  private totalQueued: number = 0;
  private queue: Array<() => void> = [];
  private latencies: number[] = [];
  private readonly maxLatencyRecords = 1000;

  constructor(limit?: number) {
    try { projectConfig.load(); } catch { /* use defaults */ }
    const cfgLimit = projectConfig.get('llmConcurrencyLimit');
    this.limit = typeof cfgLimit === 'number' && cfgLimit > 0 ? cfgLimit : (limit ?? 4);
  }

  setLimit(n: number) {
    if (n > 0) this.limit = n;
  }

  getStats(): { limit: number; active: number; peakActive: number; totalRun: number; totalQueued: number; p95Latency: number } {
    return {
      limit: this.limit,
      active: this.active,
      peakActive: this.peakActive,
      totalRun: this.totalRun,
      totalQueued: this.totalQueued,
      p95Latency: this.getP95Latency()
    };
  }

  /**
   * 记录一次LLM调用的延迟
   */
  recordLatency(ms: number): void {
    this.latencies.push(ms);
    if (this.latencies.length > this.maxLatencyRecords) {
      this.latencies.shift();
    }
  }

  /**
   * 获取P95延迟（毫秒）
   */
  getP95Latency(): number {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    return sorted[Math.min(p95Index, sorted.length - 1)];
  }

  /**
   * 获取延迟统计信息
   */
  getLatencyStats(): { count: number; p50: number; p95: number; p99: number; avg: number } {
    if (this.latencies.length === 0) {
      return { count: 0, p50: 0, p95: 0, p99: 0, avg: 0 };
    }
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const len = sorted.length;
    return {
      count: len,
      p50: sorted[Math.floor(len * 0.50)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.min(Math.floor(len * 0.99), len - 1)],
      avg: Math.round(sorted.reduce((a, b) => a + b, 0) / len)
    };
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    this.totalRun++;
    const started = Date.now();
    try {
      const result = await fn();
      return result;
    } finally {
      const dur = Date.now() - started;
      this.recordLatency(dur);
      this.release();
      if (dur > 1000) {
        log.debug(`LLM并发任务完成，耗时=${dur}ms, active=${this.active}, p95=${this.getP95Latency()}ms`);
      }
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      if (this.active > this.peakActive) this.peakActive = this.active;
      return Promise.resolve();
    }
    this.totalQueued++;
    return new Promise((resolve) => this.queue.push(() => {
      this.active++;
      if (this.active > this.peakActive) this.peakActive = this.active;
      resolve();
    }));
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

export const llmConcurrency = new LLMConcurrencyController();