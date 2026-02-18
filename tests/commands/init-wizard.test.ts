jest.mock('chalk', () => {
  const passthrough = (s: string) => s;
  const fn = Object.assign(passthrough, { cyan: passthrough, bold: passthrough });
  fn.cyan = Object.assign(passthrough, { bold: passthrough });
  return {
    __esModule: true,
    default: fn,
    cyan: fn,
  };
});

jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() },
}));

jest.mock('@/core/stack', () => ({
  stackManager: {
    getRegisteredStacks: jest.fn().mockReturnValue(['typescript', 'python', 'cpp']),
    getPlugin: jest.fn().mockImplementation((s: string) => ({ name: s })),
  },
}));

jest.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: jest.fn(),
  },
}));

import inquirer from 'inquirer';
import { runInitWizard, WizardResult } from '@/commands/init-wizard';

const mockPrompt = inquirer.prompt as unknown as jest.Mock;

describe('runInitWizard', () => {
  let clearSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    clearSpy = jest.spyOn(console, 'clear').mockImplementation();
    logSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    clearSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('should return WizardResult with all fields', async () => {
    mockPrompt
      .mockResolvedValueOnce({ projectName: 'test-project', projectType: 'cli' })
      .mockResolvedValueOnce({ language: 'typescript' })
      .mockResolvedValueOnce({ features: ['git'], llmProvider: 'claude' });

    const result = await runInitWizard();

    expect(result).toEqual<WizardResult>({
      projectName: 'test-project',
      stack: 'typescript',
      template: 'ts-cli',
      features: ['git'],
      llmProvider: 'claude',
    });
  });

  it('should use default name when provided', async () => {
    mockPrompt
      .mockResolvedValueOnce({ projectName: 'custom-name', projectType: 'api' })
      .mockResolvedValueOnce({ language: 'typescript' })
      .mockResolvedValueOnce({ features: [], llmProvider: 'openai' });

    const result = await runInitWizard('custom-name');
    expect(result.projectName).toBe('custom-name');
  });

  it('should map python + cli to py-cli template', async () => {
    mockPrompt
      .mockResolvedValueOnce({ projectName: 'py-proj', projectType: 'cli' })
      .mockResolvedValueOnce({ language: 'python' })
      .mockResolvedValueOnce({ features: [], llmProvider: 'mock' });

    const result = await runInitWizard();
    expect(result.template).toBe('py-cli');
    expect(result.stack).toBe('python');
  });

  it('should map python + lib to py-lib template', async () => {
    mockPrompt
      .mockResolvedValueOnce({ projectName: 'py-lib', projectType: 'lib' })
      .mockResolvedValueOnce({ language: 'python' })
      .mockResolvedValueOnce({ features: [], llmProvider: 'claude' });

    const result = await runInitWizard();
    expect(result.template).toBe('py-lib');
  });

  it('should map cpp + cli to cpp-cli template', async () => {
    mockPrompt
      .mockResolvedValueOnce({ projectName: 'cpp-proj', projectType: 'cli' })
      .mockResolvedValueOnce({ language: 'cpp' })
      .mockResolvedValueOnce({ features: ['docker'], llmProvider: 'claude' });

    const result = await runInitWizard();
    expect(result.template).toBe('cpp-cli');
    expect(result.features).toEqual(['docker']);
  });

  it('should map typescript + api to ts-api template', async () => {
    mockPrompt
      .mockResolvedValueOnce({ projectName: 'api-proj', projectType: 'api' })
      .mockResolvedValueOnce({ language: 'typescript' })
      .mockResolvedValueOnce({ features: ['github-actions'], llmProvider: 'openai' });

    const result = await runInitWizard();
    expect(result.template).toBe('ts-api');
  });

  it('should clear console and show banner', async () => {
    mockPrompt
      .mockResolvedValueOnce({ projectName: 'test', projectType: 'cli' })
      .mockResolvedValueOnce({ language: 'typescript' })
      .mockResolvedValueOnce({ features: [], llmProvider: 'claude' });

    await runInitWizard();

    expect(clearSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  describe('Project name validation', () => {
    it('should accept valid project names (lowercase, numbers, hyphens, underscores)', async () => {
      mockPrompt
        .mockResolvedValueOnce({ projectName: 'my-app_123', projectType: 'cli' })
        .mockResolvedValueOnce({ language: 'typescript' })
        .mockResolvedValueOnce({ features: [], llmProvider: 'claude' });

      await runInitWizard();

      const firstCall = mockPrompt.mock.calls[0][0];
      const nameConfig = firstCall.find((q: any) => q.name === 'projectName');
      expect(nameConfig.validate('my-app')).toBe(true);
      expect(nameConfig.validate('test_123')).toBe(true);
      expect(nameConfig.validate('ABC')).toBe(true);
    });

    it('should reject invalid project names (spaces, special chars)', async () => {
      mockPrompt
        .mockResolvedValueOnce({ projectName: 'test', projectType: 'cli' })
        .mockResolvedValueOnce({ language: 'typescript' })
        .mockResolvedValueOnce({ features: [], llmProvider: 'claude' });

      await runInitWizard();

      const firstCall = mockPrompt.mock.calls[0][0];
      const nameConfig = firstCall.find((q: any) => q.name === 'projectName');
      expect(nameConfig.validate('My App!')).toContain('项目名称只能包含');
      expect(nameConfig.validate('a b c')).toContain('项目名称只能包含');
      expect(nameConfig.validate('hello@world')).toContain('项目名称只能包含');
    });
  });

  describe('Dynamic language choices', () => {
    it('should return CLI language choices for cli project type', async () => {
      mockPrompt
        .mockResolvedValueOnce({ projectName: 'test', projectType: 'cli' })
        .mockResolvedValueOnce({ language: 'typescript' })
        .mockResolvedValueOnce({ features: [], llmProvider: 'claude' });

      await runInitWizard();

      const secondCall = mockPrompt.mock.calls[1][0];
      const langConfig = secondCall.find((q: any) => q.name === 'language');
      const choices = langConfig.choices({});
      expect(choices).toEqual(['typescript', 'python', 'cpp', 'go', 'rust']);
    });

    it('should return API language choices for api project type', async () => {
      mockPrompt
        .mockResolvedValueOnce({ projectName: 'test', projectType: 'api' })
        .mockResolvedValueOnce({ language: 'typescript' })
        .mockResolvedValueOnce({ features: [], llmProvider: 'claude' });

      await runInitWizard();

      const secondCall = mockPrompt.mock.calls[1][0];
      const langConfig = secondCall.find((q: any) => q.name === 'language');
      const choices = langConfig.choices({});
      expect(choices).toEqual(['typescript', 'python', 'go']);
    });

    it('should return LIB language choices for lib project type', async () => {
      mockPrompt
        .mockResolvedValueOnce({ projectName: 'test', projectType: 'lib' })
        .mockResolvedValueOnce({ language: 'typescript' })
        .mockResolvedValueOnce({ features: [], llmProvider: 'claude' });

      await runInitWizard();

      const secondCall = mockPrompt.mock.calls[1][0];
      const langConfig = secondCall.find((q: any) => q.name === 'language');
      const choices = langConfig.choices({});
      expect(choices).toEqual(['typescript', 'python', 'cpp']);
    });
  });
});
