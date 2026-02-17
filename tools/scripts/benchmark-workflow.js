#!/usr/bin/env node

// Benchmark workflow execution time and memory usage
// Usage: BMAD_MOCK_LLM=1 node scripts/benchmark-workflow.js --name full-development --runs 3

const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

// Register module alias for compiled dist '@' references
require('module-alias/register');
const { addAlias } = require('module-alias');
const distRoot = path.join(__dirname, '../../dist');
addAlias('@', distRoot);

// Prefer mock LLM to avoid network costs
if (!process.env.BMAD_MOCK_LLM) {
  process.env.BMAD_MOCK_LLM = '1';
}

// Lazy import after alias setup
const { config: configInstance } = require(path.join(distRoot, 'utils/config'));
// Force default AI agent to Mock for offline benchmark
try {
  const prev = configInstance.get('spec_kit') || {};
  configInstance.set('spec_kit', { ...prev, enabled: true, ai_agent: 'Mock' });
} catch {}
const { Orchestrator } = require(path.join(distRoot, 'workflow/orchestrator'));

function parseArgs(argv) {
  const args = { name: 'full-development', runs: 3 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name' && argv[i + 1]) args.name = argv[++i];
    else if (a === '--runs' && argv[i + 1]) args.runs = parseInt(argv[++i], 10) || 1;
  }
  return args;
}

async function runOnce(name) {
  const orchestrator = new Orchestrator();
  const initialContext = {
    projectName: 'Benchmark-Project',
    projectState: {},
    inputData: {}
  };

  const memBefore = process.memoryUsage();
  const t0 = performance.now();
  try {
    await orchestrator.executeWorkflow(name, initialContext, 'json');
  } catch (e) {
    console.error('[benchmark] workflow run failed:', e && e.message ? e.message : String(e));
    throw e;
  }
  const t1 = performance.now();
  const memAfter = process.memoryUsage();
  return {
    elapsedMs: t1 - t0,
    memory: {
      rssDelta: memAfter.rss - memBefore.rss,
      heapUsedDelta: memAfter.heapUsed - memBefore.heapUsed,
      rssAfter: memAfter.rss,
      heapUsedAfter: memAfter.heapUsed
    }
  };
}

function summarize(results) {
  const times = results.map(r => r.elapsedMs);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const memAvgRssDelta = results.reduce((a, r) => a + r.memory.rssDelta, 0) / results.length;
  const memAvgHeapDelta = results.reduce((a, r) => a + r.memory.heapUsedDelta, 0) / results.length;
  return {
    runs: results.length,
    time: { avgMs: avg, minMs: min, maxMs: max },
    memory: { avgRssDelta: memAvgRssDelta, avgHeapUsedDelta: memAvgHeapDelta }
  };
}

async function main() {
  const { name, runs } = parseArgs(process.argv);
  console.log(`[benchmark] Running workflow '${name}' for ${runs} runs (BMAD_MOCK_LLM=${process.env.BMAD_MOCK_LLM})`);

  const results = [];
  for (let i = 0; i < runs; i++) {
    const r = await runOnce(name);
    results.push(r);
    console.log(`- run ${i + 1}: ${r.elapsedMs.toFixed(2)} ms, rssΔ=${(r.memory.rssDelta / 1024 / 1024).toFixed(2)} MB, heapΔ=${(r.memory.heapUsedDelta / 1024 / 1024).toFixed(2)} MB`);
  }
  const summary = summarize(results);
  console.log(`[benchmark] avg=${summary.time.avgMs.toFixed(2)} ms, min=${summary.time.minMs.toFixed(2)} ms, max=${summary.time.maxMs.toFixed(2)} ms`);
  console.log(`[benchmark] mem avg rssΔ=${(summary.memory.avgRssDelta / 1024 / 1024).toFixed(2)} MB, heapΔ=${(summary.memory.avgHeapUsedDelta / 1024 / 1024).toFixed(2)} MB`);

  // Persist results under .bmad
  const outDir = path.join(process.cwd(), '.bmad');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'benchmark.json');
  const payload = { workflow: name, env: { BMAD_MOCK_LLM: process.env.BMAD_MOCK_LLM }, summary, runs: results };
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`[benchmark] results saved to ${outFile}`);
}

main().catch((e) => {
  console.error('[benchmark] fatal error:', e);
  process.exit(1);
});
