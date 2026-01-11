import fs from 'fs';
import path from 'path';
import { PATHS, getProjectPath } from '@/utils/paths';

// Mock LLM manager to avoid ConfigManager constructor dependency
jest.mock('@/core/llm/manager', () => ({
  llmManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getDefaultClient: jest.fn().mockReturnValue({
      id: 'mock-llm',
      generateText: jest.fn().mockResolvedValue('mocked-response')
    })
  }
}));

import { workflowCommand } from '@/commands/workflow';

// Use config mock from tests/setup
import { config as mockConfig } from '@/utils/config';

// Ensure cleanup
afterAll(() => {
  const dir = getProjectPath(PATHS.CONFIG_DIR);
  try {
    const files = fs.readdirSync(dir).filter(f => f.startsWith('workflow'));
    for (const f of files) {
      try { fs.unlinkSync(path.join(dir, f)); } catch {}
    }
  } catch {}
});

describe('workflow command boundary cases', () => {
  test('throws when workflow name is undefined', async () => {
    await expect(workflowCommand({ name: 'not-exists', format: 'json', reportDir: PATHS.ARTIFACTS_DIR } as any))
      .rejects.toThrow(/工作流未定义或为空/);
  });

  test('falls back to json when format is invalid', async () => {
    const reportDir = path.join(getProjectPath(PATHS.ARTIFACTS_DIR), 'boundary');
    fs.mkdirSync(reportDir, { recursive: true });
    // 测试：传入无效格式 'invalid'，应该回退到 json
    await workflowCommand({ name: 'planning-only', format: 'invalid' as any, reportDir, dedupe: false, datePrefix: false } as any);
    // 检查目录中是否有 workflow.json 文件
    const files = fs.readdirSync(reportDir).filter(f => f.startsWith('workflow') && f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    const outPath = path.join(reportDir, files[0]);
    expect(fs.existsSync(outPath)).toBe(true);
    const obj = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    expect(obj.workflow).toBe('planning-only');
    expect(Array.isArray(obj.steps)).toBe(true);
  });

  test('throws when custom workflow contains unknown agent', async () => {
    jest.spyOn(mockConfig as any, 'getAll').mockReturnValue({
      workflows: {
        'custom-bad': {
          description: 'bad workflow',
          steps: [
            { id: 's1', name: 'Unknown', agent: 'NoSuchAgent' }
          ]
        }
      }
    });

    await expect(workflowCommand({ name: 'custom-bad', format: 'json', reportDir: PATHS.ARTIFACTS_DIR } as any))
      .rejects.toThrow();
  });

  test('throws when no default LLM client', async () => {
    jest.resetModules();
    // Mock llmManager to return null
    jest.doMock('@/core/llm/manager', () => ({
      llmManager: {
        initialize: jest.fn().mockResolvedValue(undefined),
        getDefaultClient: jest.fn().mockReturnValue(null)
      }
    }));

    const { workflowCommand: wf } = await import('@/commands/workflow');
    await expect(wf({ name: 'planning-only', format: 'json', reportDir: PATHS.ARTIFACTS_DIR } as any))
      .rejects.toThrow(/未找到可用的默认 LLM 客户端/);

    // Restore module mocks
    jest.dontMock('@/core/llm/manager');
  });
});