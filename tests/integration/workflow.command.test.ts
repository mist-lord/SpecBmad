import fs from 'fs';
import path from 'path';
import { workflowCommand } from '@/commands/workflow';
import { PATHS, getProjectPath } from '@/utils/paths';

// Mock LLM manager to avoid real API calls and return deterministic outputs
jest.mock('@/core/llm/manager', () => {
  const fakeClient = {
    name: 'test-llm',
    type: 'custom',
    isAvailable: jest.fn().mockResolvedValue(true),
    generateText: jest.fn().mockImplementation(async (_prompt: string, _options: any) => {
      return JSON.stringify({
        goals: ['加速交付'],
        actions: ['准备待办列表'],
        stories: [
          { id: 'S-1', title: '用户登录', priority: 'High', estimate: '5' }
        ]
      });
    })
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

// Clean up output file after test
afterAll(() => {
  const dir = getProjectPath(PATHS.ARTIFACTS_DIR);
  const files = fs.readdirSync(dir).filter(f => f.startsWith('workflow-summary-test-'));
  for (const f of files) {
    try { fs.unlinkSync(path.join(dir, f)); } catch {}
  }
});

describe('workflow command', () => {
  test('writes markdown summary for full-development workflow', async () => {
    const outPath = path.join(getProjectPath(PATHS.ARTIFACTS_DIR), `workflow-summary-test-${Date.now()}.md`);
    await workflowCommand({ name: 'full-development', format: 'markdown', output: outPath } as any);

    const content = fs.readFileSync(outPath, 'utf-8');
    expect(content).toContain('# 工作流汇总: full-development');
    expect(content).toContain('## LLM Usage');
    // Steps summary should include agents used in the 4-Phase MVP workflow
    expect(content).toContain('agent=Analyst');
    expect(content).toContain('agent=Developer');
    expect(content).toContain('agent=QA');
  });

  test('writes json summary when format=json', async () => {
    const outPath = path.join(getProjectPath(PATHS.ARTIFACTS_DIR), `workflow-summary-test-${Date.now()}.json`);
    // 4-Phase MVP: use 'design-only' workflow instead of deleted 'planning-only'
    await workflowCommand({ name: 'design-only', format: 'json', output: outPath } as any);

    const obj = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    expect(obj.workflow).toBe('design-only');
    expect(Array.isArray(obj.steps)).toBe(true);
    expect(obj.steps.length).toBeGreaterThan(0);
    // 4-Phase MVP: design-only workflow uses Analyst and Architect agents
    expect(obj.steps.some((s: any) => s.agent === 'Analyst')).toBe(true);
  });
});