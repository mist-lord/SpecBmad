#!/usr/bin/env node

// Integration test pass rate reporter
// Runs Jest on integration tests, produces JSON, computes pass rate, and updates KPI/Markdown.

const path = require('path');
const fs = require('fs');
const { execaSync } = require('execa');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8');
}

function tsString(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function appendMarkdown(mdPath, sectionTitle, lines) {
  const arr = [];
  arr.push('\n---');
  arr.push(`\n## ${sectionTitle}`);
  for (const l of lines) arr.push(l);
  fs.appendFileSync(mdPath, arr.join('\n') + '\n');
}

function main() {
  const projectRoot = process.cwd();
  const bmadDir = path.join(projectRoot, '.bmad');
  ensureDir(bmadDir);
  const outFile = path.join(bmadDir, 'jest-integration.json');

  // Run Jest for integration tests only and output JSON
  const pattern = 'tests/(workflow|orchestrator).*\\.test\\.ts';
  console.log('[integration] Running Jest for pattern:', pattern);
  execaSync('npm', ['run', 'test', '--', '--testPathPattern', pattern, '--json', '--outputFile', outFile], {
    stdio: 'inherit',
    env: { ...process.env, BMAD_MOCK_LLM: '1' }
  });

  if (!fs.existsSync(outFile)) {
    console.error('[integration] Jest JSON output not found:', outFile);
    process.exit(1);
  }
  const report = readJSON(outFile);
  // 支持两种结构：顶层统计或在 summary 内
  const passed = Number((report.summary && report.summary.numPassedTests) ?? report.numPassedTests ?? 0);
  const failed = Number((report.summary && report.summary.numFailedTests) ?? report.numFailedTests ?? 0);
  const total = Number((report.summary && report.summary.numTotalTests) ?? report.numTotalTests ?? 0);
  const passRate = total > 0 ? (passed / total) : 0;

  console.log('[integration] Passed:', passed, 'Failed:', failed, 'Total:', total, 'PassRate:', (passRate * 100).toFixed(2) + '%');

  // Merge into KPI JSON
  const kpiPath = path.join(bmadDir, 'kpi.json');
  let kpi = {};
  try { if (fs.existsSync(kpiPath)) kpi = readJSON(kpiPath); } catch {}
  kpi.integration = {
    ts: tsString(),
    passed,
    failed,
    total,
    passRate: passRate
  };
  writeJSON(kpiPath, kpi);
  console.log('[integration] KPI updated with integration pass rate:', kpiPath);

  // Append to Markdown report if exists
  const mdPath = path.join(projectRoot, 'docs', '最新运行报告.md');
  if (fs.existsSync(mdPath)) {
    appendMarkdown(mdPath, '集成测试通过率', [
      `- 采样时间: ${kpi.integration.ts}`,
      `- 总数: ${total}, 通过: ${passed}, 失败: ${failed}`,
      `- 通过率: ${(passRate * 100).toFixed(2)}%`
    ]);
    console.log('[integration] Markdown report updated:', mdPath);
  }
}

main();