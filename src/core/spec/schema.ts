/**
 * Spec Schema 定义
 * 
 * 定义 intent.yaml 和 formal_spec.yaml 的 TypeScript 类型
 */

export interface IntentSpec {
  schema_version: number;
  title: string;
  description: string;
  requirements: Requirement[];
  constraints?: Constraint[];
  metadata?: Record<string, unknown>;
}

export interface Requirement {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  acceptance_criteria?: string[];
}

export interface Constraint {
  id: string;
  description: string;
  type: 'functional' | 'non-functional' | 'technical';
}

export interface FormalSpec {
  schema_version: number;
  intent_spec_ref: string; // 引用 intent.yaml
  invariants: Invariant[];
  preconditions: Precondition[];
  postconditions: Postcondition[];
  constraints?: Constraint[];
  metadata?: Record<string, unknown>;
}

export interface Invariant {
  id: string;
  description: string;
  expression?: string; // 可选的逻辑表达式
}

export interface Precondition {
  action: string;
  requires: string; // 条件表达式
}

export interface Postcondition {
  action: string;
  ensures: string; // 条件表达式
}

