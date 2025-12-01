import { spawnSync } from 'child_process';
import path from 'path';

const CLI = path.join(process.cwd(), 'dist', 'index.js');

describe('CLI E2E: help, typical input, error input', () => {
  test('prints help with no args and exits 0', () => {
    const res = spawnSync('node', [CLI], { encoding: 'utf-8' });
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/SpecKit-BMAD/);
    expect(res.stdout).toMatch(/SpecKit-BMAD整合项目/);
    expect(res.stdout).toMatch(/Usage/);
  });

  test('status command outputs basic info and exits 0', () => {
    const res = spawnSync('node', [CLI, 'status'], { encoding: 'utf-8' });
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/项目状态/);
    expect(res.stdout).toMatch(/项目: SpecKit-BMAD/);
    expect(res.stdout).toMatch(/版本: 0.1.0/);
  });

  test('workflow with unknown name prints error and non-zero exit', () => {
    const res = spawnSync('node', [CLI, 'workflow', '--name', 'not-exist'], { encoding: 'utf-8' });
    expect(res.status).not.toBe(0);
    expect(res.stderr + res.stdout).toMatch(/命令执行失败|工作流未定义或为空/);
  });
});