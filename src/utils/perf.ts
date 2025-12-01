import { performance } from 'perf_hooks';

export interface PerfSample {
  label: string;
  durationMs: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
}

export class PerfTracer {
  private marks: Record<string, number> = {};
  private samples: PerfSample[] = [];

  start(label: string): void {
    this.marks[label] = performance.now();
  }

  end(label: string): PerfSample {
    const start = this.marks[label] || performance.now();
    const end = performance.now();
    const mu = process.memoryUsage();
    const sample: PerfSample = {
      label,
      durationMs: end - start,
      memory: {
        rss: mu.rss,
        heapTotal: mu.heapTotal,
        heapUsed: mu.heapUsed,
      },
    };
    this.samples.push(sample);
    return sample;
  }

  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; sample: PerfSample }> {
    this.start(label);
    const result = await fn();
    const sample = this.end(label);
    return { result, sample };
  }

  getSamples(): PerfSample[] {
    return [...this.samples];
  }
}