import { Orchestrator } from '@/core/workflow/orchestrator';
import { renderWorkflowMarkdownSummary } from '@/utils/summary';
import { registerScrumMasterAgent } from '@/agents/scrum-master';
import { AgentContext } from '@/types';

// Mock LLM manager to avoid real API calls and return deterministic outputs
jest.mock('@/core/llm/manager', () => {
  const fakeClient = {
    name: 'test-llm',
    type: 'custom',
    isAvailable: jest.fn().mockResolvedValue(true),
    generateText: jest.fn().mockImplementation(async (_prompt: string, _options: any) => {
      // Return strict JSON output so summary can parse goals/actions/stories
      return JSON.stringify({
        goals: ['提升迭代速度', '清理技术债'],
        actions: ['准备待办列表', '明确优先级'],
        stories: [
          { id: 'S-1', title: '实现用户登录', priority: 'High', estimate: '5' },
          { id: 'S-2', title: '优化首页加载速度', priority: 'Medium', estimate: '3' }
        ]
      });
    }),
    generateStructured: jest.fn().mockResolvedValue({})
  };
  return {
    llmManager: {
      initialize: jest.fn().mockResolvedValue(undefined),
      getDefaultClient: jest.fn().mockReturnValue(fakeClient),
      addClient: jest.fn(),
      reset: jest.fn()
    }
  };
});

describe('Orchestrator smoke test', () => {
  beforeAll(() => {
    // Ensure ScrumMaster agent is registered for factory usage
    registerScrumMasterAgent();
  });

  test('planning-only workflow passes format and renders markdown summary', async () => {
    const orchestrator = new Orchestrator();

    const ctx: AgentContext = {
      projectState: {
        projectName: '测试项目',
        workflow: {
          currentStep: '',
          completedSteps: []
        }
      },
      workingDirectory: process.cwd(),
      inputData: {}
    };

    // Execute with default format set to JSON to verify propagation
    const results = await orchestrator.executeWorkflow('planning-only', ctx, 'json');

    expect(results.length).toBe(2);
    for (const r of results) {
      expect(r.success).toBe(true);
      // ScrumMasterAgent stores received format in metadata
      expect(r.metadata?.format).toBe('json');
      // Metrics should be present and numeric
      expect(r.metadata?.metrics).toBeDefined();
      const m = r.metadata?.metrics!;
      expect(typeof m.inputTokens).toBe('number');
      expect(typeof m.outputTokens).toBe('number');
      expect(typeof m.latencyMs).toBe('number');
    }

    const summary = renderWorkflowMarkdownSummary('planning-only', results);
    // High-level sections
    expect(summary).toContain('# 工作流汇总: planning-only');
    expect(summary).toContain('## LLM Usage');
    expect(summary).toContain('Tokens In:');
    expect(summary).toContain('Tokens Out:');
    expect(summary).toContain('## Next Actions');
    expect(summary).toContain('## Sprint Goals');
    expect(summary).toContain('## Stories');
    expect(summary).toContain('## Steps Summary');
    // Step details include agent name
    expect(summary).toContain('agent=ScrumMaster');
    expect(summary).toContain('Step 1');
    expect(summary).toContain('Step 2');
  });
});