/**
 * MCP Gate Server Unit Tests
 *
 * Tests for security validation functions and tool handlers.
 */

import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import {
  sanitizeInput,
  sanitizeError,
  getProjectRoot,
  validateProjectRoot,
  validateSpecId,
  validateRequirementId,
  validateGateId,
  validateAgentContext,
  validateStateFormat,
  handleVerifyCode,
  handleCheckGate,
  handleGetState,
  handleTraceRequirement,
  handleGetSpec,
} from "./server";

describe("Security Validation", () => {
  describe("validateProjectRoot", () => {
    it("should reject path traversal attempts with ..", () => {
      expect(() => validateProjectRoot("/../../../etc")).toThrow();
    });

    it("should reject system paths", () => {
      expect(() => validateProjectRoot("/etc")).toThrow("system paths not allowed");
      expect(() => validateProjectRoot("/usr/bin")).toThrow("system paths not allowed");
      expect(() => validateProjectRoot("/root")).toThrow("system paths not allowed");
      expect(() => validateProjectRoot("/usr/local/bin")).toThrow("system paths not allowed");
    });

    it("should reject paths starting with system directories", () => {
      expect(() => validateProjectRoot("/etc/passwd")).toThrow("system paths not allowed");
      expect(() => validateProjectRoot("/usr/share")).toThrow("system paths not allowed");
    });

    it("should accept valid project paths", () => {
      expect(() => validateProjectRoot("/Users/test/project")).not.toThrow();
      expect(() => validateProjectRoot("/home/user/code/myproject")).not.toThrow();
      expect(() => validateProjectRoot("/var/www/project")).not.toThrow();
    });

    it("should accept relative paths", () => {
      expect(() => validateProjectRoot(".")).not.toThrow();
      expect(() => validateProjectRoot("./src")).not.toThrow();
    });

    it("should reject paths that resolve to system directories", () => {
      expect(() => validateProjectRoot("/var/../usr/bin")).toThrow();
    });

    it("should reject paths that are too long", () => {
      const longPath = "/a" + "b".repeat(499);
      expect(() => validateProjectRoot(longPath)).toThrow("path too long");
    });
  });

  describe("validateSpecId", () => {

    it("should accept valid spec IDs", () => {
      expect(() => validateSpecId("spec-001")).not.toThrow();
      expect(() => validateSpecId("SPEC_123")).not.toThrow();
      expect(() => validateSpecId("abc123")).not.toThrow();
      expect(() => validateSpecId("my-spec-v2")).not.toThrow();
    });

    it("should reject empty spec IDs", () => {
      expect(() => validateSpecId("")).toThrow("length out of range");
    });

    it("should reject spec IDs with special characters", () => {
      expect(() => validateSpecId("spec!@#")).toThrow("alphanumeric, dash, or underscore only");
      expect(() => validateSpecId("spec/path")).toThrow("alphanumeric, dash, or underscore only");
      expect(() => validateSpecId("spec.name")).toThrow("alphanumeric, dash, or underscore only");
      expect(() => validateSpecId("spec name")).toThrow("alphanumeric, dash, or underscore only");
    });

    it("should reject spec IDs that are too long", () => {
      const longSpecId = "a".repeat(101);
      expect(() => validateSpecId(longSpecId)).toThrow("length out of range");
    });
  });

  describe("validateRequirementId", () => {


    it("should accept valid requirement IDs", () => {
      expect(() => validateRequirementId("REQ-001")).not.toThrow();
      expect(() => validateRequirementId("REQ_123")).not.toThrow();
      expect(() => validateRequirementId("requirement-abc")).not.toThrow();
    });

    it("should reject empty requirement IDs", () => {
      expect(() => validateRequirementId("")).toThrow("length out of range");
    });

    it("should reject requirement IDs with special characters", () => {
      expect(() => validateRequirementId("REQ@001")).toThrow("alphanumeric, dash, or underscore only");
      expect(() => validateRequirementId("REQ/001")).toThrow("alphanumeric, dash, or underscore only");
      expect(() => validateRequirementId("REQ.001")).toThrow("alphanumeric, dash, or underscore only");
    });

    it("should reject requirement IDs that are too long", () => {
      const longReqId = "a".repeat(101);
      expect(() => validateRequirementId(longReqId)).toThrow("length out of range");
    });
  });

  describe("validateGateId", () => {


    it("should accept valid gate IDs", () => {
      expect(() => validateGateId("review_passed")).not.toThrow();
      expect(() => validateGateId("deepcode-passed")).not.toThrow();
      expect(() => validateGateId("GATE123")).not.toThrow();
    });

    it("should reject empty gate IDs", () => {
      expect(() => validateGateId("")).toThrow("length out of range");
    });

    it("should reject gate IDs with special characters", () => {
      expect(() => validateGateId("review@passed")).toThrow("alphanumeric, dash, or underscore only");
      expect(() => validateGateId("deepcode/passed")).toThrow("alphanumeric, dash, or underscore only");
    });

    it("should reject gate IDs that are too long", () => {
      const longGateId = "a".repeat(101);
      expect(() => validateGateId(longGateId)).toThrow("length out of range");
    });
  });

  describe("sanitizeError", () => {


    it("should remove path leaks from error messages", () => {
      const result = sanitizeError(new Error("Error in /Users/test/file.ts"));
      expect(result).not.toContain("/Users/");
      expect(result).not.toContain("/test/");
      expect(result).not.toContain("file.ts");
    });

    it("should replace paths with placeholders", () => {
      const result = sanitizeError(new Error("Error in /home/user/project/src/index.js"));
      expect(result).toContain("[PATH]");
      expect(result).toContain("[FILE]");
    });

  it("should remove git hashes", () => {
    const result = sanitizeError(new Error("Error in commit #{a1b2c3d4e5f6}"));
    expect(result).not.toContain("#{a1b2c3d4e5f6}");
    expect(result).toContain("[HASH]");
  });

    it("should truncate long errors", () => {
      const longError = "x".repeat(500);
      const result = sanitizeError(new Error(longError));
      expect(result.length).toBeLessThan(250);
      expect(result.endsWith("...")).toBe(true);
    });

    it("should handle non-Error objects", () => {
      const result = sanitizeError("string error");
      expect(result).toBe("string error");
    });

    it("should handle empty errors", () => {
      const result = sanitizeError(new Error(""));
      expect(result).toBe("");
    });
  });

  describe("validateAgentContext", () => {


    it("should accept valid agent context", () => {
      expect(() => validateAgentContext({
        agent_name: "Developer",
        allowed_paths: ["/Users/test/project"],
      })).not.toThrow();
    });

    it("should allow missing agent context", () => {
      expect(() => validateAgentContext(undefined)).not.toThrow();
    });

  it("should reject agent names that are too long", () => {
    const longName = "a".repeat(101);
    expect(() => validateAgentContext({ agent_name: longName })).toThrow();
  });

    it("should reject non-array allowed_paths", () => {
      const invalidContext = {
        agent_name: "Developer",
      };
      Object.defineProperty(invalidContext, "allowed_paths", {
        value: "not-an-array",
        writable: false,
      });
      expect(() => validateAgentContext(invalidContext)).toThrow("allowed_paths must be an array");
    });

    it("should reject too many allowed paths", () => {
      expect(() => validateAgentContext({
        agent_name: "Developer",
        allowed_paths: Array(21).fill("/Users/test"),
      })).toThrow("too many allowed paths");
    });

    it("should reject invalid paths in allowed_paths", () => {
      expect(() => validateAgentContext({
        agent_name: "Developer",
        allowed_paths: ["/etc/passwd"],
      })).toThrow("system paths not allowed");
    });

    it("should reject paths that are too long in allowed_paths", () => {
      expect(() => validateAgentContext({
        agent_name: "Developer",
        allowed_paths: ["/".repeat(501)],
      })).toThrow("invalid path in allowed_paths");
    });
  });

  describe("getProjectRoot", () => {


    it("should return current working directory when no projectRoot provided", () => {
      const result = getProjectRoot();
      expect(result).toBe(process.cwd());
    });

    it("should resolve relative paths to absolute", () => {
      const result = getProjectRoot("./src");
      expect(result).toBe(path.resolve("./src"));
    });

    it("should resolve home directory tilde", () => {
      const result = getProjectRoot("~/project");
      expect(result).toContain(os.homedir());
    });

    it("should return the resolved absolute path", () => {
      const result = getProjectRoot("/Users/test/project");
      expect(path.isAbsolute(result)).toBe(true);
    });
  });
});

describe("Tool Handlers Integration", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-gate-test-"));

  beforeAll(() => {
    const specbmadDir = path.join(tempDir, ".specbmad", "artifacts");
    fs.mkdirSync(specbmadDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("handleVerifyCode", () => {


    it("should return pass: true for valid inputs", async () => {
      const result = await handleVerifyCode({
        code: "console.log('hello');",
        project_root: tempDir,
        agent_context: { agent_name: "Developer" },
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.pass).toBe(true);
      expect(content.gate_id).toBe("deepcode_passed");
    });

    it("should return pass: true for phase 3", async () => {
      const result = await handleVerifyCode({
        code: "console.log('hello');",
        phase: 3,
        project_root: tempDir,
        agent_context: { agent_name: "Developer" },
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.pass).toBe(true);
      expect(content.gate_id).toBe("verification_passed");
    });

    it("should return issues when verification fails", async () => {
      const result = await handleVerifyCode({
        code: "const x = 1;",
        project_root: "/nonexistent",
        agent_context: { agent_name: "Developer" },
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.pass).toBe(false);
      expect(content.issues).toBeDefined();
      expect(content.issues.length).toBeGreaterThan(0);
    });

    it("should sanitize errors in response", async () => {
      const result = await handleVerifyCode({
        code: "test",
        project_root: "/etc",
        agent_context: { agent_name: "Developer" },
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.issues[0].message).not.toContain("/etc");
    });
  });

  describe("handleCheckGate", () => {


    it("should return gate check result for registered gate", async () => {
      const result = await handleCheckGate({
        gate_id: "review_passed",
        project_root: tempDir,
        agent_context: { agent_name: "Developer" },
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.gate_id).toBe("review_passed");
      expect(typeof content.passed).toBe("boolean");
    });

    it("should return passed: false for unregistered gate", async () => {
      const result = await handleCheckGate({
        gate_id: "nonexistent_gate",
        project_root: tempDir,
        agent_context: { agent_name: "Developer" },
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.passed).toBe(false);
      expect(content.message).toContain("not registered");
    });

    it("should sanitize error messages", async () => {
      const result = await handleCheckGate({
        gate_id: "test",
        project_root: "/etc/passwd",
        agent_context: { agent_name: "Developer" },
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.message).not.toContain("/etc");
    });

    it("should use default phase 0 when not provided", async () => {
      const result = await handleCheckGate({
        gate_id: "review_passed",
        project_root: tempDir,
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.gate_id).toBe("review_passed");
    });
  });

  describe("handleGetState", () => {


    it("should return default state when no state file exists", async () => {
      const result = await handleGetState({
        project_root: tempDir,
        agent_context: { agent_name: "Developer" },
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.project_id).toBe(tempDir);
      expect(typeof content.current_phase).toBe("number");
      expect(content.circuit_state).toBe("closed");
      expect(Array.isArray(content.gate_results)).toBe(true);
    });

    it("should include gate history when requested", async () => {
      const result = await handleGetState({
        project_root: tempDir,
        include_history: true,
        agent_context: { agent_name: "Developer" },
      });

      const content = JSON.parse(result.content[0].text);
      expect(Array.isArray(content.gate_results)).toBe(true);
    });

    it("should sanitize path in project_id", async () => {
      const result = await handleGetState({
        project_root: tempDir,
        agent_context: { agent_name: "Developer" },
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.project_id).toBe(tempDir);
    });

    it("should reject invalid project roots", async () => {
      const result = await handleGetState({
        project_root: "/etc",
        agent_context: { agent_name: "Developer" },
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.error).toBeDefined();
    });
  });
});

describe("sanitizeInput", () => {


  it("should remove null bytes and control characters", () => {
    const input = "test\x00value\x07test";
    const result = sanitizeInput(input);
    expect(result).not.toContain("\x00");
    expect(result).not.toContain("\x07");
  });

  it("should truncate long inputs", () => {
    const input = "a".repeat(2000);
    const result = sanitizeInput(input, 100);
    expect(result.length).toBe(100);
  });

  it("should preserve alphanumeric characters", () => {
    const input = "Hello World 123!@#";
    const result = sanitizeInput(input);
    expect(result).toBe("Hello World 123!@#");
  });

  it("should handle empty strings", () => {
    const result = sanitizeInput("");
    expect(result).toBe("");
  });
});

describe("validateStateFormat", () => {


  it("should accept valid state format", () => {
    const state = {
      currentPhase: 1,
      lastTransition: "2024-01-01T00:00:00Z",
      gateHistory: [],
    };
    expect(validateStateFormat(state)).toBe(true);
  });

  it("should reject unknown fields", () => {
    const state = {
      currentPhase: 1,
      unknownField: "value",
    };
    expect(() => validateStateFormat(state)).toThrow("Invalid state field");
  });

  it("should reject non-object states", () => {
    expect(validateStateFormat("string")).toBe(false);
    expect(validateStateFormat(null)).toBe(false);
    expect(validateStateFormat(123)).toBe(false);
  });

  it("should accept empty objects", () => {
    expect(validateStateFormat({})).toBe(true);
  });
});

describe("handleTraceRequirement", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-test-"));

  it("should return trace information for valid requirement", async () => {
    const result = await handleTraceRequirement({
      requirement_id: "REQ-001",
      project_root: tempDir,
      agent_context: { agent_name: "Developer" },
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.requirement_id).toBe("REQ-001");
    expect(content.trace_items).toBeDefined();
    expect(Array.isArray(content.trace_items)).toBe(true);
    expect(content.coverage_percentage).toBeDefined();
  });

  it("should return partial status with mock data", async () => {
    const result = await handleTraceRequirement({
      requirement_id: "REQ-002",
      project_root: tempDir,
      agent_context: { agent_name: "Developer" },
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.status).toBe("partial");
    expect(content.trace_items.length).toBeGreaterThan(0);
  });

  it("should sanitize errors in response", async () => {
    const result = await handleTraceRequirement({
      requirement_id: "../../etc",
      project_root: tempDir,
      agent_context: { agent_name: "Developer" },
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.error).toBeDefined();
    expect(content.error).not.toContain("/");
  });

  it("should reject invalid requirement_id", async () => {
    const result = await handleTraceRequirement({
      requirement_id: "invalid/path",
      project_root: tempDir,
      agent_context: { agent_name: "Developer" },
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.error).toBeDefined();
  });
});

describe("handleGetSpec", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "spec-test-"));

  it("should return mock spec when file not found", async () => {
    const result = await handleGetSpec({
      spec_id: "latest",
      project_root: tempDir,
      agent_context: { agent_name: "Developer" },
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.spec_id).toBe("latest");
    expect(content.spec_type).toBe("intent");
    expect(content.content).toBeDefined();
    expect(content.requirements).toBeDefined();
  });

  it("should retrieve formal spec type", async () => {
    const result = await handleGetSpec({
      spec_id: "v1",
      spec_type: "formal",
      project_root: tempDir,
      agent_context: { agent_name: "Developer" },
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.spec_type).toBe("formal");
    expect(content.spec_id).toBe("v1");
  });

  it("should sanitize errors in response", async () => {
    const result = await handleGetSpec({
      spec_id: "../../../etc/passwd",
      project_root: tempDir,
      agent_context: { agent_name: "Developer" },
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.error).toBeDefined();
    expect(content.error).not.toContain("/etc");
  });

  it("should reject system paths", async () => {
    const result = await handleGetSpec({
      project_root: "/etc",
      agent_context: { agent_name: "Developer" },
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.error).toBeDefined();
  });
});
