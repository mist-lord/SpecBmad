export {};

const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
};
jest.mock('fs', () => ({ __esModule: true, default: mockFs, ...mockFs }));

const mockYamlParse = jest.fn();
const mockYamlStringify = jest.fn();
jest.mock('yaml', () => ({
  __esModule: true,
  default: {
    parse: (...args: unknown[]) => mockYamlParse(...args),
    stringify: (...args: unknown[]) => mockYamlStringify(...args),
  },
}));

const mockHomedir = jest.fn(() => '/home/tester');
jest.mock('os', () => ({
  __esModule: true,
  default: { homedir: () => mockHomedir() },
}));

const mockLog = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  success: jest.fn(),
};
jest.mock('../../src/utils/logger', () => ({ log: mockLog }));

const mockGetProjectPath = jest.fn((rel: string) => `/project/${rel}`);
jest.mock('../../src/utils/paths', () => ({
  PATHS: {
    CONFIG_FILE_JSON: '.specbmad.json',
    CONFIG_FILE_ALT_JSON: '.specbmad/config.json',
    CONFIG_FILE_YAML: '.specbmad.yaml',
    CONFIG_FILE_ALT_YAML: '.specbmad/config.yaml',
    CACHE_DIR: '.specbmad/cache',
  },
  getProjectPath: (...args: unknown[]) => mockGetProjectPath(...(args as [string])),
}));

type ConfigModule = typeof import('../../src/utils/config');
const configModule = jest.requireActual('../../src/utils/config') as ConfigModule;

const {
  ConfigManager,
  config,
  defaultConfig,
  getConfigValue,
  getProjectConfig,
  saveConfig,
  setConfigValue,
} = configModule;

const p = {
  projectJson: '/project/.specbmad.json',
  projectAltJson: '/project/.specbmad/config.json',
  projectYaml: '/project/.specbmad.yaml',
  projectAltYaml: '/project/.specbmad/config.yaml',
  projectAltDir: '/project/.specbmad',
  globalJson: '/home/tester/.specbmad/config.json',
  globalYaml: '/home/tester/.specbmad/config.yaml',
};

function setExisting(paths: string[]) {
  const set = new Set(paths);
  mockFs.existsSync.mockImplementation((target: string) => set.has(String(target)));
}

describe('ConfigManager', () => {
  let cm: InstanceType<typeof ConfigManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    cm = new ConfigManager();
    setExisting([]);
    mockYamlParse.mockReturnValue({});
    mockYamlStringify.mockReturnValue('yaml-out');
  });

  it('load should merge global/project config with project taking precedence', () => {
    setExisting([p.globalYaml, p.projectAltYaml]);
    mockFs.readFileSync.mockReturnValueOnce('global-yaml').mockReturnValueOnce('project-yaml');
    mockYamlParse
      .mockReturnValueOnce({ fromGlobal: true, overlap: 'global' })
      .mockReturnValueOnce({ overlap: 'project', fromProject: true });

    const result = cm.load();

    expect(result).toEqual({
      fromGlobal: true,
      overlap: 'project',
      fromProject: true,
    });
  });

  it('load should fallback to JSON files and handle parse failures', () => {
    setExisting([p.globalJson, p.projectJson]);
    mockFs.readFileSync.mockReturnValueOnce('{bad-json').mockReturnValueOnce('{"projectName":"demo"}');

    const result = cm.load();

    expect(result).toEqual({ projectName: 'demo' });
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining('加载全局配置失败'));
  });

  it('load should log project debug when project parsing fails', () => {
    setExisting([p.projectAltJson]);
    mockFs.readFileSync.mockReturnValueOnce('{bad-project-json');

    const result = cm.load();

    expect(result).toEqual({});
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining('加载项目配置失败'));
  });

  it('save should prioritize alt project yaml when present', () => {
    setExisting([p.projectAltYaml]);
    mockFs.readFileSync.mockReturnValueOnce('old-yaml');
    mockYamlParse.mockReturnValueOnce({ old: 1 });
    mockYamlStringify.mockReturnValueOnce('merged-yaml');

    cm.save({ projectName: 'new' });

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(p.projectAltYaml, 'merged-yaml', 'utf-8');
    expect(mockLog.success).toHaveBeenCalledWith('配置已保存到 项目 配置文件');
  });

  it('save should use old project yaml when alt yaml missing', () => {
    setExisting([p.projectYaml]);
    mockFs.readFileSync.mockReturnValueOnce('old-yaml');
    mockYamlParse.mockReturnValueOnce({ a: 1 });

    cm.save({ version: '2.0.0' });

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(p.projectYaml, expect.any(String), 'utf-8');
  });

  it('save should use alt project json when alt path or dir exists and merge existing json', () => {
    setExisting([p.projectAltDir, p.projectAltJson]);
    mockFs.readFileSync.mockReturnValueOnce('{"old":1}');

    cm.save({ description: 'new' });

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      p.projectAltJson,
      expect.stringContaining('"old": 1'),
    );
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      p.projectAltJson,
      expect.stringContaining('"description": "new"'),
    );
  });

  it('save should use global yaml when global=true and yaml file exists', () => {
    setExisting([p.globalYaml]);
    mockFs.readFileSync.mockReturnValueOnce('old-global-yaml');
    mockYamlParse.mockReturnValueOnce({ old: 'x' });

    cm.save({ projectName: 'g' }, true);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(p.globalYaml, expect.any(String), 'utf-8');
    expect(mockLog.success).toHaveBeenCalledWith('配置已保存到 全局 配置文件');
  });

  it('save should create target directory and rethrow when write fails', () => {
    setExisting([]);
    mockFs.writeFileSync.mockImplementationOnce(() => {
      throw new Error('disk-fail');
    });

    expect(() => cm.save({ projectName: 'x' })).toThrow('disk-fail');
    expect(mockFs.mkdirSync).toHaveBeenCalledWith('/project', { recursive: true });
    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('保存配置失败'));
  });

  it('save should rethrow when existing json parse fails', () => {
    setExisting([p.projectAltJson]);
    mockFs.readFileSync.mockReturnValueOnce('{bad-json');

    expect(() => cm.save({ projectName: 'parse-fail' })).toThrow();
    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('保存配置失败'));
  });

  it('reset should clear global and project configs with corresponding branches', () => {
    setExisting([p.globalJson]);
    cm.reset(true);
    expect(mockFs.unlinkSync).toHaveBeenCalledWith(p.globalJson);
    expect(mockLog.success).toHaveBeenCalledWith('全局 配置已重置');

    setExisting([p.projectJson, p.projectAltJson]);
    cm.reset(false);
    expect(mockFs.unlinkSync).toHaveBeenCalledWith(p.projectJson);
    expect(mockFs.unlinkSync).toHaveBeenCalledWith(p.projectAltJson);
    expect(mockLog.success).toHaveBeenCalledWith('项目 配置已重置');
  });

  it('reset should not log success when no project files removed', () => {
    setExisting([]);
    cm.reset(false);
    expect(mockLog.success).not.toHaveBeenCalledWith('项目 配置已重置');
  });

  it('reset should rethrow on failures', () => {
    setExisting([p.projectJson]);
    mockFs.unlinkSync.mockImplementationOnce(() => {
      throw new Error('unlink-fail');
    });

    expect(() => cm.reset()).toThrow('unlink-fail');
    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('重置配置失败'));
  });

  it('exists/get/set/getAll should work for global and project scopes', () => {
    setExisting([p.globalJson, p.projectAltJson]);
    expect(cm.exists(true)).toBe(true);
    expect(cm.exists(false)).toBe(true);

    cm.set('projectName', 'abc');
    expect(cm.get('projectName')).toBe('abc');
    expect(cm.getAll()).toEqual(expect.objectContaining({ projectName: 'abc' }));
  });

  it('convenience helpers should delegate to singleton config instance', () => {
    const getAllSpy = jest.spyOn(config, 'getAll').mockReturnValue({ projectName: 'from-singleton' });
    const getSpy = jest.spyOn(config, 'get').mockReturnValue('v' as any);
    const setSpy = jest.spyOn(config, 'set').mockImplementation(() => undefined);
    const saveSpy = jest.spyOn(config, 'save').mockImplementation(() => undefined);

    expect(getProjectConfig()).toEqual({ projectName: 'from-singleton' });
    expect(getConfigValue('projectName')).toBe('v');
    setConfigValue('projectName', 'x');
    saveConfig({ projectName: 'y' }, true);

    expect(setSpy).toHaveBeenCalledWith('projectName', 'x');
    expect(saveSpy).toHaveBeenCalledWith({ projectName: 'y' }, true);

    getAllSpy.mockRestore();
    getSpy.mockRestore();
    setSpy.mockRestore();
    saveSpy.mockRestore();
  });

  it('should expose expected default config fields', () => {
    expect(defaultConfig.projectName).toBe('SpecKit-BMAD项目');
    expect(defaultConfig.spec_kit?.enabled).toBe(true);
    expect(defaultConfig.bmad_method?.enabled).toBe(true);
    expect(defaultConfig.integration?.workflow_mode).toBe('hybrid');
    expect(defaultConfig.cacheDir).toBe('.specbmad/cache');
  });
});
