import fs from 'fs';
import os from 'os';
import path from 'path';

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

const mockConfigLoad = jest.fn();
jest.mock('@/utils/config', () => ({
  config: {
    load: (...args: unknown[]) => mockConfigLoad(...args),
  },
}));

async function runConstitution(args: string[]) {
  jest.resetModules();
  const { constitutionCommand } = await import('@/commands/constitution');
  await constitutionCommand.parseAsync(['node', 'test', ...args]);
}

describe('constitutionCommand', () => {
  let tempDir: string;
  let oldCwd: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'constitution-test-'));
    oldCwd = process.cwd();
    process.chdir(tempDir);
    mockConfigLoad.mockReturnValue({ spec_kit: { constitution_file: 'docs/constitution.md' } });
  });

  afterEach(() => {
    process.chdir(oldCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should generate standard constitution using default config output', async () => {
    await runConstitution([]);

    const outPath = path.join(tempDir, 'docs/constitution.md');
    expect(fs.existsSync(outPath)).toBe(true);
    const content = fs.readFileSync(outPath, 'utf-8');
    expect(content).toContain('项目治理原则 (Constitution)');
    expect(mockLog.success).toHaveBeenCalledWith(expect.stringContaining('治理原则文档已写入'));
  });

  it('should generate minimal template with explicit output path', async () => {
    await runConstitution(['--template', 'minimal', '--output', 'out/minimal.md']);

    const outPath = path.join(tempDir, 'out/minimal.md');
    const content = fs.readFileSync(outPath, 'utf-8');
    expect(content).toContain('规范驱动协作');
    expect(content).not.toContain('Analyst, Architect, Developer');
  });

  it('should support absolute output paths', async () => {
    const outPath = path.join(tempDir, 'abs', 'constitution.md');

    await runConstitution(['--output', outPath]);

    expect(fs.existsSync(outPath)).toBe(true);
  });

  it('should print preview and skip file writing in dry-run mode', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await runConstitution(['--dry-run']);

    expect(mockLog.info).toHaveBeenCalledWith('预览模式 - 不会生成实际文件');
    expect(consoleSpy).toHaveBeenCalled();
    expect(fs.existsSync(path.join(tempDir, 'docs/constitution.md'))).toBe(false);
    consoleSpy.mockRestore();
  });

  it('should log error when generation fails', async () => {
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('disk-fail');
    });

    await runConstitution([]);

    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('生成治理原则失败'));
    writeSpy.mockRestore();
  });
});
