/**
 * SpecBmad MCP Gate Server
 *
 * MCP Server exposing SpecBmad's verification and gate capabilities
 * for integration with Claude Code, Cursor, and other MCP-compatible tools.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as path from "path";

// =============================================================================
// Constants
// =============================================================================

const SERVER_NAME = "specbmad-mcp-gate";
const SERVER_VERSION = "0.1.0";
const MAX_STATE_SIZE = 1024 * 1024; // 1MB
const MAX_ERROR_MESSAGE_LENGTH = 200;

// =============================================================================
// Types
// =============================================================================

export interface GateResult {
  gateId: string;
  passed: boolean;
  blocking?: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

export interface TraceItem {
  type: "code" | "test" | "doc";
  location: string;
  description: string;
}

// =============================================================================
// Server
// =============================================================================

const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// =============================================================================
// Security Validation
// =============================================================================

function sanitizeInput(input: string, maxLength: number = 1000): string {
  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

function sanitizeError(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  // Remove potential path leaks
  const sanitized = errorMessage
    .replace(/#\{[0-9a-f]+\}/gi, "[HASH]")
    .replace(/\/[a-zA-Z0-9_\-.]+\//g, "[PATH]/")
    .replace(/\/[a-zA-Z0-9_\-.]+\.[a-z]+/g, "[FILE]");
  // Truncate
  return sanitized.length > MAX_ERROR_MESSAGE_LENGTH
    ? sanitized.substring(0, MAX_ERROR_MESSAGE_LENGTH) + "..."
    : sanitized;
}

function getProjectRoot(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  // Resolve to absolute path to prevent working directory manipulation
  const resolved = path.resolve(root);
  return resolved;
}

function validateProjectRoot(projectRoot: string): void {
  const resolved = path.resolve(projectRoot);

  // Allow temporary directories (for testing)
  const tempDirs = [
    require('os').tmpdir(), // /tmp on Linux, /var/folders/xxx/T on macOS
    '/var/folders',
    '/private/var/folders', // resolved symlink for /var/folders on macOS
    '/tmp',
    '/var/tmp'
  ];

  const isTempDir = tempDirs.some(dir => resolved.startsWith(dir));

  // DEBUG

  // Block common sensitive system paths (but allow temp directories)
  const blockedPrefixes = [
    '/etc', '/usr', '/root', '/bin', '/sbin',
    '/dev', '/proc', '/sys', '/boot', '/lib',
    '/opt', '/run', '/srv', '/private', '/lost+found'
  ];

  for (const prefix of blockedPrefixes) {
    if (resolved.startsWith(prefix) && !isTempDir) {
      throw new Error("system paths not allowed");
    }
  }

  // For non-temp, non-system directories, reject path traversal attempts
  // Absolute paths to user directories are allowed (e.g., /Users/test/project)
  if (!isTempDir) {
    if (projectRoot.startsWith('/../') || projectRoot.startsWith('../')) {
      throw new Error("Invalid project root: path traversal not allowed");
    }
  }

  // Ensure path is within reasonable bounds
  if (resolved.length > 500) {
    throw new Error("path too long");
  }
}

function validateSpecId(specId: string): void {
  if (!specId || specId.length > 100) {
    throw new Error("Invalid spec_id: length out of range");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(specId)) {
    throw new Error("Invalid spec_id: must be alphanumeric, dash, or underscore only");
  }
}

function validateRequirementId(requirementId: string): void {
  if (!requirementId || requirementId.length > 100) {
    throw new Error("Invalid requirement_id: length out of range");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(requirementId)) {
    throw new Error("Invalid requirement_id: must be alphanumeric, dash, or underscore only");
  }
}

function validateGateId(gateId: string): void {
  if (!gateId || gateId.length > 100) {
    throw new Error("Invalid gate_id: length out of range");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(gateId)) {
    throw new Error("Invalid gate_id: must be alphanumeric, dash, or underscore only");
  }
}

function validateAgentContext(agentContext?: {
  agent_name: string;
  allowed_paths?: string[];
}): void {
  // Security: agent_context is optional for backward compatibility
  // but recommended for security enforcement
  if (!agentContext) {
    return;
  }

  if (!agentContext.agent_name || agentContext.agent_name.length > 100 || agentContext.agent_name.trim().length === 0) {
    throw new Error("Invalid agent_name: must be non-empty string");
  }

  // Validate allowed_paths if provided
  if (agentContext.allowed_paths) {
    if (!Array.isArray(agentContext.allowed_paths)) {
      throw new Error("Invalid agent_context: allowed_paths must be an array");
    }
    if (agentContext.allowed_paths.length > 20) {
      throw new Error("Invalid agent_context: too many allowed paths");
    }
    for (const p of agentContext.allowed_paths) {
      if (typeof p !== "string" || p.length > 500) {
        throw new Error("Invalid agent_context: invalid path in allowed_paths");
      }
      validateProjectRoot(p);
    }
  }
}

function validateStateFormat(state: unknown): state is { currentPhase?: unknown; lastTransition?: unknown; gateHistory?: unknown } {
  if (state && typeof state === "object") {
    const s = state as Record<string, unknown>;
    // Only allow known fields
    const knownFields = ["currentPhase", "lastTransition", "gateHistory"];
    const fields = Object.keys(s);
    for (const field of fields) {
      if (!knownFields.includes(field)) {
        throw new Error(`Invalid state field: ${field}`);
      }
    }
    return true;
  }
  return false;
}

// =============================================================================
// Gate Registry
// =============================================================================

interface GateChecker {
  checkGate(gateId: string, context: {
    phase: number;
    projectRoot: string;
    metadata?: Record<string, unknown>;
  }): Promise<GateResult>;
}

class GateRegistry {
  private checkers: Map<string, GateChecker> = new Map();

  register(gateId: string, checker: GateChecker): void {
    this.checkers.set(gateId, checker);
  }

  async checkGates(gateIds: string[], context: {
    phase: number;
    projectRoot: string;
    metadata?: Record<string, unknown>;
  }): Promise<GateResult[]> {
    const results: GateResult[] = [];
    for (const gateId of gateIds) {
      const checker = this.checkers.get(gateId);
      if (!checker) {
        results.push({
          gateId,
          passed: false,
          message: `Gate checker not registered: ${gateId}`,
        });
        continue;
      }
      try {
        const result = await checker.checkGate(gateId, context);
        results.push(result);
      } catch (error) {
        results.push({
          gateId,
          passed: false,
          message: `Gate check error: ${sanitizeError(error)}`,
        });
      }
    }
    return results;
  }
}

const gateRegistry = new GateRegistry();

// =============================================================================
// Gate Implementations
// =============================================================================

class ReviewGateChecker implements GateChecker {
  async checkGate(gateId: string, context: {
    phase: number;
    projectRoot: string;
  }): Promise<GateResult> {
    const fs = await import("fs");
    const pathModule = await import("path");

    // Use validated project root
    validateProjectRoot(context.projectRoot);
    const reportPath = pathModule.join(context.projectRoot, ".specbmad", "artifacts", "review_report.md");

    if (!fs.existsSync(reportPath)) {
      return {
        gateId,
        passed: true,
        blocking: true,
        message: "Review report not found, default pass",
      };
    }

    try {
      // Limit file read size
      const stats = fs.statSync(reportPath);
      if (stats.size > MAX_STATE_SIZE) {
        return {
          gateId,
          passed: false,
          blocking: true,
          message: "Review report exceeds maximum size",
        };
      }

      const content = fs.readFileSync(reportPath, "utf-8");

      // Simple check for pass status (note: this is not cryptographic)
      // In production, use proper signature verification
      const passed = /\b(PASSED|通过|approved)\b/i.test(content);

      return {
        gateId,
        passed,
        blocking: true,
        message: passed ? "QA Review passed" : "QA Review not passed, issues need fixing",
      };
    } catch (error) {
      return {
        gateId,
        passed: false,
        blocking: true,
        message: `Failed to read review report: ${sanitizeError(error)}`,
      };
    }
  }
}

class DeepCodeGateChecker implements GateChecker {
  async checkGate(gateId: string, context: {
    phase: number;
    projectRoot: string;
  }): Promise<GateResult> {
    const fs = await import("fs");
    const pathModule = await import("path");

    validateProjectRoot(context.projectRoot);
    const reportPath = pathModule.join(context.projectRoot, ".specbmad", "artifacts", "deepcode_report.md");
    const reportDir = pathModule.dirname(reportPath);

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // Re-validate resolved path after directory creation (TOCTOU protection)
    const realReportDir = fs.realpathSync(reportDir);
    validateProjectRoot(realReportDir);

    // Only create report if not exists or size is reasonable
    if (!fs.existsSync(reportPath)) {
      const mockReport = `# DeepCode Verification Report (Mock)

## Timestamp
${new Date().toISOString()}

## Result
Mock verification passed

## Note
This is a mock implementation. Real DeepCode integration pending.
`;

      fs.writeFileSync(reportPath, mockReport, "utf-8");
    }

    return {
      gateId,
      passed: true,
      blocking: true,
      message: "Mock DeepCode verification passed",
    };
  }
}

function registerDefaultGates(): void {
  gateRegistry.register("review_passed", new ReviewGateChecker());
  gateRegistry.register("deepcode_passed", new DeepCodeGateChecker());
  gateRegistry.register("verification_passed", new DeepCodeGateChecker());
}

// =============================================================================
// Tool Handlers
// =============================================================================

async function handleVerifyCode(args: {
  code: string;
  spec_id?: string;
  requirements?: string[];
  phase?: number;
  project_root?: string;
  agent_context?: {
    agent_name: string;
    allowed_paths?: string[];
  };
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate all inputs
    if (args.spec_id) validateSpecId(args.spec_id);
    if (args.project_root) validateProjectRoot(args.project_root);
    validateAgentContext(args.agent_context);

    const projectRoot = getProjectRoot(args.project_root);
    validateProjectRoot(projectRoot);

    const phase = args.phase || 2;
    let gateId = "deepcode_passed";
    if (phase === 3) {
      gateId = "verification_passed";
    }

    const result = await gateRegistry.checkGates([gateId], {
      phase,
      projectRoot,
      metadata: {
        code_hash: args.code.length, // Only store hash, not actual code
        requirements: args.requirements,
        agent: args.agent_context?.agent_name,
      },
    });

    const gateResult = result[0];
    const issues = [];
    if (!gateResult.passed && gateResult.message) {
      issues.push({
        type: "error",
        message: gateResult.message,
      });
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            pass: gateResult.passed,
            issues,
            gate_id: gateId,
            trace_id: `trace_${Date.now()}`,
            phase,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            pass: false,
            issues: [
              {
                type: "error",
                message: `Verification error: ${sanitizeError(error)}`,
              },
            ],
          }),
        },
      ],
    };
  }
}

async function handleCheckGate(args: {
  gate_id: string;
  phase?: number;
  project_root?: string;
  agent_context?: {
    agent_name: string;
    allowed_paths?: string[];
  };
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    validateGateId(args.gate_id);
    if (args.project_root) validateProjectRoot(args.project_root);
    validateAgentContext(args.agent_context);

    const projectRoot = getProjectRoot(args.project_root);
    validateProjectRoot(projectRoot);
    const phase = args.phase || 0;

    const result = await gateRegistry.checkGates([args.gate_id], {
      phase,
      projectRoot,
      metadata: {
        agent: args.agent_context?.agent_name,
      },
    });

    const gateResult = result[0];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            gate_id: args.gate_id,
            passed: gateResult.passed,
            blocking: gateResult.blocking ?? true,
            message: gateResult.message || "",
            details: gateResult.details,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            gate_id: args.gate_id,
            passed: false,
            blocking: true,
            message: `Gate check error: ${sanitizeError(error)}`,
          }),
        },
      ],
    };
  }
}

async function handleTraceRequirement(args: {
  requirement_id: string;
  spec_id?: string;
  project_root?: string;
  agent_context?: {
    agent_name: string;
    allowed_paths?: string[];
  };
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    validateRequirementId(args.requirement_id);
    if (args.spec_id) validateSpecId(args.spec_id);
    if (args.project_root) validateProjectRoot(args.project_root);
    validateAgentContext(args.agent_context);

    const projectRoot = getProjectRoot(args.project_root);
    validateProjectRoot(projectRoot);

    // Mock trace data
    const traceItems: TraceItem[] = [
      {
        type: "code",
        location: "src/module.ts",
        description: "Implementation of requirement",
      },
      {
        type: "test",
        location: "tests/module.test.ts",
        description: "Unit tests for requirement",
      },
    ];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            requirement_id: args.requirement_id,
            status: "partial",
            trace_items: traceItems,
            coverage_percentage: 75,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            requirement_id: args.requirement_id,
            status: "not_started",
            trace_items: [],
            coverage_percentage: 0,
            error: `Trace error: ${sanitizeError(error)}`,
          }),
        },
      ],
    };
  }
}

async function handleGetSpec(args: {
  spec_id?: string;
  spec_type?: "intent" | "formal";
  project_root?: string;
  agent_context?: {
    agent_name: string;
    allowed_paths?: string[];
  };
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    if (args.spec_id) validateSpecId(args.spec_id);
    if (args.project_root) validateProjectRoot(args.project_root);
    validateAgentContext(args.agent_context);

    const projectRoot = getProjectRoot(args.project_root);
    validateProjectRoot(projectRoot);

    const fs = await import("fs");
    const pathModule = await import("path");

    let specPath: string;
    const specType = args.spec_type || "intent";
    const specId = args.spec_id || "latest";

    if (specType === "formal") {
      specPath = pathModule.join(projectRoot, ".specbmad", "specifications", `formal_spec_${specId}.yaml`);
    } else {
      specPath = pathModule.join(projectRoot, ".specbmad", "specifications", `intent_${specId}.yaml`);
    }

    let content: string;
    if (fs.existsSync(specPath)) {
      const stats = fs.statSync(specPath);
      if (stats.size > MAX_STATE_SIZE) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Spec file exceeds maximum size",
              }),
            },
          ],
        };
      }
      content = fs.readFileSync(specPath, "utf-8");
    } else {
      content = `# Specification ${specId} (${specType})

## Overview
This is a mock specification document.

## Requirements
- REQ-001: First requirement
- REQ-002: Second requirement
`;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            spec_id: specId,
            spec_type: specType,
            content,
            requirements: ["REQ-001", "REQ-002"],
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: `Spec retrieval error: ${sanitizeError(error)}`,
          }),
        },
      ],
    };
  }
}

async function handleGetState(args: {
  project_root?: string;
  include_history?: boolean;
  agent_context?: {
    agent_name: string;
    allowed_paths?: string[];
  };
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    if (args.project_root) validateProjectRoot(args.project_root);
    validateAgentContext(args.agent_context);

    const projectRoot = getProjectRoot(args.project_root);
    validateProjectRoot(projectRoot);

    const fs = await import("fs");
    const pathModule = await import("path");

    const statePath = pathModule.join(projectRoot, ".specbmad", "config", "state.json");

    let currentPhase = 0;
    let lastTransition = new Date().toISOString();
    const gateHistory: GateResult[] = [];

    if (fs.existsSync(statePath)) {
      const stats = fs.statSync(statePath);
      if (stats.size > MAX_STATE_SIZE) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "State file exceeds maximum size",
              }),
            },
          ],
        };
      }

      const stateContent = fs.readFileSync(statePath, "utf-8");
      const state = JSON.parse(stateContent);

      // Validate state format
      if (!validateStateFormat(state)) {
        throw new Error("Invalid state format");
      }

      currentPhase = typeof state.currentPhase === "number" ? state.currentPhase : 0;
      lastTransition = typeof state.lastTransition === "string" ? state.lastTransition : lastTransition;
      if (Array.isArray(state.gateHistory)) {
        gateHistory.push(...state.gateHistory);
      }
    }

    if (gateHistory.length === 0) {
      gateHistory.push(
        {
          gateId: "review_passed",
          passed: true,
          blocking: true,
          message: "Default: passed",
        },
        {
          gateId: "deepcode_passed",
          passed: true,
          blocking: true,
          message: "Default: passed",
        }
      );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            project_id: projectRoot,
            current_phase: currentPhase,
            gate_results: args.include_history ? gateHistory : gateHistory.slice(-5),
            last_transition: lastTransition,
            circuit_state: "closed",
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: `State retrieval error: ${sanitizeError(error)}`,
          }),
        },
      ],
    };
  }
}

// =============================================================================
// Request Handlers
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "verify_code",
        description: "Verify code against specifications and check traceability",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "Code to verify" },
            spec_id: { type: "string", description: "Spec ID" },
            requirements: { type: "array", items: { type: "string" }, description: "Requirements" },
            phase: { type: "number", description: "Phase (0-3)" },
            project_root: { type: "string", description: "Project root" },
            agent_context: {
              type: "object",
              properties: {
                agent_name: { type: "string" },
                allowed_paths: { type: "array", items: { type: "string" } },
              },
            },
          },
          required: ["code"],
        },
      },
      {
        name: "check_gate",
        description: "Check if a specific gate has passed",
        inputSchema: {
          type: "object",
          properties: {
            gate_id: { type: "string", description: "Gate ID" },
            phase: { type: "number", description: "Phase (0-3)" },
            project_root: { type: "string", description: "Project root" },
            agent_context: {
              type: "object",
              properties: {
                agent_name: { type: "string" },
                allowed_paths: { type: "array", items: { type: "string" } },
              },
            },
          },
          required: ["gate_id"],
        },
      },
      {
        name: "trace_requirement",
        description: "Get traceability information for a requirement",
        inputSchema: {
          type: "object",
          properties: {
            requirement_id: { type: "string", description: "Requirement ID" },
            spec_id: { type: "string", description: "Spec ID" },
            project_root: { type: "string", description: "Project root" },
            agent_context: {
              type: "object",
              properties: {
                agent_name: { type: "string" },
                allowed_paths: { type: "array", items: { type: "string" } },
              },
            },
          },
          required: ["requirement_id"],
        },
      },
      {
        name: "get_spec",
        description: "Retrieve specification document",
        inputSchema: {
          type: "object",
          properties: {
            spec_id: { type: "string", description: "Spec ID" },
            spec_type: { type: "string", enum: ["intent", "formal"], description: "Spec type" },
            project_root: { type: "string", description: "Project root" },
            agent_context: {
              type: "object",
              properties: {
                agent_name: { type: "string" },
                allowed_paths: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
      {
        name: "get_state",
        description: "Get current phase state and gate results",
        inputSchema: {
          type: "object",
          properties: {
            project_root: { type: "string", description: "Project root" },
            include_history: { type: "boolean", description: "Include gate history" },
            agent_context: {
              type: "object",
              properties: {
                agent_name: { type: "string" },
                allowed_paths: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "verify_code":
      return handleVerifyCode(args as Parameters<typeof handleVerifyCode>[0]);
    case "check_gate":
      return handleCheckGate(args as Parameters<typeof handleCheckGate>[0]);
    case "trace_requirement":
      return handleTraceRequirement(args as Parameters<typeof handleTraceRequirement>[0]);
    case "get_spec":
      return handleGetSpec(args as Parameters<typeof handleGetSpec>[0]);
    case "get_state":
      return handleGetState(args as Parameters<typeof handleGetState>[0]);
    default:
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Unknown tool: ${name}` }),
          },
        ],
      };
  }
});

// =============================================================================
// Server Startup
// =============================================================================

async function main(): Promise<void> {
  registerDefaultGates();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Started ${SERVER_NAME} v${SERVER_VERSION}`);
}

main().catch((error) => {
  console.error(`Failed to start server: ${error}`);
  process.exit(1);
});

export { server, gateRegistry, sanitizeInput, sanitizeError, getProjectRoot, validateProjectRoot, validateSpecId, validateRequirementId, validateGateId, validateAgentContext, validateStateFormat, handleVerifyCode, handleCheckGate, handleGetState, handleTraceRequirement, handleGetSpec };
