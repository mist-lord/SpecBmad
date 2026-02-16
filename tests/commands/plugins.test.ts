const mockLog = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  success: jest.fn(),
};

jest.mock('@/utils/logger', () => ({
  log: mockLog,
}));

const mockGetAllPlugins = jest.fn();
const mockRegisterPlugin = jest.fn();
const mockInitializePlugin = jest.fn();
const mockGetPlugin = jest.fn();

jest.mock('@/core/plugin/manager', () => ({
  pluginManager: {
    getAllPlugins: (...args: unknown[]) => mockGetAllPlugins(...args),
    registerPlugin: (...args: unknown[]) => mockRegisterPlugin(...args),
    initializePlugin: (...args: unknown[]) => mockInitializePlugin(...args),
    getPlugin: (...args: unknown[]) => mockGetPlugin(...args),
  },
}));

jest.mock('@/plugins/artifacts-indexer', () => ({
  ArtifactsIndexerPlugin: class MockArtifactsIndexerPlugin {},
}));

async function runPluginsCommand(args: string[]) {
  jest.resetModules();
  const { pluginsCommand } = await import('@/commands/plugins');
  await pluginsCommand.parseAsync(['node', 'test', ...args]);
}

describe('pluginsCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllPlugins.mockReturnValue([]);
    mockInitializePlugin.mockResolvedValue(undefined);
    mockGetPlugin.mockReturnValue(null);
  });

  it('should show no-plugin message for --list when empty', async () => {
    await runPluginsCommand(['--list']);

    expect(mockLog.info).toHaveBeenCalledWith('无插件');
  });

  it('should print plugin info list for --list', async () => {
    mockGetAllPlugins.mockReturnValue([
      { getInfo: () => ({ name: 'p1', version: '1.0.0', enabled: true, initialized: false }) },
      { getInfo: () => ({ name: 'p2', version: '2.0.0', enabled: false, initialized: true }) },
    ]);

    await runPluginsCommand(['--list']);

    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('p1@1.0.0'));
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('p2@2.0.0'));
  });

  it('should register and initialize indexer for --init-indexer', async () => {
    await runPluginsCommand(['--init-indexer']);

    expect(mockRegisterPlugin).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'artifacts-indexer', version: '0.1.0', enabled: true }),
      expect.any(Function),
    );
    expect(mockInitializePlugin).toHaveBeenCalledWith('artifacts-indexer');
  });

  it('should run indexing directly when plugin already exists', async () => {
    const indexArtifacts = jest.fn();
    mockGetPlugin.mockReturnValue({ indexArtifacts });

    await runPluginsCommand(['--index']);

    expect(mockRegisterPlugin).not.toHaveBeenCalled();
    expect(mockInitializePlugin).not.toHaveBeenCalled();
    expect(indexArtifacts).toHaveBeenCalledWith(process.cwd());
  });

  it('should register/init then run indexing when plugin is missing', async () => {
    const indexArtifacts = jest.fn();
    mockGetPlugin
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ indexArtifacts });

    await runPluginsCommand(['--index']);

    expect(mockRegisterPlugin).toHaveBeenCalled();
    expect(mockInitializePlugin).toHaveBeenCalledWith('artifacts-indexer');
    expect(indexArtifacts).toHaveBeenCalledWith(process.cwd());
  });

  it('should print usage hint when no option is provided', async () => {
    await runPluginsCommand([]);

    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('--list'));
  });

  it('should log error when action throws', async () => {
    mockGetAllPlugins.mockImplementationOnce(() => {
      throw new Error('list-failed');
    });

    await runPluginsCommand(['--list']);

    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('插件命令执行失败'));
  });
});
