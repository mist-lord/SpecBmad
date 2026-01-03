import fs from 'fs';
import path from 'path';
import { workflowCommand } from '../src/commands/workflow';
import { PATHS, getProjectPath } from '../src/utils/paths';

// Mock LLM manager to avoid real API calls and return deterministic outputs
jest.mock('../src/core/llm/manager', () => {
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

const reportDir = path.join(getProjectPath(PATHS.ARTIFACTS_DIR), 'naming');

afterAll(() => {
  try {
    const files = fs.readdirSync(reportDir).filter(f => f.startsWith('workflow'));
    for (const f of files) {
      try { fs.unlinkSync(path.join(reportDir, f)); } catch {}
    }
  } catch {}
});

describe('workflow naming options', () => {
  test('adds date prefix when --date-prefix is enabled', async () => {
    await workflowCommand({ name: 'planning-only', format: 'markdown', reportDir, datePrefix: true } as any);
    const files = fs.readdirSync(reportDir).filter(f => f.endsWith('.md'));
    // Expect a file like YYYYMMDD-HHmmss-workflow.md
    const matched = files.some(f => /^\d{8}-\d{6}-workflow\.md$/.test(f));
    expect(matched).toBe(true);
  });

  test('dedup adds incremental suffix when file exists', async () => {
    // First write without date prefix
    await workflowCommand({ name: 'planning-only', format: 'markdown', reportDir, dedupe: true } as any);
    // Second write should avoid overwrite and create workflow-1.md
    await workflowCommand({ name: 'planning-only', format: 'markdown', reportDir, dedupe: true } as any);

    const files = fs.readdirSync(reportDir).filter(f => f.endsWith('.md'));
    expect(files.includes('workflow.md')).toBe(true);
    expect(files.includes('workflow-1.md')).toBe(true);
  });
});