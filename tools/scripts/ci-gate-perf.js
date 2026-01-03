#!/usr/bin/env node

// CI Performance Gate: read benchmark results and enforce thresholds
// Input: .bmad/benchmark.json produced by scripts/benchmark-workflow.js
// Policy: enforce max average duration and min step success rate.

const fs = require('fs');

const BENCHMARK_PATH = '.bmad/benchmark.json';

function readJson(path) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return null; }
}

function main() {
  const j = readJson(BENCHMARK_PATH);
  if (!j) {
    console.error('[perf-gate] No benchmark file found:', BENCHMARK_PATH);
    process.exit(1);
  }

  // Expect shape from scripts/benchmark-workflow.js
  const avgMs = Number(j.summary?.time?.avgMs ?? j.time?.avgMs ?? j.avgMs ?? NaN);
  let passRateRaw = j.summary?.successRate ?? j.successRate;
  const passRate = passRateRaw === undefined ? 1 : Number(passRateRaw); // default to 1 when not provided

  console.log('[perf-gate] avgMs:', avgMs, 'successRate:', passRate);

  // Thresholds (tweak as needed)
  const MAX_AVG_MS = Number(process.env.PERF_MAX_AVG_MS || 8000);
  const MIN_SUCCESS_RATE = Number(process.env.PERF_MIN_SUCCESS_RATE || 0.95);

  if (!Number.isFinite(avgMs) || !Number.isFinite(passRate)) {
    console.error('[perf-gate] Invalid benchmark metrics.');
    process.exit(1);
  }

  let ok = true;
  if (avgMs > MAX_AVG_MS) {
    console.error(`[perf-gate] FAILED: avgMs ${avgMs} > ${MAX_AVG_MS}`);
    ok = false;
  }
  if (passRate < MIN_SUCCESS_RATE) {
    console.error(`[perf-gate] FAILED: successRate ${passRate} < ${MIN_SUCCESS_RATE}`);
    ok = false;
  }

  if (!ok) process.exit(2);
  console.log('[perf-gate] OK: thresholds met.');
}

main();