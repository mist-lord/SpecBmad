/**
 * Utils module test utilities
 *
 * Shared fixtures and mock factories for testing src/utils/* modules.
 */

import { AgentResult } from '@/types';

/**
 * Create a sample AgentResult for dashboard/summary testing
 */
export function createAgentResult(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    success: true,
    output: JSON.stringify({
      goals: ['Build MVP'],
      actions: ['Create API endpoints'],
      stories: [{ id: 'S-1', title: 'User login', priority: 'high', estimate: '3d' }],
    }),
    artifacts: [],
    nextSteps: ['Deploy to staging'],
    metadata: {
      agent: 'Analyst',
      mode: 'interactive',
      metrics: {
        model: 'gpt-4',
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 200,
        costUSD: 0.005,
      },
    },
    ...overrides,
  };
}

/**
 * Create multiple AgentResults with different agents/models
 */
export function createMultipleAgentResults(): AgentResult[] {
  return [
    createAgentResult({
      metadata: {
        agent: 'Analyst',
        mode: 'interactive',
        metrics: { model: 'gpt-4', inputTokens: 100, outputTokens: 50, latencyMs: 200, costUSD: 0.005 },
      },
    }),
    createAgentResult({
      output: JSON.stringify({ goals: ['Refine architecture'], actions: ['Update schema'] }),
      metadata: {
        agent: 'Architect',
        mode: 'batch',
        metrics: { model: 'claude-3', inputTokens: 200, outputTokens: 100, latencyMs: 300, costUSD: 0.01 },
      },
      nextSteps: ['Review schema'],
    }),
    createAgentResult({
      output: 'Plain text output (not JSON)',
      metadata: {
        agent: 'Analyst',
        mode: 'interactive',
        metrics: { model: 'gpt-4', inputTokens: 50, outputTokens: 25, latencyMs: 0, costUSD: 0.001 },
      },
      nextSteps: [],
    }),
  ];
}

/**
 * Create an AgentResult with no metrics
 */
export function createAgentResultNoMetrics(): AgentResult {
  return {
    success: true,
    output: 'simple output',
    artifacts: [],
    metadata: {},
  };
}
