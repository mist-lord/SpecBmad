#!/usr/bin/env node

// CI Security Gate: fail build if vulnerable dependencies are found
// Strategy: prefer `npm audit --json`; fallback to `pnpm audit --json`.

const { execaSync } = require('execa');

function runAudit(cmd, args) {
  try {
    const r = execaSync(cmd, args, { stdio: 'pipe' });
    return { ok: true, stdout: r.stdout ? String(r.stdout) : '' };
  } catch (e) {
    // Some audit commands exit non-zero when vulnerabilities exist; still capture stdout
    const stdout = e.stdout ? String(e.stdout) : '';
    const stderr = e.stderr ? String(e.stderr) : '';
    return { ok: false, stdout, stderr };
  }
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
  let report = parseReport(res.stdout);
  if (!report) {
    // Fallback to pnpm audit
    res = runAudit('pnpm', ['audit', '--json']);
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