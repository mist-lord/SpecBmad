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

  test('应该能够按 endTime 过滤事件', () => {
    const now = new Date();
    const event1 = {
      type: 'phase_transition' as const,
      phase: 1,
      status: 'passed' as const,
      timestamp: new Date(now.getTime() - 2000).toISOString(),
      actor: 'test'
    };
    const event2 = {
      type: 'phase_transition' as const,
      phase: 2,
      status: 'passed' as const,
      timestamp: new Date(now.getTime() + 2000).toISOString(),
      actor: 'test'
    };

    store.appendEvent(event1);
    store.appendEvent(event2);

    const events = store.queryEvents({
      endTime: now.toISOString()
    });
    expect(events.length).toBe(1);
    expect(events[0].phase).toBe(1);
  });

  test('queryEvents 文件不存在时应返回空数组', () => {
    // Create store pointing to non-existent path
    const nonExistentDir = path.join(__dirname, '../../temp-events-nonexist');
    const freshStore = new EventStore(nonExistentDir);
    // Remove the event log file that constructor may have created (directory only)
    const logPath = freshStore.getEventLogPath();
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }

    const events = freshStore.queryEvents();
    expect(events).toEqual([]);

    // Cleanup
    if (fs.existsSync(nonExistentDir)) {
      fs.rmSync(nonExistentDir, { recursive: true, force: true });
    }
  });

  test('queryEvents JSON 解析失败时应返回空数组', () => {
    // Write invalid JSON to the event log
    const logPath = store.getEventLogPath();
    fs.writeFileSync(logPath, 'invalid-json-content\n', 'utf-8');

    const events = store.queryEvents();
    expect(events).toEqual([]);
  });

  test('appendEvent 写入失败时应抛出错误', () => {
    // Create store with a read-only path to trigger write failure
    const readOnlyDir = path.join(__dirname, '../../temp-events-readonly');
    const readOnlyStore = new EventStore(readOnlyDir);
    const logPath = readOnlyStore.getEventLogPath();

    // Make the event log directory read-only
    const logDir = path.dirname(logPath);
    // Write a file, then make the path a file instead of directory to cause write failure
    fs.writeFileSync(logPath, '', 'utf-8');
    // Replace event log path target with a directory to cause appendFileSync to fail
    fs.unlinkSync(logPath);
    fs.mkdirSync(logPath, { recursive: true }); // logPath is now a directory, appendFileSync will fail

    const event = {
      type: 'phase_transition' as const,
      phase: 1,
      status: 'passed' as const,
      timestamp: new Date().toISOString(),
      actor: 'test'
    };

    expect(() => store.appendEvent(event)).not.toThrow(); // store writes to tempDir, not readOnlyDir

    expect(() => readOnlyStore.appendEvent(event)).toThrow(
      expect.objectContaining({ message: expect.stringContaining('Event Store 写入失败') })
    );

    // Cleanup
    if (fs.existsSync(readOnlyDir)) {
      fs.rmSync(readOnlyDir, { recursive: true, force: true });
    }
  });

  test('getEventLogPath 应返回正确的路径', () => {
    const logPath = store.getEventLogPath();
    expect(logPath).toBe(path.join(tempDir, 'events', 'event_log.jsonl'));
  });

  test('phase 过滤器应排除没有 phase 属性的事件', () => {
    const phaseEvent = {
      type: 'phase_transition' as const,
      phase: 1,
      status: 'passed' as const,
      timestamp: new Date().toISOString(),
      actor: 'test'
    };
    const errorEvent = {
      type: 'error' as const,
      phase: 2,
      timestamp: new Date().toISOString(),
      error: 'Something failed'
    };

    store.appendEvent(phaseEvent);
    store.appendEvent(errorEvent as any);

    // Filter by phase 1 should only return the phase_transition event
    const events = store.queryEvents({ phase: 1 });
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('phase_transition');
  });
});

