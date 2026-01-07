/**
 * Event Store
 * 
 * 所有决策可审计、可回放的事件存储
 */

import fs from 'fs';
import path from 'path';
import { log } from '@/utils/logger';

export type EventType = 
  | 'phase_transition'
  | 'gate_check'
  | 'agent_execution'
  | 'error'
  | 'failure';

export interface PhaseEvent {
  type: EventType;
  phase: number;
  status: 'passed' | 'failed';
  timestamp: string;
  actor: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  notes?: string;
}

export interface GateEvent {
  type: EventType;
  gateId: string;
  phase: number;
  status: 'passed' | 'failed';
  timestamp: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface AgentEvent {
  type: EventType;
  agentId: string;
  phase: number;
  status: 'passed' | 'failed';
  timestamp: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
}

export interface ErrorEvent {
  type: EventType;
  phase: number;
  timestamp: string;
  error: string;
  context?: Record<string, unknown>;
}

export type Event = PhaseEvent | GateEvent | AgentEvent | ErrorEvent;

export class EventStore {
  private eventLogPath: string;
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.eventLogPath = path.join(projectRoot, 'events', 'event_log.jsonl');
    this.ensureDirectory();
  }

  /**
   * 确保事件目录存在
   */
  private ensureDirectory(): void {
    const dir = path.dirname(this.eventLogPath);
    fs.mkdirSync(dir, { recursive: true });
  }

  /**
   * 追加事件（原子性写入）
   */
  appendEvent(event: Event): void {
    try {
      const line = JSON.stringify(event) + '\n';
      fs.appendFileSync(this.eventLogPath, line, 'utf-8');
      log.debug(`事件已追加: ${event.type} @ ${event.timestamp}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`Event Store 写入失败: ${msg}`);
      // 根据冻结版规范，Event Store 写入失败时必须停止执行
      throw new Error(`Event Store 写入失败，系统停止: ${msg}`);
    }
  }

  /**
   * 查询事件
   */
  queryEvents(filter?: {
    type?: EventType;
    phase?: number;
    startTime?: string;
    endTime?: string;
  }): Event[] {
    if (!fs.existsSync(this.eventLogPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.eventLogPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      const events: Event[] = lines.map(line => JSON.parse(line));

      // 应用过滤条件
      let filtered = events;

      if (filter?.type) {
        filtered = filtered.filter(e => e.type === filter.type);
      }

      if (filter?.phase !== undefined) {
        filtered = filtered.filter(e => {
          if ('phase' in e) {
            return e.phase === filter.phase;
          }
          return false;
        });
      }

      if (filter?.startTime) {
        filtered = filtered.filter(e => e.timestamp >= filter.startTime!);
      }

      if (filter?.endTime) {
        filtered = filtered.filter(e => e.timestamp <= filter.endTime!);
      }

      return filtered;
    } catch (error) {
      log.error(`查询事件失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 获取 Phase 历史
   */
  getPhaseHistory(phase: number): PhaseEvent[] {
    const events = this.queryEvents({ type: 'phase_transition', phase });
    return events.filter((e): e is PhaseEvent => e.type === 'phase_transition');
  }

  /**
   * 回放事件（用于调试和审计）
   */
  replayEvents(filter?: {
    type?: EventType;
    phase?: number;
    startTime?: string;
    endTime?: string;
  }): Event[] {
    return this.queryEvents(filter);
  }

  /**
   * 获取事件日志路径
   */
  getEventLogPath(): string {
    return this.eventLogPath;
  }
}

