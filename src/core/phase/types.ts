// 4-Phase MVP: 0=Capture, 1=Design, 2=Build, 3=Review
export type PhaseNumber = 0 | 1 | 2 | 3;

export interface PhaseTransitionConfig {
  phases: Record<number, {
    next: number[];
    gates: string[];
  }>;
}

export interface PhaseContext {
  projectRoot: string;
  currentPhase: PhaseNumber;
  metadata?: Record<string, unknown>;
}

export interface GateResult {
  gateId: string;
  passed: boolean;
  blocking?: boolean;  // 是否阻断 Phase 迁移，默认 true
  message?: string;
  details?: Record<string, unknown>;
}

export interface PhaseResult {
  success: boolean;
  fromPhase: PhaseNumber;
  toPhase: PhaseNumber;
  gateResults: GateResult[];
  error?: string;
  timestamp: string;
  circuitState?: 'closed' | 'open' | 'half-open';
}

export interface PhaseState {
  currentPhase: PhaseNumber;
  lastTransition: string;
  gateHistory: GateResult[];
}

export type EventType = 'phase_transition' | 'gate_check' | 'agent_execution' | 'error' | 'failure';

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

export interface FailureEvent {
  type: 'failure';
  phase: number;
  timestamp: string;
  error: string;
  context: Record<string, unknown>;
}

export type Event = PhaseEvent | GateEvent | AgentEvent | ErrorEvent | FailureEvent;
