/**
 * Phase Controller 相关类型定义
 */

export type PhaseNumber = 0 | 1 | 2 | 3 | 4 | 5;

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
}

export interface PhaseState {
  currentPhase: PhaseNumber;
  lastTransition: string;
  gateHistory: GateResult[];
}

