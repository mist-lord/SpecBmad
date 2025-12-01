import { config as projectConfig } from '@/utils/config';
import { log } from '@/utils/logger';

export class LLMConcurrencyController {
  private limit: number;
  private active: number = 0;
  private peakActive: number = 0;
  private totalRun: number = 0;
  private totalQueued: number = 0;
  private queue: Array<() => void> = [];

  constructor(limit?: number) {
    try { projectConfig.load(); } catch {}
    const cfgLimit = projectConfig.get('llmConcurrencyLimit');
    this.limit = typeof cfgLimit === 'number' && cfgLimit > 0 ? cfgLimit : (limit ?? 4);
  }

  setLimit(n: number) {
    if (n > 0) this.limit = n;
  }

  getStats(): { limit: number; active: number; peakActive: number; totalRun: number; totalQueued: number } {
    return { limit: this.limit, active: this.active, peakActive: this.peakActive, totalRun: this.totalRun, totalQueued: this.totalQueued };
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
      this.release();
      if (dur > 1000) {
        log.debug(`LLM并发任务完成，耗时=${dur}ms, active=${this.active}`);
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