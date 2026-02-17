# SpecBmad V2 Architecture

> **版本**: 2.0.0-draft
> **日期**: 2026-02-01
> **状态**: Draft - 待交叉评审

---

## 1. 架构概述

SpecBmad V2 是一个 **Boundary-Driven Spec-Driven Development** 平台，核心理念：

> **规范即合约，边界即安全，追溯即信任**

### 1.1 核心原则

| 原则 | 描述 |
|------|------|
| **Spec-First** | 规范是源头，代码是产物 |
| **Boundary-Guarded** | 每个 Phase/Agent 有明确边界 |
| **Traceable** | 需求→设计→代码→测试 全程追溯 |
| **Gate-Controlled** | 关键节点自动+人工验证 |

### 1.2 技术栈

| 层级 | 技术选型 |
|------|----------|
| Agent Runtime | Claude Agent SDK |
| 协议层 | MCP (工具调用) |
| 代码分析 | Semgrep + LLM |
| 规范格式 | EARS (Easy Approach to Requirements Syntax) |
| 追溯存储 | YAML (Git 版本化) |

---

## 2. 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SpecBmad V2 Architecture                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Contract Layer                                 │  │
│  │                                                                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │ Spec Schema │  │ Design      │  │ Agent       │  │ Code        │  │  │
│  │  │ (EARS)      │  │ Traceability│  │ Contracts   │  │ Standards   │  │  │
│  │  │             │  │ Matrix      │  │             │  │             │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Orchestrator                                   │  │
│  │                    (Claude Agent SDK)                                  │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                    Boundary Guard (Hooks)                        │  │  │
│  │  │                                                                  │  │  │
│  │  │  PreToolUse:  权限检查 → 路径检查 → 工具检查                      │  │  │
│  │  │  PostToolUse: 输出验证 → 覆盖率检查 → 真空检测                    │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│  ════════════════════════════════════════════════════════════════════════   │
│                              5-Phase Pipeline                                │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                              │
│  Phase 0        Phase 1        Phase 2        Phase 3        Phase 4        │
│  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐        │
│  │Capture │───►│Formalize───►│ Design │───►│ Build  │───►│ Review │        │
│  │        │    │   🚪   │    │   🚪   │    │   🚪   │    │   🚪   │        │
│  └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘        │
│      │             │             │             │             │              │
│      ▼             ▼             ▼             ▼             ▼              │
│  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐        │
│  │Analyst │    │Validator    │Architect│    │Developer    │  QA    │        │
│  │ Agent  │    │ (Auto)  │    │ Agent  │    │ Agent  │    │ Agent  │        │
│  └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘        │
│      │             │             │             │             │              │
│      ▼             ▼             ▼             ▼             ▼              │
│  intent.yaml   spec.md      design/       code/*       review.md           │
│                ├─ reqs.yaml ├─ arch.md    ├─ src/                          │
│                └─ ears.md   ├─ plan.yaml  └─ tests/                        │
│                             └─ trace.yaml                                   │
│                                                                              │
│  ════════════════════════════════════════════════════════════════════════   │
│                               Gate System                                    │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   spec_valid    │  │  design_valid   │  │  build_passed   │              │
│  │                 │  │                 │  │                 │              │
│  │ ✓ EARS Schema   │  │ ✓ Trace 100%   │  │ ✓ Tests pass    │              │
│  │ ✓ Coverage 100% │  │ ✓ No orphans   │  │ ✓ Semgrep pass  │              │
│  │ ✓ No conflicts  │  │ ✓ Deps valid   │  │ ✓ Spec comply   │              │
│  │ ✓ Human approve │  │                 │  │ ✓ No critical   │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │  review_passed  │                                                        │
│  │                 │                                                        │
│  │ ✓ QA sign-off   │                                                        │
│  │ ✓ Trace complete│                                                        │
│  │ ✓ No violations │                                                        │
│  └─────────────────┘                                                        │
│                                                                              │
│  ════════════════════════════════════════════════════════════════════════   │
│                               SDK Layer                                      │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ @specbmad/      │  │ @specbmad/      │  │ @specbmad/      │              │
│  │ agent-sdk       │  │ code-analyzer   │  │ spec-validator  │              │
│  │                 │  │                 │  │                 │              │
│  │ • Agent 编排    │  │ • Semgrep 集成  │  │ • EARS 解析     │              │
│  │ • 边界控制      │  │ • LLM 修复建议  │  │ • 追溯矩阵      │              │
│  │ • Subagent     │  │ • 规范合规检查  │  │ • 覆盖率分析    │              │
│  │ • Hooks        │  │                 │  │                 │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 详解

### 3.1 Phase 0: Capture (需求捕获)

| 属性 | 值 |
|------|-----|
| **Agent** | Analyst |
| **输入** | 自然语言需求、用户故事 |
| **输出** | `intent.yaml` |
| **Gate** | 无 (准备阶段) |

```yaml
# .specbmad/intent.yaml
project:
  name: "用户认证系统"
  description: "实现用户登录、注册、权限管理"

user_stories:
  - id: US-001
    as: "用户"
    want: "能够使用邮箱注册账号"
    so_that: "可以访问系统功能"
    acceptance_criteria:
      - "邮箱格式验证"
      - "密码强度检查"
      - "发送验证邮件"

  - id: US-002
    as: "用户"
    want: "能够使用邮箱和密码登录"
    so_that: "可以访问我的账户"
```

### 3.2 Phase 1: Formalize (规范形式化)

| 属性 | 值 |
|------|-----|
| **Agent** | Validator (自动) |
| **输入** | `intent.yaml` |
| **输出** | `spec/reqs.yaml`, `spec/ears.md` |
| **Gate** | `spec_valid` |

```yaml
# .specbmad/spec/reqs.yaml
requirements:
  - id: REQ-001
    source: US-001
    type: functional
    priority: high
    statement: |
      The system SHALL validate email format using RFC 5322 standard
      WHEN a user submits a registration form.
    acceptance_criteria:
      - "Valid emails are accepted"
      - "Invalid emails show error message"
    testable: true

  - id: REQ-002
    source: US-001
    type: functional
    priority: high
    statement: |
      The system SHALL enforce password policy
      WHERE password length >= 8 characters
      AND contains at least one uppercase, lowercase, number, and special character.
```

**Gate: spec_valid 检查项**：
- [ ] 每个 US 至少映射到 1 个 REQ
- [ ] 每个 REQ 使用 EARS 语法 (SHALL/MUST)
- [ ] 每个 REQ 有 testable 标记
- [ ] 无冲突需求 (静态分析)
- [ ] 人工审批 (可选阻塞)

### 3.3 Phase 2: Design (架构设计)

| 属性 | 值 |
|------|-----|
| **Agent** | Architect |
| **输入** | `spec/reqs.yaml` |
| **输出** | `design/arch.md`, `design/plan.yaml`, `design/trace.yaml` |
| **Gate** | `design_valid` |

```yaml
# .specbmad/design/trace.yaml
traceability:
  REQ-001:
    components:
      - EmailValidator
      - RegistrationController
    interfaces:
      - IEmailValidator
    tests:
      - email-validation.test.ts
    status: mapped

  REQ-002:
    components:
      - PasswordValidator
      - RegistrationController
    interfaces:
      - IPasswordPolicy
    tests:
      - password-policy.test.ts
    status: mapped

coverage:
  total_reqs: 10
  mapped_reqs: 10
  coverage_percent: 100

orphan_components: []  # 无孤儿组件
```

**Gate: design_valid 检查项**：
- [ ] 追溯覆盖率 = 100%
- [ ] 无孤儿组件
- [ ] 依赖图无循环
- [ ] 接口定义完整

### 3.4 Phase 3: Build (代码实现)

| 属性 | 值 |
|------|-----|
| **Agent** | Developer |
| **输入** | `design/*` |
| **输出** | `src/*`, `tests/*` |
| **Gate** | `build_passed` |

**Gate: build_passed 检查项**：
- [ ] 所有测试通过
- [ ] Semgrep 无 critical/high 问题
- [ ] 代码符合规范约束
- [ ] 覆盖率 >= 80%

### 3.5 Phase 4: Review (验收评审)

| 属性 | 值 |
|------|-----|
| **Agent** | QA |
| **输入** | `src/*`, `tests/*`, `spec/*` |
| **输出** | `review/report.md` |
| **Gate** | `review_passed` |

**Gate: review_passed 检查项**：
- [ ] 所有 REQ 验证通过
- [ ] 追溯矩阵完整
- [ ] 无未解决的 critical 问题
- [ ] QA 签字确认

---

## 4. Agent Contract 系统

### 4.1 Contract 定义

```yaml
# .specbmad/config/agent-contracts.yaml

agents:
  Analyst:
    description: "需求分析专家"
    scope:
      read:
        - "intent.yaml"
        - "user_stories/**"
      write:
        - ".specbmad/intent.yaml"
      forbidden:
        - "design/**"
        - "src/**"
        - "tests/**"
    tools:
      allowed:
        - Read
        - Write
        - mcp__specbmad__parse_intent
      denied:
        - Bash
        - mcp__specbmad__run_tests
    output_schema: IntentSpec
    success_criteria:
      - all_stories_captured: true

  Architect:
    description: "架构设计专家"
    scope:
      read:
        - ".specbmad/spec/**"
      write:
        - ".specbmad/design/**"
      forbidden:
        - ".specbmad/intent.yaml"
        - "src/**"
    tools:
      allowed:
        - Read
        - Write
        - mcp__specbmad__create_diagram
        - mcp__specbmad__validate_trace
    output_schema: DesignSpec
    success_criteria:
      - trace_coverage: 100
      - no_orphans: true

  Developer:
    description: "代码实现专家"
    scope:
      read:
        - ".specbmad/design/**"
        - ".specbmad/spec/**"
      write:
        - "src/**"
        - "tests/**"
      forbidden:
        - ".specbmad/intent.yaml"
        - ".specbmad/spec/**"
    tools:
      allowed:
        - Read
        - Write
        - Edit
        - Bash
        - mcp__specbmad__run_tests
    output_schema: CodeArtifacts
    success_criteria:
      - tests_pass: true
      - coverage_min: 80

  QA:
    description: "质量保证专家"
    scope:
      read:
        - "**/*"
      write:
        - ".specbmad/review/**"
      forbidden:
        - "src/**"
        - ".specbmad/spec/**"
    tools:
      allowed:
        - Read
        - Write
        - mcp__specbmad__verify_req
        - mcp__specbmad__run_analysis
    output_schema: ReviewReport
    success_criteria:
      - all_reqs_verified: true
```

### 4.2 Boundary Guard 实现

```python
# packages/agent-sdk/src/boundary_guard.py

from claude_agent_sdk import HookMatcher
from typing import Dict, Any
import yaml

class BoundaryGuard:
    def __init__(self, contracts_path: str):
        with open(contracts_path) as f:
            self.contracts = yaml.safe_load(f)["agents"]

    async def pre_tool_use(
        self,
        input_data: Dict[str, Any],
        tool_use_id: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        agent_name = context.get("agent_name")
        contract = self.contracts.get(agent_name)

        if not contract:
            return {}

        tool_name = input_data["tool_name"]
        tool_input = input_data.get("tool_input", {})

        # 1. 检查工具权限
        if tool_name in contract["tools"].get("denied", []):
            return self._deny(f"{agent_name} cannot use {tool_name}")

        if tool_name not in contract["tools"].get("allowed", []):
            return self._deny(f"{agent_name} not allowed to use {tool_name}")

        # 2. 检查路径权限
        if tool_name in ["Write", "Edit"]:
            path = tool_input.get("file_path", "")

            # 检查 forbidden 路径
            for forbidden in contract["scope"].get("forbidden", []):
                if self._match_path(path, forbidden):
                    return self._deny(f"{agent_name} cannot write to {path}")

            # 检查 allowed 路径
            allowed = False
            for allow_pattern in contract["scope"].get("write", []):
                if self._match_path(path, allow_pattern):
                    allowed = True
                    break

            if not allowed:
                return self._deny(f"{agent_name} cannot write to {path}")

        return {}

    async def post_tool_use(
        self,
        output_data: Dict[str, Any],
        tool_use_id: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        agent_name = context.get("agent_name")
        contract = self.contracts.get(agent_name)

        # 验证输出 schema
        # 记录操作日志
        # 更新覆盖率矩阵

        return {}

    def _deny(self, reason: str) -> Dict[str, Any]:
        return {
            "hookSpecificOutput": {
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        }

    def _match_path(self, path: str, pattern: str) -> bool:
        # 简化的 glob 匹配
        import fnmatch
        return fnmatch.fnmatch(path, pattern)
```

---

## 5. SDK 设计

### 5.1 @specbmad/agent-sdk

```typescript
// packages/agent-sdk/src/index.ts

export interface AgentConfig {
  name: string;
  systemPrompt: string;
  contract: AgentContract;
}

export interface AgentContract {
  scope: {
    read: string[];
    write: string[];
    forbidden: string[];
  };
  tools: {
    allowed: string[];
    denied?: string[];
  };
  outputSchema: string;
  successCriteria: Record<string, any>;
}

export class SpecBmadAgent {
  private client: ClaudeSDKClient;
  private contract: AgentContract;
  private boundaryGuard: BoundaryGuard;

  constructor(config: AgentConfig) {
    this.contract = config.contract;
    this.boundaryGuard = new BoundaryGuard(config.contract);

    const options = new ClaudeAgentOptions({
      systemPrompt: config.systemPrompt,
      allowedTools: config.contract.tools.allowed,
      hooks: {
        PreToolUse: [
          HookMatcher("*", [this.boundaryGuard.preToolUse]),
        ],
        PostToolUse: [
          HookMatcher("*", [this.boundaryGuard.postToolUse]),
        ],
      },
    });

    this.client = new ClaudeSDKClient(options);
  }

  async execute(task: string): Promise<AgentResult> {
    await this.client.query(task);

    const messages = [];
    for await (const msg of this.client.receiveResponse()) {
      messages.push(msg);
    }

    return this.validateResult(messages);
  }

  private validateResult(messages: Message[]): AgentResult {
    // 验证输出符合 contract
    // 检查 success criteria
  }
}

export class Orchestrator {
  private agents: Map<string, SpecBmadAgent>;
  private phaseConfig: PhaseConfig;

  async runPhase(phase: number, input: any): Promise<PhaseResult> {
    const agent = this.getAgentForPhase(phase);
    const result = await agent.execute(input);

    // 运行 Gate 检查
    const gateResult = await this.checkGate(phase, result);

    if (!gateResult.passed) {
      throw new GateFailedError(gateResult);
    }

    return result;
  }

  async runPipeline(input: any): Promise<PipelineResult> {
    let currentInput = input;

    for (let phase = 0; phase <= 4; phase++) {
      const result = await this.runPhase(phase, currentInput);
      currentInput = result.output;
    }

    return { success: true, artifacts: currentInput };
  }
}
```

### 5.2 @specbmad/code-analyzer

```typescript
// packages/code-analyzer/src/index.ts

import { execSync } from 'child_process';

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line: number;
  message: string;
  rule: string;
  fix?: string;
}

export interface SpecCompliance {
  reqId: string;
  status: 'compliant' | 'violation' | 'unknown';
  evidence?: string;
}

export interface AnalysisResult {
  passed: boolean;
  findings: Finding[];
  specCompliance: SpecCompliance[];
  metrics: {
    filesAnalyzed: number;
    issuesFound: number;
    coveragePercent: number;
  };
}

export class CodeAnalyzer {
  private semgrepConfig: string;
  private llmClient?: LLMClient;

  constructor(options: AnalyzerOptions) {
    this.semgrepConfig = options.semgrepConfig || 'auto';
    this.llmClient = options.llmEnhance ? new LLMClient() : undefined;
  }

  /**
   * 运行 Semgrep 分析
   */
  async runSemgrep(paths: string[]): Promise<Finding[]> {
    const result = execSync(
      `semgrep scan --json --config ${this.semgrepConfig} ${paths.join(' ')}`,
      { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
    );

    const parsed = JSON.parse(result);
    return parsed.results.map(this.mapFinding);
  }

  /**
   * 规范合规检查
   */
  async checkSpecCompliance(
    codePaths: string[],
    specPath: string
  ): Promise<SpecCompliance[]> {
    const spec = await this.loadSpec(specPath);
    const results: SpecCompliance[] = [];

    for (const req of spec.requirements) {
      // 生成该需求的检查规则
      const rule = await this.generateRuleForReq(req);

      // 运行检查
      const findings = await this.runCustomRule(codePaths, rule);

      results.push({
        reqId: req.id,
        status: findings.length === 0 ? 'compliant' : 'violation',
        evidence: findings.length > 0 ? JSON.stringify(findings[0]) : undefined,
      });
    }

    return results;
  }

  /**
   * LLM 增强：生成修复建议
   */
  async suggestFix(finding: Finding): Promise<string> {
    if (!this.llmClient) {
      return '';
    }

    const code = await this.readFileContext(finding.file, finding.line);

    return await this.llmClient.complete(`
      Issue: ${finding.message}
      Rule: ${finding.rule}
      Code:
      \`\`\`
      ${code}
      \`\`\`

      Suggest a fix that addresses this issue while maintaining code functionality.
    `);
  }

  /**
   * 完整分析
   */
  async analyze(paths: string[], specPath?: string): Promise<AnalysisResult> {
    // 1. 运行 Semgrep
    const findings = await this.runSemgrep(paths);

    // 2. 规范合规检查
    let specCompliance: SpecCompliance[] = [];
    if (specPath) {
      specCompliance = await this.checkSpecCompliance(paths, specPath);
    }

    // 3. LLM 增强修复建议
    if (this.llmClient) {
      for (const finding of findings.filter(f =>
        f.severity === 'critical' || f.severity === 'high'
      )) {
        finding.fix = await this.suggestFix(finding);
      }
    }

    // 4. 判断是否通过
    const criticalCount = findings.filter(f =>
      f.severity === 'critical'
    ).length;

    return {
      passed: criticalCount === 0,
      findings,
      specCompliance,
      metrics: {
        filesAnalyzed: paths.length,
        issuesFound: findings.length,
        coveragePercent: this.calculateCoverage(specCompliance),
      },
    };
  }
}
```

### 5.3 @specbmad/spec-validator

```typescript
// packages/spec-validator/src/index.ts

export interface Requirement {
  id: string;
  source: string;
  type: 'functional' | 'non-functional' | 'constraint';
  priority: 'critical' | 'high' | 'medium' | 'low';
  statement: string;
  acceptanceCriteria: string[];
  testable: boolean;
}

export interface TraceabilityEntry {
  reqId: string;
  components: string[];
  interfaces: string[];
  tests: string[];
  status: 'mapped' | 'partial' | 'unmapped';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  coverage: {
    totalReqs: number;
    mappedReqs: number;
    coveragePercent: number;
  };
}

export class SpecValidator {
  /**
   * 验证 EARS 格式
   */
  validateEARS(statement: string): boolean {
    const earsPatterns = [
      /\bSHALL\b/i,
      /\bMUST\b/i,
      /\bWHEN\b.*\bSHALL\b/i,
      /\bWHERE\b.*\bSHALL\b/i,
      /\bIF\b.*\bTHEN\b.*\bSHALL\b/i,
    ];

    return earsPatterns.some(pattern => pattern.test(statement));
  }

  /**
   * 验证规范完整性
   */
  async validateSpec(specPath: string): Promise<ValidationResult> {
    const spec = await this.loadSpec(specPath);
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const req of spec.requirements) {
      // 检查 EARS 格式
      if (!this.validateEARS(req.statement)) {
        errors.push({
          reqId: req.id,
          type: 'format',
          message: 'Statement does not follow EARS syntax',
        });
      }

      // 检查 testable 标记
      if (!req.testable) {
        warnings.push({
          reqId: req.id,
          type: 'testability',
          message: 'Requirement marked as not testable',
        });
      }

      // 检查验收标准
      if (req.acceptanceCriteria.length === 0) {
        errors.push({
          reqId: req.id,
          type: 'completeness',
          message: 'No acceptance criteria defined',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      coverage: this.calculateCoverage(spec),
    };
  }

  /**
   * 验证追溯矩阵
   */
  async validateTraceability(
    specPath: string,
    tracePath: string
  ): Promise<TraceabilityResult> {
    const spec = await this.loadSpec(specPath);
    const trace = await this.loadTrace(tracePath);

    const unmappedReqs: string[] = [];
    const orphanComponents: string[] = [];

    // 检查每个需求是否有映射
    for (const req of spec.requirements) {
      const entry = trace.find(t => t.reqId === req.id);
      if (!entry || entry.components.length === 0) {
        unmappedReqs.push(req.id);
      }
    }

    // 检查孤儿组件
    const allComponents = new Set<string>();
    const mappedComponents = new Set<string>();

    for (const entry of trace) {
      entry.components.forEach(c => mappedComponents.add(c));
    }

    // 从代码中提取所有组件
    const codeComponents = await this.extractComponents();
    codeComponents.forEach(c => allComponents.add(c));

    for (const comp of allComponents) {
      if (!mappedComponents.has(comp)) {
        orphanComponents.push(comp);
      }
    }

    return {
      valid: unmappedReqs.length === 0 && orphanComponents.length === 0,
      unmappedReqs,
      orphanComponents,
      coveragePercent: (spec.requirements.length - unmappedReqs.length) /
                       spec.requirements.length * 100,
    };
  }
}
```

---

## 6. Gate 系统

### 6.1 Gate 定义

```yaml
# .specbmad/config/gates.yaml

gates:
  spec_valid:
    phase: 1
    blocking: true
    checks:
      - type: schema
        validator: ears
        required: true
      - type: coverage
        min_percent: 100
        required: true
      - type: conflict
        analyzer: static
        required: true
      - type: human_approval
        required: false  # 可选

  design_valid:
    phase: 2
    blocking: true
    checks:
      - type: traceability
        coverage_min: 100
        required: true
      - type: orphan_detection
        max_orphans: 0
        required: true
      - type: dependency_graph
        no_cycles: true
        required: true

  build_passed:
    phase: 3
    blocking: true
    checks:
      - type: tests
        pass_rate: 100
        required: true
      - type: semgrep
        max_critical: 0
        max_high: 0
        required: true
      - type: spec_compliance
        min_percent: 100
        required: true
      - type: coverage
        min_percent: 80
        required: false

  review_passed:
    phase: 4
    blocking: true
    checks:
      - type: req_verification
        all_verified: true
        required: true
      - type: trace_complete
        required: true
      - type: qa_signoff
        required: true
```

### 6.2 Gate 实现

```typescript
// packages/core/src/gates/index.ts

export interface GateCheck {
  type: string;
  required: boolean;
  config: Record<string, any>;
}

export interface GateResult {
  gateId: string;
  passed: boolean;
  blocking: boolean;
  checks: CheckResult[];
  summary: string;
}

export class GateSystem {
  private validators: Map<string, GateValidator>;

  constructor() {
    this.validators = new Map([
      ['schema', new SchemaValidator()],
      ['coverage', new CoverageValidator()],
      ['traceability', new TraceabilityValidator()],
      ['tests', new TestValidator()],
      ['semgrep', new SemgrepValidator()],
      ['spec_compliance', new SpecComplianceValidator()],
    ]);
  }

  async checkGate(gateId: string, context: GateContext): Promise<GateResult> {
    const gateConfig = await this.loadGateConfig(gateId);
    const results: CheckResult[] = [];

    for (const check of gateConfig.checks) {
      const validator = this.validators.get(check.type);
      if (!validator) {
        throw new Error(`Unknown validator: ${check.type}`);
      }

      const result = await validator.validate(check, context);
      results.push(result);

      // 如果必需检查失败，立即返回
      if (check.required && !result.passed) {
        return {
          gateId,
          passed: false,
          blocking: gateConfig.blocking,
          checks: results,
          summary: `Failed: ${check.type} - ${result.message}`,
        };
      }
    }

    const allPassed = results.every(r => r.passed || !r.required);

    return {
      gateId,
      passed: allPassed,
      blocking: gateConfig.blocking,
      checks: results,
      summary: allPassed ? 'All checks passed' : 'Some optional checks failed',
    };
  }
}
```

---

## 7. 目录结构

```
.specbmad/
├── config/
│   ├── agent-contracts.yaml    # Agent 边界定义
│   ├── gates.yaml              # Gate 配置
│   └── phases.yaml             # Phase 配置
├── intent/
│   └── intent.yaml             # Phase 0 输出
├── spec/
│   ├── reqs.yaml               # 需求规范
│   ├── ears.md                 # EARS 格式文档
│   └── conflicts.json          # 冲突分析结果
├── design/
│   ├── arch.md                 # 架构设计
│   ├── plan.yaml               # 实施计划
│   ├── trace.yaml              # 追溯矩阵
│   └── diagrams/               # 架构图
├── review/
│   ├── report.md               # 评审报告
│   └── signoff.yaml            # 签字记录
└── logs/
    ├── agent-actions.jsonl     # Agent 操作日志
    ├── gate-results.jsonl      # Gate 检查结果
    └── boundary-violations.jsonl # 边界违规记录
```

---

## 8. 实施路线

### Phase 1: 基础设施 (Week 1-2)

- [ ] 创建 monorepo 结构 (`packages/`)
- [ ] 实现 `@specbmad/spec-validator` 核心
- [ ] 实现 Gate 系统基础
- [ ] 更新 Phase Controller 为 5-Phase

### Phase 2: Agent SDK (Week 3-4)

- [ ] 集成 Claude Agent SDK
- [ ] 实现 BoundaryGuard
- [ ] 实现 Agent Contract 系统
- [ ] 实现 Orchestrator

### Phase 3: Code Analyzer (Week 5-6)

- [ ] 集成 Semgrep
- [ ] 实现规范合规检查
- [ ] 实现 LLM 增强修复

### Phase 4: 集成测试 (Week 7-8)

- [ ] 端到端测试
- [ ] 边界测试
- [ ] 性能测试
- [ ] 文档完善

---

## 9. 待讨论问题

1. **人工审批的时机**：spec_valid 是否需要强制人工审批？
2. **边界违规处理**：违规后是立即失败还是记录并继续？
3. **Subagent 边界**：Subagent 是否继承父 Agent 的边界限制？
4. **追溯粒度**：追溯到函数级别还是文件级别？
5. **性能考虑**：每次工具调用都经过 Hook 的性能影响？
