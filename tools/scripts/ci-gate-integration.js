#!/usr/bin/env node

// CI gate: enforce integration test pass rate >= 90%

const path = require('path');
const fs = require('fs');

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function main() {
  const projectRoot = process.cwd();
  const outFile = path.join(projectRoot, '.bmad', 'jest-integration.json');

  if (!fs.existsSync(outFile)) {
    console.error('[ci-gate] Integration JSON not found:', outFile);
    process.exit(1);
  }
  const report = readJSON(outFile);
  // 支持两种结构：顶层统计或在 summary 内
  const passed = Number((report.summary && report.summary.numPassedTests) ?? report.numPassedTests ?? 0);
  const total = Number((report.summary && report.summary.numTotalTests) ?? report.numTotalTests ?? 0);
  const rate = total > 0 ? (passed / total) : 0;
  const threshold = 0.9;

  console.log('[ci-gate] Integration pass rate:', (rate * 100).toFixed(2) + '%', 'threshold:', (threshold * 100) + '%');
  if (rate < threshold) {
    console.error(`[ci-gate] FAILED: pass rate ${(rate * 100).toFixed(2)}% < ${(threshold * 100)}%`);
    process.exit(2);
  }
  console.log('[ci-gate] OK: threshold met.');
}

main();