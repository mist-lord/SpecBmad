#!/usr/bin/env node

// KPI report generator: runs benchmark and coverage, aggregates, and writes reports
// Usage: node scripts/kpi-report.js

const path = require('path');
const fs = require('fs');
const { execaSync } = require('execa');

function tsString(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8');
}

function appendMarkdownReport(mdPath, title, kpi) {
  const lines = [];
  lines.push(`\n---`);
  lines.push(`\n## KPI采样（${title}）`);
  lines.push(`- 采样时间: ${kpi.ts}`);
  lines.push(`- 工作流: ${kpi.workflow}`);
  lines.push(`- 基准（ms）: avg=${kpi.time.avgMs.toFixed(2)}, min=${kpi.time.minMs.toFixed(2)}, max=${kpi.time.maxMs.toFixed(2)}`);
  lines.push(`- 内存Δ（MB）: rss=${(kpi.memory.avgRssDelta / 1024 / 1024).toFixed(2)}, heapUsed=${(kpi.memory.avgHeapUsedDelta / 1024 / 1024).toFixed(2)}`);
  const cov = kpi.coverage;
  if (cov) {
    const pct = (m) => (m.pct != null ? `${m.pct}%` : 'n/a');
    lines.push(`- 覆盖率: statements=${pct(cov.statements)}, branches=${pct(cov.branches)}, functions=${pct(cov.functions)}, lines=${pct(cov.lines)}`);
  }
  fs.appendFileSync(mdPath, lines.join('\n') + '\n');
}

function main() {
  // Build dist for benchmark script
  execaSync('npm', ['run', 'build'], { stdio: 'inherit' });
  // Ensure local project config prefers Mock client to avoid Claude requirement
  const projectConfigDir = path.join(process.cwd(), '.specbmad');
  ensureDir(projectConfigDir);
  const projectConfigPath = path.join(projectConfigDir, 'config.json');
  try {
    const baseCfg = fs.existsSync(projectConfigPath) ? readJSON(projectConfigPath) : {};
    const merged = {
      ...baseCfg,
      spec_kit: { ...(baseCfg.spec_kit || {}), enabled: true, ai_agent: 'Mock' },
      agents: { ...(baseCfg.agents || {}), Mock: { type: 'mock', enabled: true } }
    };
    writeJSON(projectConfigPath, merged);
    console.log('[kpi] project config updated for Mock client:', projectConfigPath);
  } catch (e) {
    console.warn('[kpi] failed to prepare project config:', e && e.message ? e.message : String(e));
  }

  // Run workflow benchmark
  execaSync('node', ['scripts/benchmark-workflow.js', '--name', 'full-development', '--runs', '3'], {
    stdio: 'inherit',
    env: { ...process.env, BMAD_MOCK_LLM: '1' }
  });

  const bmadDir = path.join(process.cwd(), '.bmad');
  ensureDir(bmadDir);
  const benchFile = path.join(bmadDir, 'benchmark.json');
  if (!fs.existsSync(benchFile)) {
    console.error('[kpi] benchmark output not found:', benchFile);
    process.exit(1);
  }
  const bench = readJSON(benchFile);

  // Run coverage
  execaSync('npm', ['run', 'test:coverage'], { stdio: 'inherit' });
  const covSummaryFile = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
  let covSummary = null;
  if (fs.existsSync(covSummaryFile)) {
    try { covSummary = readJSON(covSummaryFile); } catch {}
  }

  const kpi = {
    ts: tsString(),
    workflow: bench.workflow,
    time: bench.summary.time,
    memory: bench.summary.memory,
    coverage: covSummary && covSummary.total ? covSummary.total : null
  };

  const kpiOut = path.join(bmadDir, 'kpi.json');
  writeJSON(kpiOut, kpi);
  console.log('[kpi] KPI saved to', kpiOut);

  const mdPath = path.join(process.cwd(), 'docs', '最新运行报告.md');
  if (fs.existsSync(mdPath)) {
    appendMarkdownReport(mdPath, tsString(), kpi);
    console.log('[kpi] Markdown report updated:', mdPath);
  } else {
    console.warn('[kpi] Markdown report not found:', mdPath);
  }
}

main();