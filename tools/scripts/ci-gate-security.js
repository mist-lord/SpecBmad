#!/usr/bin/env node

// CI Security Gate: fail build if vulnerable dependencies are found
// Strategy: prefer `npm audit --json`; fallback to `pnpm audit --json`.

const { spawnSync } = require('child_process');

function runAudit(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return {
    ok: r.status === 0,
    stdout: r.stdout ? String(r.stdout) : '',
    stderr: r.stderr ? String(r.stderr) : '',
    error: r.error || null
  };
}

function parseReport(jsonStr) {
  try { return JSON.parse(jsonStr); } catch { return null; }
}

function countSeverities(report) {
  // npm audit shape: report.vulnerabilities[severity]; pnpm may differ
  let critical = 0, high = 0, moderate = 0, low = 0;
  if (!report) return { critical, high, moderate, low };

  // npm v7+ format
  if (report.metadata && report.metadata.vulnerabilities) {
    const v = report.metadata.vulnerabilities;
    critical = Number(v.critical || 0);
    high = Number(v.high || 0);
    moderate = Number(v.moderate || 0);
    low = Number(v.low || 0);
    return { critical, high, moderate, low };
  }

  // npm v6-like format
  if (report.vulnerabilities) {
    for (const k of Object.keys(report.vulnerabilities)) {
      const sev = report.vulnerabilities[k].severity || 'low';
      if (sev === 'critical') critical++;
      else if (sev === 'high') high++;
      else if (sev === 'moderate') moderate++;
      else low++;
    }
    return { critical, high, moderate, low };
  }

  // pnpm audit shape
  if (report.advisories || report.vulns) {
    const arr = report.advisories ? Object.values(report.advisories) : report.vulns || [];
    for (const it of arr) {
      const sev = (it.severity || it.sev || 'low').toLowerCase();
      if (sev === 'critical') critical++;
      else if (sev === 'high') high++;
      else if (sev === 'moderate') moderate++;
      else low++;
    }
  }
  return { critical, high, moderate, low };
}

function main() {
  // Prefer npm audit
  let res = runAudit('npm', ['audit', '--json']);
  if (res.error) {
    console.warn('[security-gate] npm audit execution error:', res.error.message || String(res.error));
  }
  let report = parseReport(res.stdout);
  if (!report) {
    // Fallback to pnpm audit
    res = runAudit('pnpm', ['audit', '--json']);
    if (res.error) {
      console.warn('[security-gate] pnpm audit execution error:', res.error.message || String(res.error));
    }
    report = parseReport(res.stdout);
  }

  if (!report) {
    console.error('[security-gate] Unable to parse audit report.');
    process.exit(1);
  }

  const sev = countSeverities(report);
  console.log('[security-gate] Vulnerabilities:', sev);

  // Gate policy: fail on any critical/high vulnerabilities
  if (sev.critical > 0 || sev.high > 0) {
    console.error('[security-gate] FAILED: critical/high vulnerabilities present.');
    process.exit(2);
  }

  console.log('[security-gate] OK: no critical/high vulnerabilities.');
}

main();
