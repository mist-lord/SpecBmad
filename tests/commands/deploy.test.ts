jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() },
}));

jest.mock('@/utils/config', () => ({
  config: {
    load: jest.fn().mockReturnValue({ projectName: 'test', projectVersion: '1.0.0' }),
    get: jest.fn(),
  },
}));

jest.mock('@/utils/perf', () => ({
  PerfTracer: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    end: jest.fn().mockReturnValue({ durationMs: 100, memory: { rss: 1000 } }),
  })),
}));

jest.mock('@/utils/error', () => ({
  handleError: jest.fn(),
}));

jest.mock('child_process', () => ({
  spawnSync: jest.fn().mockReturnValue({ status: 0, stdout: Buffer.from('ok'), stderr: Buffer.from('') }),
}));

import { deployCommand } from '@/commands/deploy';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('deployCommand', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-test-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    // Create the .specbmad directories the command expects
    fs.mkdirSync(path.join(tmpDir, '.specbmad', 'artifacts'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.specbmad', 'releases'), { recursive: true });
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should be an async function', () => {
    expect(typeof deployCommand).toBe('function');
  });

  it('should execute with default options and write json', async () => {
    await deployCommand({});

    const artifactsDir = path.join(tmpDir, '.specbmad', 'artifacts');
    const jsonFile = path.join(artifactsDir, 'deploy.json');
    expect(fs.existsSync(jsonFile)).toBe(true);

    const content = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    expect(content.success).toBe(true);
    expect(content.plan.env).toBe('dev');
    expect(content.plan.strategy).toBe('rolling');
  });

  it('should handle dry run mode', async () => {
    await deployCommand({ dryRun: true });

    const jsonFile = path.join(tmpDir, '.specbmad', 'artifacts', 'deploy.json');
    expect(fs.existsSync(jsonFile)).toBe(true);
    const content = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    expect(content.plan.dryRun).toBe(true);
  });

  it('should generate rollback plan', async () => {
    await deployCommand({ rollback: true });

    const jsonFile = path.join(tmpDir, '.specbmad', 'artifacts', 'deploy-rollback.json');
    expect(fs.existsSync(jsonFile)).toBe(true);
    const content = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    expect(content.plan.rollback).toBe(true);
    expect(content.plan.steps.some((s: any) => s.id === 'rollback-check')).toBe(true);
  });

  it('should support markdown format', async () => {
    await deployCommand({ format: 'markdown' });

    const mdFile = path.join(tmpDir, '.specbmad', 'artifacts', 'deploy.md');
    expect(fs.existsSync(mdFile)).toBe(true);
    const content = fs.readFileSync(mdFile, 'utf-8');
    expect(content).toContain('# 部署计划');
  });

  it('should use specified environment', async () => {
    await deployCommand({ env: 'staging' });

    const jsonFile = path.join(tmpDir, '.specbmad', 'artifacts', 'deploy.json');
    const content = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    expect(content.plan.env).toBe('staging');
  });

  it('should use specified strategy', async () => {
    await deployCommand({ strategy: 'canary' });

    const jsonFile = path.join(tmpDir, '.specbmad', 'artifacts', 'deploy.json');
    const content = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    expect(content.plan.strategy).toBe('canary');
  });

  it('should include tag in plan', async () => {
    await deployCommand({ tag: 'v1.0.0' });

    const jsonFile = path.join(tmpDir, '.specbmad', 'artifacts', 'deploy.json');
    const content = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    expect(content.plan.tag).toBe('v1.0.0');
  });

  it('should write to custom output path', async () => {
    const customOutput = path.join(tmpDir, 'custom-deploy.json');
    await deployCommand({ output: customOutput });

    expect(fs.existsSync(customOutput)).toBe(true);
  });

  it('should write workflow state file', async () => {
    await deployCommand({});

    const stateFile = path.join(tmpDir, '.specbmad', 'workflow.state.json');
    expect(fs.existsSync(stateFile)).toBe(true);
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    expect(state.lastDeployment).toBeDefined();
    expect(state.lastDeployment.status).toBe('completed');
  });

  it('should generate release artifact', async () => {
    await deployCommand({ tag: 'v2.0.0' });

    const releasesDir = path.join(tmpDir, '.specbmad', 'releases');
    const files = fs.readdirSync(releasesDir);
    expect(files.some(f => f.includes('v2.0.0'))).toBe(true);
  });

  it('should include build step when build option is set', async () => {
    await deployCommand({ build: true, dryRun: true });

    const jsonFile = path.join(tmpDir, '.specbmad', 'artifacts', 'deploy.json');
    const content = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    expect(content.plan.steps.some((s: any) => s.id === 'build')).toBe(true);
  });

  it('should skip test step when skipTests is set', async () => {
    await deployCommand({ skipTests: true, dryRun: true });

    const jsonFile = path.join(tmpDir, '.specbmad', 'artifacts', 'deploy.json');
    const content = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    expect(content.plan.steps.some((s: any) => s.id === 'test')).toBe(false);
  });
});
