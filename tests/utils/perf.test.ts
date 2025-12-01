import { PerfTracer } from '../../src/utils/perf';

describe('PerfTracer', () => {
  test('start/end records a sample with duration and memory', () => {
    const tracer = new PerfTracer();
    tracer.start('unit');
    const sample = tracer.end('unit');
    expect(sample.label).toBe('unit');
    expect(sample.durationMs).toBeGreaterThanOrEqual(0);
    expect(sample.memory.rss).toBeGreaterThan(0);
    const all = tracer.getSamples();
    expect(all.length).toBeGreaterThan(0);
  });

  test('measureAsync wraps async function and returns result/sample', async () => {
    const tracer = new PerfTracer();
    const { result, sample } = await tracer.measureAsync('async', async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    });
    expect(result).toBe(42);
    expect(sample.label).toBe('async');
    expect(sample.durationMs).toBeGreaterThanOrEqual(10);
  });
});