import { renderWorkflowMarkdownSummary } from '@/utils/summary';
import { createAgentResult, createMultipleAgentResults, createAgentResultNoMetrics } from './utils-test-utils';

describe('renderWorkflowMarkdownSummary', () => {
  it('should render header with workflow name and step count', () => {
    const output = renderWorkflowMarkdownSummary('full-development', []);

    expect(output).toContain('# 工作流汇总: full-development');
    expect(output).toContain('共执行步骤: 0');
  });

  it('should extract goals from JSON output', () => {
    const results = [createAgentResult()];
    const output = renderWorkflowMarkdownSummary('test', results);

    expect(output).toContain('## Sprint Goals');
    expect(output).toContain('- Build MVP');
  });

  it('should extract stories into a table', () => {
    const results = [createAgentResult()];
    const output = renderWorkflowMarkdownSummary('test', results);

    expect(output).toContain('## Stories');
    expect(output).toContain('| S-1 | User login | high | 3d |');
  });

  it('should extract actions from JSON output and nextSteps', () => {
    const results = [createAgentResult()];
    const output = renderWorkflowMarkdownSummary('test', results);

    expect(output).toContain('## Next Actions');
    expect(output).toContain('- Create API endpoints');
    expect(output).toContain('- Deploy to staging');
  });

  it('should aggregate LLM usage metrics', () => {
    const results = createMultipleAgentResults();
    const output = renderWorkflowMarkdownSummary('test', results);

    expect(output).toContain('## LLM Usage');
    // 100 + 200 + 50 = 350
    expect(output).toContain('Tokens In: 350');
    // 50 + 100 + 25 = 175
    expect(output).toContain('Tokens Out: 175');
    expect(output).toContain('Tokens Total: 525');
  });

  it('should render steps summary with agent details', () => {
    const results = [createAgentResult()];
    const output = renderWorkflowMarkdownSummary('test', results);

    expect(output).toContain('## Steps Summary');
    expect(output).toContain('Step 1: agent=Analyst');
    expect(output).toContain('model=gpt-4');
    expect(output).toContain('tokens_in=100');
  });

  it('should handle non-JSON output gracefully', () => {
    const results = [createAgentResult({ output: 'plain text, not JSON' })];
    const output = renderWorkflowMarkdownSummary('test', results);

    // Should not have goals/stories sections since output is not JSON
    expect(output).not.toContain('## Sprint Goals');
    expect(output).not.toContain('## Stories');
    // But nextSteps still appear as actions
    expect(output).toContain('## Next Actions');
  });

  it('should deduplicate goals and actions', () => {
    const results = [
      createAgentResult({
        output: JSON.stringify({ goals: ['Goal A', 'Goal A'], actions: ['Act 1', 'Act 1'] }),
        nextSteps: ['Act 1'],
      }),
    ];
    const output = renderWorkflowMarkdownSummary('test', results);

    // Count occurrences - should appear only once each
    const goalMatches = output.match(/- Goal A/g);
    expect(goalMatches).toHaveLength(1);
    const actMatches = output.match(/- Act 1/g);
    expect(actMatches).toHaveLength(1);
  });

  it('should handle results with no metadata metrics', () => {
    const results = [createAgentResultNoMetrics()];
    const output = renderWorkflowMarkdownSummary('test', results);

    expect(output).toContain('Tokens In: 0');
    expect(output).toContain('Tokens Out: 0');
    expect(output).toContain('agent=unknown');
  });

  it('should calculate average latency correctly', () => {
    const results = createMultipleAgentResults();
    const output = renderWorkflowMarkdownSummary('test', results);

    // (200 + 300 + 0) / 3 = 166.67
    expect(output).toContain('Avg Latency (ms): 166.67');
  });
});
