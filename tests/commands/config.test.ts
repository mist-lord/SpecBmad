export {};

const mockChalk = {
  cyan: (s: string) => s,
  yellow: (s: string) => s,
  green: (s: string) => s,
  red: (s: string) => s,
  blue: (s: string) => s,
  gray: (s: string) => s,
  magenta: (s: string) => s,
};
jest.mock('chalk', () => ({ __esModule: true, default: mockChalk }));

const mockLog = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  success: jest.fn(),
};
jest.mock('@/utils/logger', () => ({ log: mockLog }));

const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  chmodSync: jest.fn(),
};
jest.mock('fs', () => ({ __esModule: true, default: mockFs, ...mockFs }));

const mockHomedir = jest.fn(() => '/home/tester');
jest.mock('os', () => ({
  __esModule: true,
  default: { homedir: () => mockHomedir() },
  homedir: () => mockHomedir(),
}));

const mockPrompt = jest.fn();
jest.mock('inquirer', () => ({
  __esModule: true,
  default: { prompt: (...args: unknown[]) => mockPrompt(...args) },
}));

const mockLoad = jest.fn();
const mockSave = jest.fn();
const mockReset = jest.fn();
const MockConfigManager = jest.fn().mockImplementation(() => ({
  load: (...args: unknown[]) => mockLoad(...args),
  save: (...args: unknown[]) => mockSave(...args),
  reset: (...args: unknown[]) => mockReset(...args),
}));
jest.mock('@/utils/config', () => ({
  ConfigManager: MockConfigManager,
  ProjectConfig: {},
}));

const mockValidate = jest.fn();
const mockMigrate = jest.fn();
jest.mock('@/utils/config-validator', () => ({
  ConfigValidator: {
    validate: (...args: unknown[]) => mockValidate(...args),
  },
  ConfigMigrator: {
    migrate: (...args: unknown[]) => mockMigrate(...args),
  },
}));

async function loadConfigCommand() {
  jest.resetModules();
  const mod = await import('@/commands/config');
  return mod.configCommand;
}

async function runConfig(args: string[]) {
  const command = await loadConfigCommand();
  await command.parseAsync(['node', 'test', ...args]);
}

async function runOpenAI(args: string[]) {
  const command = await loadConfigCommand();
  const openai = command.commands.find(c => c.name() === 'openai');
  if (!openai) {
    throw new Error('openai subcommand not found');
  }
  await openai.parseAsync(['node', 'test', ...args]);
}

describe('configCommand', () => {
  let consoleSpy: jest.SpyInstance;
  const baseConfig = {
    projectName: 'demo',
    version: '1.0.0',
    type: 'web',
    scale_level: 1,
    language: 'typescript',
    framework: 'node',
    spec_kit: { enabled: true, ai_agent: 'claude' },
    bmad_method: { enabled: true, active_modules: ['bmm'] },
    integration: { workflow_mode: 'hybrid' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    process.env.SHELL = '/bin/zsh';

    mockLoad.mockReturnValue(baseConfig);
    mockValidate.mockReturnValue({ isValid: true, errors: [], warnings: [] });
    mockMigrate.mockImplementation((c: unknown) => c);
    mockPrompt.mockResolvedValue({});
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('');
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should expose expected base options and openai subcommand', async () => {
    const command = await loadConfigCommand();
    const optionNames = command.options.map(o => o.long);

    expect(optionNames).toContain('--get');
    expect(optionNames).toContain('--set');
    expect(optionNames).toContain('--value');
    expect(optionNames).toContain('--list');
    expect(optionNames).toContain('--validate');
    expect(optionNames).toContain('--migrate');
    expect(optionNames).toContain('--reset');
    expect(optionNames).toContain('--global');
    expect(optionNames).toContain('--interactive');
    expect(command.commands.map(c => c.name())).toContain('openai');
  });

  it('should list current config by default when no option is provided', async () => {
    await runConfig([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('当前配置'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"projectName": "demo"'));
  });

  it('should list current config when --list is explicitly provided', async () => {
    await runConfig(['--list']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('当前配置'));
  });

  it('should get existing nested key and show missing key error', async () => {
    await runConfig(['--get', 'spec_kit.ai_agent']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('spec_kit.ai_agent: "claude"'));

    await runConfig(['--get', 'non.existing.key']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('配置键 "non.existing.key" 不存在'));
  });

  it('should set nested config value using parsed JSON and save as global when requested', async () => {
    mockLoad.mockReturnValueOnce({ ...baseConfig });

    await runConfig(['--set', 'new.nested.value', '--value', '{"x":1}', '--global']);

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        new: expect.objectContaining({
          nested: expect.objectContaining({
            value: { x: 1 },
          }),
        }),
      }),
      true,
    );
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('已设置 new.nested.value = {"x":1}'));
  });

  it('should set plain string value when JSON parsing fails and handle save errors', async () => {
    mockLoad.mockReturnValueOnce({ ...baseConfig });
    await runConfig(['--set', 'name', '--value', 'plain-text']);
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'plain-text' }), false);

    mockSave.mockImplementationOnce(() => {
      throw new Error('save-failed');
    });
    await runConfig(['--set', 'name', '--value', 'again']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('设置配置失败'));
  });

  it('should validate config for both success and failure cases with warnings', async () => {
    mockValidate.mockReturnValueOnce({ isValid: true, errors: [], warnings: ['warn-1'] });
    await runConfig(['--validate']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('配置验证通过'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('warn-1'));

    mockValidate.mockReturnValueOnce({ isValid: false, errors: ['err-1'], warnings: ['warn-2'] });
    await runConfig(['--validate']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('配置验证失败'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('err-1'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('warn-2'));
  });

  it('should migrate config and persist migrated result', async () => {
    mockMigrate.mockReturnValueOnce({ ...baseConfig, version: '2.0.0' });

    await runConfig(['--migrate']);

    expect(mockMigrate).toHaveBeenCalledWith(baseConfig);
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ version: '2.0.0' }));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('配置已迁移到最新版本'));
  });

  it('should reset config when confirmed and cancel when declined', async () => {
    mockPrompt.mockResolvedValueOnce({ confirmed: true });
    await runConfig(['--reset', '--global']);
    expect(mockReset).toHaveBeenCalledWith(true);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('全局配置已重置'));

    mockPrompt.mockResolvedValueOnce({ confirmed: false });
    await runConfig(['--reset']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('操作已取消'));
  });

  it('should run interactive config and save when validation passes', async () => {
    mockPrompt.mockResolvedValueOnce({
      projectName: 'p2',
      version: '2.0.0',
      type: 'enterprise',
      scale_level: 3,
      language: 'go',
      framework: 'gin',
      spec_kit_enabled: true,
      spec_kit_agent: 'openai',
      bmad_method_enabled: true,
      bmad_active_modules: ['bmm', 'planning'],
      integration_workflow_mode: 'spec_first',
    });
    mockValidate.mockReturnValueOnce({ isValid: true, errors: [], warnings: ['interactive-warning'] });

    await runConfig(['--interactive']);

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'p2',
        spec_kit: expect.objectContaining({ ai_agent: 'openai' }),
      }),
    );
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('interactive-warning'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('配置已保存'));
  });

  it('should abort interactive save when validation fails', async () => {
    mockPrompt.mockResolvedValueOnce({
      projectName: 'bad',
      version: '1.0.0',
      type: 'web',
      scale_level: 0,
      language: 'ts',
      framework: 'node',
      spec_kit_enabled: true,
      spec_kit_agent: 'claude',
      bmad_method_enabled: true,
      bmad_active_modules: ['bmm'],
      integration_workflow_mode: 'hybrid',
    });
    mockValidate.mockReturnValueOnce({ isValid: false, errors: ['invalid-config'], warnings: [] });

    await runConfig(['--interactive']);

    expect(mockSave).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('配置验证失败'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('invalid-config'));
  });

  it('should configure openai env/global and prompt for missing values', async () => {
    const shellRc = '/home/tester/.zshrc';
    mockFs.existsSync.mockImplementation((p: string) => p === shellRc);
    mockFs.readFileSync.mockReturnValue('');

    await runOpenAI([
      '--env',
      '--api-key',
      'sk-1',
      '--base-url',
      'https://example/v1/chat/completions',
      '--model',
      'gpt-x',
    ]);

    expect(mockFs.mkdirSync).toHaveBeenCalledWith('/home/tester/.specbmad', { recursive: true });
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      '/home/tester/.specbmad/env.sh',
      expect.stringContaining('OPENAI_API_KEY="sk-1"'),
      'utf-8',
    );
    expect(mockFs.chmodSync).toHaveBeenCalledWith('/home/tester/.specbmad/env.sh', 0o600);
    expect(mockFs.appendFileSync).toHaveBeenCalledWith(
      shellRc,
      expect.stringContaining('source ~/.specbmad/env.sh'),
      'utf-8',
    );
    await runOpenAI([
      '--global',
      '--api-key',
      'sk-1',
      '--base-url',
      'https://example/v1/chat/completions',
      '--model',
      'gpt-x',
    ]);
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        agents: expect.objectContaining({
          OpenAI: expect.objectContaining({ model: 'gpt-x' }),
        }),
      }),
      true,
    );

    mockPrompt.mockResolvedValueOnce({
      apiKey: 'sk-prompt',
      baseUrl: 'https://prompt/v1/chat/completions',
      model: 'gpt-prompt',
    });
    await runOpenAI(['--env']);
    expect(mockPrompt).toHaveBeenCalled();
  });

  it('should warn when openai command uses neither --env nor --global', async () => {
    await runOpenAI(['--api-key', 'sk-2', '--base-url', 'https://a', '--model', 'gpt-y']);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未指定 --env 或 --global'));
  });

  it('should call process.exit when top-level action fails unexpectedly', async () => {
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => {
        throw new Error('exit-called');
      }) as never);

    MockConfigManager.mockImplementationOnce(() => {
      throw new Error('ctor-failed');
    });

    await expect(runConfig(['--list'])).rejects.toThrow('exit-called');
    expect(mockLog.error).toHaveBeenCalledWith('配置命令执行失败:', expect.any(Error));

    exitSpy.mockRestore();
  });
});
