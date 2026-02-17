#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const artifactsDir = path.join(cwd, '.bmad', 'artifacts');

const commands = [
  {
    name: 'analyze',
    args: ['analyze', '--mode', 'technical', '--agent', 'Analyst', '--output', 'json'],
    stdoutIncludes: '开始BMAD-Method分析'
  },
  {
    name: 'plan',
    args: ['plan', '--type', 'technical', '--agent', 'Architect', '--scale', '1', '--output', 'json'],
    stdoutIncludes: '开始BMAD-Method规划'
  },
  {
    name: 'solution',
    args: ['solution', '--type', 'implementation', '--agent', 'Architect', '--depth', '2', '--output', 'json'],
    stdoutIncludes: '开始BMAD-Method解决方案设计'
  },
  {
    name: 'bmm',
    args: ['bmm', '--operation', 'analyze', '--agent', 'BusinessAnalyst', '--output', 'json'],
    stdoutIncludes: '开始BMAD-Method商业模型管理'
  },
  // 扩展核心命令覆盖
  {
    name: 'workflow',
    args: ['workflow', '--name', 'full-development', '--format', 'json', '--report-dir', '.bmad/artifacts'],
    artifact: 'workflow.json'
  },
  {
    name: 'agents:list',
    args: ['agents', '--list'],
    stdoutIncludes: '可用的AI代理类型'
  },
  {
    name: 'tasks',
    args: ['tasks', '--format', 'markdown', '--report-dir', '.bmad/artifacts'],
    artifact: 'tasks.md'
  },
  {
    name: 'implement',
    args: ['implement', '--agent', 'Developer', '--format', 'markdown', '--report-dir', '.bmad/artifacts'],
    artifact: 'implement.md'
  },
  {
    name: 'report',
    args: ['report', '--format', 'json', '--output', '.bmad/artifacts/report-smoke.json'],
    artifact: 'report-smoke.json'
  },
  {
    name: 'status',
    args: ['status'],
    stdoutIncludes: '项目状态'
  },
  {
    name: 'qa',
    args: ['qa', '--format', 'json', '--report-dir', '.bmad/artifacts'],
    artifact: 'qa.json'
  },
  {
    name: 'deploy',
    args: ['deploy', '--format', 'json', '--report-dir', '.bmad/artifacts', '--env', 'dev', '--strategy', 'rolling', '--dry-run'],
    artifact: 'deploy.json'
  }
];

function runCmd(args) {
  const fullArgs = ['dist/index.js', ...args];
  const res = spawnSync(process.execPath, fullArgs, {
    env: { ...process.env, BMAD_MOCK_LLM: '1' },
    cwd,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const stdout = res.stdout ? res.stdout.toString() : '';
  const stderr = res.stderr ? res.stderr.toString() : '';
  return { ok: res.status === 0, stdout, stderr, status: res.status };
}

function checkArtifact(file) {
  const p = path.join(artifactsDir, file);
  if (!fs.existsSync(p)) return false;
  try {
    const content = fs.readFileSync(p, 'utf-8');
    if (file.endsWith('.json')) {
      const json = JSON.parse(content);
      return typeof json === 'object' && json !== null;
    }
    return content.length > 0;
  } catch {
    return false;
  }
}

function prep() {
  try {
    fs.rmSync(artifactsDir, { recursive: true, force: true });
  } catch {}
}

function main() {
  console.log('CLI Smoke Gate: analyze/plan/solution/bmm/workflow/report/agents/status/tasks/implement/qa/deploy');
  prep();

  let okCount = 0;
  const total = commands.length;
  for (const c of commands) {
    console.log(`\n> Running: ${c.name}`);
    const res = runCmd(c.args);

    const validators = [];
    if (c.artifact) {
      const artifactOk = checkArtifact(c.artifact);
      validators.push(['artifact', artifactOk]);
    }
    if (c.stdoutIncludes) {
      const stdoutOk = res.stdout.includes(c.stdoutIncludes);
      validators.push(['stdout', stdoutOk]);
    }

    const allOk = res.ok && validators.every(([_, v]) => v);
    if (allOk) {
      console.log(`✓ ${c.name} passed`);
      okCount++;
    } else {
      console.error(`✗ ${c.name} failed (status=${res.status})`);
      for (const [k, v] of validators) {
        console.error(`  - ${k}: ${v ? 'ok' : 'missing'}`);
      }
      if (!res.ok) {
        const errPreview = (res.stderr || '').split('\n').slice(0, 3).join('\n');
        if (errPreview) console.error('  - stderr:', errPreview);
      }
    }
  }

  console.log(`\nPassed ${okCount}/${total}`);
  if (okCount !== total) {
    process.exit(1);
  }
  process.exit(0);
}

main();
