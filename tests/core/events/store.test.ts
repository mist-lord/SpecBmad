/**
 * Event Store 测试
 */

import { EventStore } from '@/core/events/store';
import fs from 'fs';
import path from 'path';

describe('EventStore', () => {
  let tempDir: string;
  let store: EventStore;

  beforeEach(() => {
    tempDir = path.join(__dirname, '../../temp-events-test');
    store = new EventStore(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('应该能够追加事件', () => {
    const event = {
      type: 'phase_transition' as const,
      phase: 1,
      status: 'passed' as const,
      timestamp: new Date().toISOString(),
      actor: 'test'
    };

    expect(() => store.appendEvent(event)).not.toThrow();
  });

  test('应该能够查询事件', () => {
    const event = {
      type: 'phase_transition' as const,
      phase: 1,
      status: 'passed' as const,
      timestamp: new Date().toISOString(),
      actor: 'test'
    };

    store.appendEvent(event);
    const events = store.queryEvents({ type: 'phase_transition' });

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('phase_transition');
  });

  test('应该能够按 Phase 过滤事件', () => {
    const event1 = {
      type: 'phase_transition' as const,
      phase: 1,
      status: 'passed' as const,
      timestamp: new Date().toISOString(),
      actor: 'test'
    };
    const event2 = {
      type: 'phase_transition' as const,
      phase: 2,
      status: 'passed' as const,
      timestamp: new Date().toISOString(),
      actor: 'test'
    };

    store.appendEvent(event1);
    store.appendEvent(event2);

    const events = store.queryEvents({ phase: 1 });
    expect(events.length).toBe(1);
    expect(events[0].phase).toBe(1);
  });

  test('应该能够获取 Phase 历史', () => {
    const event1 = {
      type: 'phase_transition' as const,
      phase: 1,
      status: 'passed' as const,
      timestamp: new Date().toISOString(),
      actor: 'test'
    };
    const event2 = {
      type: 'phase_transition' as const,
      phase: 2,
      status: 'passed' as const,
      timestamp: new Date().toISOString(),
      actor: 'test'
    };

    store.appendEvent(event1);
    store.appendEvent(event2);

    const history = store.getPhaseHistory(1);
    expect(history.length).toBe(1);
    expect(history[0].phase).toBe(1);
    expect(history[0].status).toBe('passed');
  });

  test('应该能够回放事件', () => {
    const event1 = {
      type: 'phase_transition' as const,
      phase: 1,
      status: 'passed' as const,
      timestamp: new Date().toISOString(),
      actor: 'test'
    };
    const event2 = {
      type: 'gate_check' as const,
      gateId: 'openspec_passed',
      phase: 1,
      status: 'passed' as const,
      timestamp: new Date().toISOString()
    };

    store.appendEvent(event1);
    store.appendEvent(event2);

    const replayed = store.replayEvents({ type: 'phase_transition' });
    expect(replayed.length).toBe(1);
    expect(replayed[0].type).toBe('phase_transition');
  });

  test('应该能够按时间范围过滤事件', () => {
    const now = new Date();
    const event1 = {
      type: 'phase_transition' as const,
      phase: 1,
      status: 'passed' as const,
      timestamp: new Date(now.getTime() - 1000).toISOString(), // 1秒前
      actor: 'test'
    };
    const event2 = {
      type: 'phase_transition' as const,
      phase: 2,
      status: 'passed' as const,
      timestamp: now.toISOString(),
      actor: 'test'
    };

    store.appendEvent(event1);
    store.appendEvent(event2);

    const events = store.queryEvents({
      startTime: now.toISOString()
    });
    expect(events.length).toBe(1);
    expect(events[0].phase).toBe(2);
  });
});

