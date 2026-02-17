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

jest.mock('@/utils/paths', () => {
  const nodePath = require('path');
  return {
    PATHS: {
      ARTIFACTS_DIR: '.specbmad/artifacts',
    },
    getProjectPath: (rel: string) => nodePath.join(process.cwd(), rel),
  };
});

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
}

async function runReport(args: string[]) {
  jest.resetModules();
  const { reportCommand } = await import('@/commands/report');
  await reportCommand.parseAsync(['node', 'test', ...args]);
}

describe('reportCommand', () => {
  let tempDir: string;
  let oldCwd: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-cmd-test-'));
    oldCwd = process.cwd();
    process.chdir(tempDir);

    writeJson(path.join(tempDir, '.specbmad/artifacts/analysis.json'), {
      text: 'x'.repeat(220),
      count: 7,
      ok: true,
      list: [1, 2, 3],
      nested: { a: 1 },
      none: null,
      extra: 'overflow-preview-key',
    });
    writeJson(path.join(tempDir, '.specbmad/artifacts/planning.json'), { plan: 'p' });
    writeJson(path.join(tempDir, '.specbmad/artifacts/solution.json'), { solution: 's' });
    writeJson(path.join(tempDir, '.specbmad/artifacts/bmm.json'), { bmm: 'b' });

    fs.mkdirSync(path.join(tempDir, 'generated/project'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'generated/project/main.ts'), 'console.log("ok")', 'utf-8');
    fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'docs/项目说明书.md'), '# doc', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'docs/run-output.txt'), '<tag>&output', 'utf-8');
  });

  afterEach(() => {
    process.chdir(oldCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exitCode = 0;
  });

  it('should generate JSON report', async () => {
    await runReport(['--format', 'json', '--output', 'out/report.json']);

    const outPath = path.join(tempDir, 'out/report.json');
    expect(fs.existsSync(outPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    expect(data.exists).toEqual({
      analysis: true,
      planning: true,
      solution: true,
      bmm: true,
    });
    expect(Array.isArray(data.preview.analysis)).toBe(true);
    expect(mockLog.success).toHaveBeenCalledWith(expect.stringContaining('报告已生成'));
  });

  it('should generate YAML report', async () => {
    await runReport(['--format', 'yaml', '--output', 'out/report.yaml']);

    const outPath = path.join(tempDir, 'out/report.yaml');
    const yaml = fs.readFileSync(outPath, 'utf-8');
    expect(yaml).toContain('generated_at:');
    expect(yaml).toContain('artifacts_dir:');
    expect(yaml).toContain('analysis: true');
  });

  it('should generate HTML report and escape run output', async () => {
    await runReport(['--format', 'html', '--output', 'out/report.html']);

    const outPath = path.join(tempDir, 'out/report.html');
    const html = fs.readFileSync(outPath, 'utf-8');
    expect(html).toContain('<h1>最新运行报告</h1>');
    expect(html).toContain('&lt;tag&gt;&amp;output');
    expect(html).toContain('analysis.json: ✅');
  });

  it('should generate markdown report by default', async () => {
    await runReport(['--output', 'out/report.md']);

    const outPath = path.join(tempDir, 'out/report.md');
    const md = fs.readFileSync(outPath, 'utf-8');
    expect(md).toContain('# 最新运行报告');
    expect(md).toContain('## 分析 (analysis.json) 概览');
    expect(md).toContain('Array(3)');
    expect(md).toContain('Object(1 keys)');
    expect(md).toContain('... (1 其他字段)');
  });

  it('should warn and continue when JSON parsing fails', async () => {
    fs.writeFileSync(path.join(tempDir, '.specbmad/artifacts/planning.json'), '{invalid', 'utf-8');

    await runReport(['--format', 'json', '--output', 'out/report.bad.json']);

    expect(mockLog.warn).toHaveBeenCalledWith(expect.stringContaining('读取JSON失败'));
    const data = JSON.parse(fs.readFileSync(path.join(tempDir, 'out/report.bad.json'), 'utf-8'));
    expect(data.exists.planning).toBe(false);
  });

  it('should set exitCode and log error when write fails', async () => {
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('disk-full');
    });

    await runReport(['--format', 'json', '--output', 'out/fail.json']);

    expect(mockLog.error).toHaveBeenCalledWith('生成报告失败:', expect.any(Error));
    expect(process.exitCode).toBe(1);
    writeSpy.mockRestore();
  });
});
