import { PerfTracer, PerfSample } from '../../src/utils/perf';

describe('PerfTracer', () => {
  test('start/end records a sample with duration and memory', () => {
    const tracer = new PerfTracer();
    tracer.start('unit');
    const sample = tracer.end('unit');
    expect(sample.label).toBe('unit');
    expect(sample.durationMs).toBeGreaterThanOrEqual(0);
    expect(sample.memory.rss).toBeGreaterThan(0);
    expect(sample.memory.heapTotal).toBeGreaterThan(0);
    expect(sample.memory.heapUsed).toBeGreaterThan(0);
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

  test('getSamples returns a copy of samples array', () => {
    const tracer = new PerfTracer();
    tracer.start('a');
    tracer.end('a');
    const samples1 = tracer.getSamples();
    const samples2 = tracer.getSamples();
    expect(samples1).not.toBe(samples2); // different array references
    expect(samples1).toEqual(samples2);  // same content
  });

  test('end without start still returns a sample', () => {
    const tracer = new PerfTracer();
    // end without start - should use current time as fallback
    const sample = tracer.end('never-started');
    expect(sample.label).toBe('never-started');
    expect(sample.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('multiple start/end accumulates samples', () => {
    const tracer = new PerfTracer();
    tracer.start('a');
    tracer.end('a');
    tracer.start('b');
    tracer.end('b');
    expect(tracer.getSamples()).toHaveLength(2);
    expect(tracer.getSamples()[0].label).toBe('a');
    expect(tracer.getSamples()[1].label).toBe('b');
  });

  test('measureAsync propagates errors', async () => {
    const tracer = new PerfTracer();
    await expect(
      tracer.measureAsync('fail', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
  });
});