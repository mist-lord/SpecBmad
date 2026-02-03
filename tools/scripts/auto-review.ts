#!/usr/bin/env ts-node
/**
 * Auto Review Script - Invokes Codex for security review
 *
 * This script automates the Claude + Codex collaboration by:
 * 1. Invoking Codex to review specified files
 * 2. Parsing the review findings
 * 3. Outputting results in structured format
 * 4. Exiting with error code if CRITICAL/HIGH issues found
 *
 * Usage: npx ts-node tools/scripts/auto-review.ts <file1> [file2...]
 *
 * @see ADR-ARCH-004-boundary-driven-architecture.md v2.1
 */

import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Codex review finding structure
 */
interface CodexFinding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  file: string;
  line?: number;
  message: string;
}

/**
 * Review result structure
 */
interface ReviewResult {
  success: boolean;
  findings: CodexFinding[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  rawOutput?: string;
}

/**
 * Run Codex review on specified files
 */
function runCodexReview(files: string[]): ReviewResult {
  const fileList = files.map((f) => path.relative(process.cwd(), f)).join(', ');

  const prompt = `Review the following files for security issues. Focus on:
- Fail-Closed logic correctness
- Security completeness
- Missing attack vectors
- Path traversal/injection vulnerabilities

Files: ${fileList}

Output your findings as a JSON array with this structure:
[{"severity": "CRITICAL|HIGH|MEDIUM|LOW", "file": "path", "line": number, "message": "description"}]

Only output the JSON array, no other text.`;

  try {
    console.log(`\n🔍 Running Codex security review for: ${fileList}\n`);

    const output = execSync(`codex exec --full-auto "${prompt.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      timeout: 300000, // 5 minutes
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const findings = parseFindings(output);
    const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length;
    const highCount = findings.filter((f) => f.severity === 'HIGH').length;
    const mediumCount = findings.filter((f) => f.severity === 'MEDIUM').length;
    const lowCount = findings.filter((f) => f.severity === 'LOW').length;

    return {
      success: criticalCount === 0 && highCount === 0,
      findings,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      rawOutput: output,
    };
  } catch (error) {
    console.error('❌ Codex review failed:', error instanceof Error ? error.message : error);
    return {
      success: false,
      findings: [],
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      rawOutput: String(error),
    };
  }
}

/**
 * Parse Codex output for JSON findings
 */
function parseFindings(output: string): CodexFinding[] {
  // Try to extract JSON array from Codex response
  // Codex may include thinking/commentary before the JSON

  // Pattern 1: Look for standalone JSON array
  const jsonArrayMatch = output.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (jsonArrayMatch) {
    try {
      return JSON.parse(jsonArrayMatch[0]);
    } catch {
      // Continue to other patterns
    }
  }

  // Pattern 2: Look for findings in markdown code block
  const codeBlockMatch = output.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch {
      // Continue to other patterns
    }
  }

  // Pattern 3: Parse line-by-line findings format
  // e.g., "- **CRITICAL**: message at file:line"
  const lineFindings: CodexFinding[] = [];
  const linePattern =
    /[-*]\s*\*?\*?(CRITICAL|HIGH|MEDIUM|LOW)\*?\*?[:\s]+(.+?)(?:\s+(?:at|in|@)\s+)?([^\s:]+)?(?::(\d+))?/gi;

  let match;
  while ((match = linePattern.exec(output)) !== null) {
    lineFindings.push({
      severity: match[1].toUpperCase() as CodexFinding['severity'],
      message: match[2].trim(),
      file: match[3] || 'unknown',
      line: match[4] ? parseInt(match[4], 10) : undefined,
    });
  }

  if (lineFindings.length > 0) {
    return lineFindings;
  }

  // No findings found - this could mean clean review or parse failure
  console.log('ℹ️  No structured findings found in Codex output');
  return [];
}

/**
 * Format and display review results
 */
function displayResults(result: ReviewResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('📋 REVIEW RESULTS');
  console.log('='.repeat(60));

  if (result.findings.length === 0) {
    console.log('\n✅ No issues found!\n');
    return;
  }

  // Group by severity
  const bySeverity: Record<string, CodexFinding[]> = {
    CRITICAL: [],
    HIGH: [],
    MEDIUM: [],
    LOW: [],
  };

  for (const finding of result.findings) {
    bySeverity[finding.severity].push(finding);
  }

  // Display CRITICAL first
  if (bySeverity.CRITICAL.length > 0) {
    console.log('\n🚨 CRITICAL:');
    for (const f of bySeverity.CRITICAL) {
      console.log(`   ${f.file}${f.line ? ':' + f.line : ''}`);
      console.log(`   └─ ${f.message}`);
    }
  }

  // Display HIGH
  if (bySeverity.HIGH.length > 0) {
    console.log('\n⚠️  HIGH:');
    for (const f of bySeverity.HIGH) {
      console.log(`   ${f.file}${f.line ? ':' + f.line : ''}`);
      console.log(`   └─ ${f.message}`);
    }
  }

  // Display MEDIUM
  if (bySeverity.MEDIUM.length > 0) {
    console.log('\n📝 MEDIUM:');
    for (const f of bySeverity.MEDIUM) {
      console.log(`   ${f.file}${f.line ? ':' + f.line : ''}`);
      console.log(`   └─ ${f.message}`);
    }
  }

  // Display LOW
  if (bySeverity.LOW.length > 0) {
    console.log('\n💡 LOW:');
    for (const f of bySeverity.LOW) {
      console.log(`   ${f.file}${f.line ? ':' + f.line : ''}`);
      console.log(`   └─ ${f.message}`);
    }
  }

  // Summary
  console.log('\n' + '-'.repeat(60));
  console.log(
    `Summary: ${result.criticalCount} CRITICAL, ${result.highCount} HIGH, ` +
      `${result.mediumCount} MEDIUM, ${result.lowCount} LOW`
  );
  console.log('-'.repeat(60));

  if (!result.success) {
    console.log('\n❌ Review FAILED: CRITICAL or HIGH issues must be resolved\n');
  } else {
    console.log('\n✅ Review PASSED: No blocking issues\n');
  }
}

/**
 * Output results as JSON (for programmatic use)
 */
function outputJson(result: ReviewResult): void {
  const output = {
    success: result.success,
    summary: {
      critical: result.criticalCount,
      high: result.highCount,
      medium: result.mediumCount,
      low: result.lowCount,
      total: result.findings.length,
    },
    findings: result.findings,
  };

  console.log(JSON.stringify(output, null, 2));
}

// Main
function main(): void {
  const args = process.argv.slice(2);

  // Parse options
  const jsonOutput = args.includes('--json');
  const files = args.filter((a) => !a.startsWith('--'));

  if (files.length === 0) {
    console.error('Usage: auto-review.ts [--json] <file1> [file2...]');
    console.error('\nOptions:');
    console.error('  --json    Output results as JSON');
    process.exit(1);
  }

  // Run review
  const result = runCodexReview(files);

  // Output results
  if (jsonOutput) {
    outputJson(result);
  } else {
    displayResults(result);
  }

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

main();
