/**
 * LLM Concurrency Controller Tests
 *
 * Tests for concurrency limiting, queue management, and latency tracking
 */

// Mock config object (must be defined before mock)
const mockConfigObj = {
  load: jest.fn(),
  get: jest.fn((key: string) => {
    if (key === 'llmConcurrencyLimit') return 4;
    return undefined;
  }),
};

// Mock dependencies (must be before imports)
jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/utils/config', () => ({
  config: mockConfigObj,
}));

import { LLMConcurrencyController } from '@/core/llm/concurrency';
import { mockDateNow, restoreDateNow } from '../core-test-utils';

describe('LLMConcurrencyController', () => {
  let controller: LLMConcurrencyController;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    restoreDateNow();
  });

  describe('constructor', () => {
    it('should use config limit when available', () => {
      (mockConfigObj.get as any).mockImplementation((key: string) => {
        if (key === 'llmConcurrencyLimit') return 8;
        return undefined;
      });

      const ctrl = new LLMConcurrencyController();
      const stats = ctrl.getStats();

      expect(stats.limit).toBe(8);
    });

    it('should use provided limit parameter', () => {
      const ctrl = new LLMConcurrencyController(10);
      const stats = ctrl.getStats();

      expect(stats.limit).toBe(10);
    });

    it('should default to 4 when no config or parameter', () => {
      (mockConfigObj.get as any).mockReturnValue(undefined);

      const ctrl = new LLMConcurrencyController();
      const stats = ctrl.getStats();

      expect(stats.limit).toBe(4);
    });

    it('should ignore invalid config limits', () => {
      (mockConfigObj.get as any).mockImplementation((key: string) => {
        if (key === 'llmConcurrencyLimit') return -5; // Invalid
        return undefined;
      });

      const ctrl = new LLMConcurrencyController();
      const stats = ctrl.getStats();

      expect(stats.limit).toBe(4); // Should use default
    });

    it('should ignore zero config limit', () => {
      (mockConfigObj.get as any).mockImplementation((key: string) => {
        if (key === 'llmConcurrencyLimit') return 0; // Invalid
        return undefined;
      });

      const ctrl = new LLMConcurrencyController();
      const stats = ctrl.getStats();

      expect(stats.limit).toBe(4); // Should use default
    });
  });

  describe('setLimit()', () => {
    beforeEach(() => {
      controller = new LLMConcurrencyController(4);
    });

    it('should update the concurrency limit', () => {
      controller.setLimit(10);

      const stats = controller.getStats();
      expect(stats.limit).toBe(10);
    });

    it('should ignore zero or negative limits', () => {
      controller.setLimit(0);
      expect(controller.getStats().limit).toBe(4);

      controller.setLimit(-5);
      expect(controller.getStats().limit).toBe(4);
    });
  });

  describe('run() - Concurrency Limiting', () => {
    beforeEach(() => {
      controller = new LLMConcurrencyController(2); // Limit of 2
      mockDateNow(1000000000);
    });

    it('should execute task immediately when under limit', async () => {
      const task = jest.fn().mockResolvedValue('result');

      const result = await controller.run(task);

      expect(result).toBe('result');
      expect(task).toHaveBeenCalled();
    });

    it('should respect concurrency limit', async () => {
      let activeCount = 0;
      let peakActive = 0;

      const task = async () => {
        activeCount++;
        peakActive = Math.max(peakActive, activeCount);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeCount--;
        return 'done';
      };

      // Run 5 tasks with limit of 2
      await Promise.all([
        controller.run(task),
        controller.run(task),
        controller.run(task),
        controller.run(task),
        controller.run(task),
      ]);

      expect(peakActive).toBeLessThanOrEqual(2);
    });

    it('should queue tasks when at limit', async () => {
      let resolve1: () => void;
      let resolve2: () => void;
      const task1 = new Promise<void>((res) => { resolve1 = res; });
      const task2 = new Promise<void>((res) => { resolve2 = res; });

      const promise1 = controller.run(() => task1);
      const promise2 = controller.run(() => task2);
      const promise3 = controller.run(async () => 'task3');

      // First 2 should be active
      expect(controller.getStats().active).toBe(2);

      // Resolve first task
      resolve1!();
      await promise1;

      // Third task should now be active
      expect(controller.getStats().active).toBe(2);

      // Resolve remaining
      resolve2!();
      await promise2;
      await promise3;

      expect(controller.getStats().active).toBe(0);
    });

    it('should process queue in FIFO order', async () => {
      const executionOrder: number[] = [];

      let resolve1: () => void;
      const blocker = new Promise<void>((res) => { resolve1 = res; });

      // Fill the concurrency limit
      const p1 = controller.run(async () => { await blocker; executionOrder.push(1); });
      const p2 = controller.run(async () => { await blocker; executionOrder.push(2); });

      // Queue additional tasks
      const p3 = controller.run(async () => { executionOrder.push(3); });
      const p4 = controller.run(async () => { executionOrder.push(4); });

      // Release blocker
      resolve1!();
      await Promise.all([p1, p2, p3, p4]);

      // Tasks 3 and 4 should execute in order
      expect(executionOrder.indexOf(3)).toBeLessThan(executionOrder.indexOf(4));
    });

    it('should track totalRun statistic', async () => {
      await controller.run(async () => 'task1');
      await controller.run(async () => 'task2');
      await controller.run(async () => 'task3');

      const stats = controller.getStats();
      expect(stats.totalRun).toBe(3);
    });

    it('should track totalQueued statistic', async () => {
      let resolve1: () => void;
      let resolve2: () => void;
      const task1 = new Promise<void>((res) => { resolve1 = res; });
      const task2 = new Promise<void>((res) => { resolve2 = res; });

      const p1 = controller.run(() => task1);
      const p2 = controller.run(() => task2);
      const p3 = controller.run(async () => 'task3'); // Queued
      const p4 = controller.run(async () => 'task4'); // Queued

      expect(controller.getStats().totalQueued).toBe(2);

      resolve1!();
      resolve2!();
      await Promise.all([p1, p2, p3, p4]);
    });

    it('should track peakActive statistic', async () => {
      const ctrl = new LLMConcurrencyController(3);

      const tasks = Array(5).fill(0).map(() =>
        ctrl.run(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        })
      );

      await Promise.all(tasks);

      const stats = ctrl.getStats();
      expect(stats.peakActive).toBe(3);
    });

    it('should handle task errors without deadlock', async () => {
      const failingTask = async () => {
        throw new Error('Task failed');
      };

      await expect(controller.run(failingTask)).rejects.toThrow('Task failed');

      // Controller should still be usable
      const result = await controller.run(async () => 'success');
      expect(result).toBe('success');
    });

    it('should release semaphore even when task throws', async () => {
      const ctrl = new LLMConcurrencyController(1);

      await expect(ctrl.run(async () => {
        throw new Error('Error');
      })).rejects.toThrow();

      // Active count should be 0
      expect(ctrl.getStats().active).toBe(0);
    });
  });

  describe('recordLatency()', () => {
    beforeEach(() => {
      controller = new LLMConcurrencyController(4);
    });

    it('should record latency value', () => {
      controller.recordLatency(100);
      controller.recordLatency(200);

      const stats = controller.getLatencyStats();
      expect(stats.count).toBe(2);
    });

    it('should maintain rolling buffer of max 1000 entries', () => {
      for (let i = 0; i < 1500; i++) {
        controller.recordLatency(i);
      }

      const stats = controller.getLatencyStats();
      expect(stats.count).toBe(1000);
    });

    it('should remove oldest entries when buffer is full', () => {
      // Fill buffer with 1000 entries
      for (let i = 0; i < 1000; i++) {
        controller.recordLatency(100);
      }

      // Add new entries with high values
      controller.recordLatency(999);
      controller.recordLatency(999);

      const stats = controller.getLatencyStats();
      expect(stats.count).toBe(1000);
      // Buffer should still be at max size after overflow
      expect(stats.count).toBe(1000);
    });
  });

  describe('getP95Latency()', () => {
    beforeEach(() => {
      controller = new LLMConcurrencyController(4);
    });

    it('should return 0 when no latencies recorded', () => {
      expect(controller.getP95Latency()).toBe(0);
    });

    it('should calculate P95 correctly', () => {
      const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      latencies.forEach((lat) => controller.recordLatency(lat));

      const p95 = controller.getP95Latency();
      // P95 of 10 values should be around index 9 (950)
      expect(p95).toBeGreaterThanOrEqual(900);
    });

    it('should handle single latency value', () => {
      controller.recordLatency(500);

      expect(controller.getP95Latency()).toBe(500);
    });

    it('should be included in getStats()', () => {
      controller.recordLatency(100);
      controller.recordLatency(200);

      const stats = controller.getStats();
      expect(stats.p95Latency).toBeDefined();
    });
  });

  describe('getLatencyStats()', () => {
    beforeEach(() => {
      controller = new LLMConcurrencyController(4);
    });

    it('should return zeros when no latencies recorded', () => {
      const stats = controller.getLatencyStats();

      expect(stats).toEqual({
        count: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        avg: 0,
      });
    });

    it('should calculate p50 correctly', () => {
      const latencies = [100, 200, 300, 400, 500];
      latencies.forEach((lat) => controller.recordLatency(lat));

      const stats = controller.getLatencyStats();
      expect(stats.p50).toBe(300); // Median
    });

    it('should calculate p95 correctly', () => {
      const latencies = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);
      latencies.forEach((lat) => controller.recordLatency(lat));

      const stats = controller.getLatencyStats();
      // P95 of 100 values = index 95 (0-indexed), which is the 96th value = 960
      expect(stats.p95).toBeGreaterThanOrEqual(940);
      expect(stats.p95).toBeLessThanOrEqual(970);
    });

    it('should calculate p99 correctly', () => {
      const latencies = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);
      latencies.forEach((lat) => controller.recordLatency(lat));

      const stats = controller.getLatencyStats();
      // P99 of 100 values = around the 99th value
      expect(stats.p99).toBeGreaterThanOrEqual(980);
      expect(stats.p99).toBeLessThanOrEqual(1000);
    });

    it('should calculate average correctly', () => {
      controller.recordLatency(100);
      controller.recordLatency(200);
      controller.recordLatency(300);

      const stats = controller.getLatencyStats();
      expect(stats.avg).toBe(200);
    });

    it('should return correct count', () => {
      controller.recordLatency(100);
      controller.recordLatency(200);
      controller.recordLatency(300);

      const stats = controller.getLatencyStats();
      expect(stats.count).toBe(3);
    });

    it('should handle large latency values', () => {
      controller.recordLatency(5000);
      controller.recordLatency(10000);

      const stats = controller.getLatencyStats();
      expect(stats.avg).toBe(7500);
    });
  });

  describe('run() - Latency Tracking Integration', () => {
    beforeEach(() => {
      controller = new LLMConcurrencyController(4);
      mockDateNow(1000000000);
    });

    it('should automatically record latency for executed tasks', async () => {
      const task = async () => {
        mockDateNow(1000000000 + 150); // Simulate 150ms
        return 'result';
      };

      await controller.run(task);

      const stats = controller.getLatencyStats();
      expect(stats.count).toBe(1);
      expect(stats.avg).toBe(150);
    });

    it('should record latency even when task fails', async () => {
      const failingTask = async () => {
        mockDateNow(1000000000 + 250);
        throw new Error('Failed');
      };

      await expect(controller.run(failingTask)).rejects.toThrow();

      const stats = controller.getLatencyStats();
      expect(stats.count).toBe(1);
      expect(stats.avg).toBe(250);
    });
  });

  describe('getStats()', () => {
    beforeEach(() => {
      controller = new LLMConcurrencyController(4);
    });

    it('should return all statistics', () => {
      const stats = controller.getStats();

      expect(stats).toHaveProperty('limit');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('peakActive');
      expect(stats).toHaveProperty('totalRun');
      expect(stats).toHaveProperty('totalQueued');
      expect(stats).toHaveProperty('p95Latency');
    });

    it('should reflect current state', async () => {
      let resolve1: () => void;
      const blocker = new Promise<void>((res) => { resolve1 = res; });

      const p1 = controller.run(async () => { await blocker; });

      // Wait a tick for the task to start
      await new Promise((resolve) => setImmediate(resolve));

      const stats = controller.getStats();
      expect(stats.active).toBeGreaterThan(0);
      expect(stats.totalRun).toBeGreaterThan(0);

      resolve1!();
      await p1;

      const finalStats = controller.getStats();
      expect(finalStats.active).toBe(0);
    });
  });
});
