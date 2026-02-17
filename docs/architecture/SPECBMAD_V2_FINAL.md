# SpecBmad V2 Final Architecture

> **版本**: 2.1.0
> **日期**: 2026-02-02
> **状态**: Approved (整合 Claude + Codex 双模型评审反馈)

---

## 1. 架构概述

SpecBmad V2 是一个 **边界驱动规范驱动开发 (Boundary-Driven SDD)** 平台。

### 1.1 核心原则

| 原则 | 描述 |
|------|------|
| **Spec-First** | 规范是源头，代码是产物 |
| **Boundary-Guarded** | 每个 Phase/Agent 有明确边界 |
| **Fail-Closed Security** | 🆕 安全边界失败时拒绝而非放行 |
| **Traceable** | 需求→设计→代码→测试 全程追溯 (自动化) |
| **Configurable Gates** | 关键节点可配置验证（非强制 100%）|
| **Schema-Versioned** | 🆕 所有配置文件带版本，支持迁移 |
| **Graceful Degradation** | 外部依赖不可用时优雅降级 |

### 1.2 技术栈

| 层级 | 技术选型 | 备注 |
|------|----------|------|
| 语言 | **TypeScript** | 统一，无 Python |
| Agent Runtime | Claude Agent SDK | 带抽象层，支持回退 |
| 协议层 | MCP | 工具调用标准 |
| 代码分析 | ESLint + 可选 Semgrep | 优先内置工具 |
| 规范格式 | EARS | 行业标准 |
| 存储 | YAML (Git 版本化) | 简化配置文件数量 |

---

## 2. 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SpecBmad V2 Final Architecture                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Configuration Layer                               │  │
│  │                                                                        │  │
│  │  .specbmad/                                                           │  │
│  │  ├── config.yaml      # 统一配置 (agents, gates, phases)              │  │
│  │  ├── spec.yaml        # 规范数据 (intent + requirements)              │  │
│  │  └── trace.yaml       # 追溯矩阵                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Orchestrator                                   │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │                  Agent Abstraction Layer                          │ │  │
│  │  │                                                                    │ │  │
│  │  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │ │  │
│  │  │  │ Claude SDK  │    │  Direct API │    │   Mock      │           │ │  │
│  │  │  │  Adapter    │    │   Adapter   │    │  Adapter    │           │ │  │
│  │  │  └─────────────┘    └─────────────┘    └─────────────┘           │ │  │
│  │  │         ▲                  ▲                  ▲                    │ │  │
│  │  │         └──────────────────┴──────────────────┘                    │ │  │
│  │  │                          │                                         │ │  │
│  │  │                    IAgentRuntime                                   │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │              Boundary Guard (with Circuit Breaker)                │ │  │
│  │  │                                                                    │ │  │
│  │  │  PreToolUse:  权限检查 → 路径检查 → 工具检查                       │ │  │
│  │  │  PostToolUse: 输出验证 → 覆盖率检查                                │ │  │
│  │  │                                                                    │ │  │
│  │  │  Circuit Breaker: 失败 > 阈值时自动开路，记录警告                   │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│  ════════════════════════════════════════════════════════════════════════   │
│                           4-Phase Pipeline (简化)                            │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                              │
│   Phase 0             Phase 1             Phase 2             Phase 3        │
│  ┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐      │
│  │ Specify  │──────►│  Design  │──────►│  Build   │──────►│  Review  │      │
│  │    🚪    │       │    🚪    │       │    🚪    │       │    🚪    │      │
│  └────┬─────┘       └────┬─────┘       └────┬─────┘       └────┬─────┘      │
│       │                  │                  │                  │             │
│       ▼                  ▼                  ▼                  ▼             │
│   Analyst            Architect          Developer             QA            │
│   Agent              Agent              Agent               Agent           │
│       │                  │                  │                  │             │
│       ▼                  ▼                  ▼                  ▼             │
│   spec.yaml          trace.yaml         code/*            review.md         │
│   (intent+reqs)      + design/          + tests/                            │
│                                                                              │
│  ════════════════════════════════════════════════════════════════════════   │
│                          Gate System (Quality Scores)                        │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐│
│  │  spec_valid   │  │ design_valid  │  │ build_passed  │  │review_passed  ││
│  │               │  │               │  │               │  │               ││
│  │ Score: 0-100  │  │ Score: 0-100  │  │ Score: 0-100  │  │ Score: 0-100  ││
│  │ Threshold: 80 │  │ Threshold: 80 │  │ Threshold: 90 │  │ Threshold: 90 ││
│  │ Blocking: No  │  │ Blocking: No  │  │ Blocking: Yes │  │ Blocking: Yes ││
│  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘│
│                                                                              │
│  ════════════════════════════════════════════════════════════════════════   │
│                              Core Modules                                    │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  SpecValidator  │  │  CodeAnalyzer   │  │ TraceabilityMgr │              │
│  │                 │  │                 │  │                 │              │
│  │ • EARS 解析     │  │ • ESLint 集成   │  │ • 覆盖率计算    │              │
│  │ • Schema 验证   │  │ • 可选 Semgrep  │  │ • 孤儿检测      │              │
│  │ • 冲突检测      │  │ • 可选 LLM 增强 │  │ • 依赖图分析    │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 关键变更（相比初版）

| 项目 | 初版 V2 | 最终 V2 | 原因 |
|------|---------|---------|------|
| Phase 数量 | 5 | **4** | 合并 Capture+Formalize 为 Specify |
| 配置文件 | 6+ 个 | **3** 个 | 减少认知负担 |
| 语言 | Python + TypeScript | **仅 TypeScript** | 统一代码库 |
| Gate 阈值 | 强制 100% | **可配置** | 更务实 |
| Gate 类型 | 二元 pass/fail | **质量分数** | 更灵活 |
| 代码分析 | 必需 Semgrep | **ESLint + 可选 Semgrep** | 减少外部依赖 |
| LLM 增强 | 默认启用 | **可选** | 控制成本 |
| Agent SDK | 直接依赖 | **抽象层 + 回退** | 降低风险 |

---

## 4. Phase 详解

### 4.1 Phase 0: Specify (规范定义)

**合并了原 Capture 和 Formalize**

| 属性 | 值 |
|------|-----|
| **Agent** | Analyst |
| **输入** | 自然语言需求 |
| **输出** | `spec.yaml` (包含 intent 和 requirements) |
| **Gate** | `spec_valid` (阈值 80，非阻塞) |

```yaml
# .specbmad/spec.yaml
$schema: "https://specbmad.dev/schemas/spec/v1.0.0"
version: "1.0.0"

project:
  name: "用户认证系统"
  version: "1.0.0"

intent:
  description: "实现用户登录、注册、权限管理"
  user_stories:
    - id: US-001
      as: "用户"
      want: "能够使用邮箱注册账号"
      so_that: "可以访问系统功能"

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
```

### 4.2 Phase 1: Design (架构设计)

| 属性 | 值 |
|------|-----|
| **Agent** | Architect |
| **输入** | `spec.yaml` |
| **输出** | `trace.yaml`, `design/arch.md`, `design/plan.yaml` |
| **Gate** | `design_valid` (阈值 80，非阻塞) |

```yaml
# .specbmad/trace.yaml
$schema: "https://specbmad.dev/schemas/trace/v1.0.0"
version: "1.0.0"

traceability:
  REQ-001:
    components: [EmailValidator, RegistrationController]
    interfaces: [IEmailValidator]
    tests: [email-validation.test.ts]
    status: mapped

coverage:
  total_reqs: 10
  mapped_reqs: 9
  coverage_percent: 90  # 允许 < 100%

orphan_components: []
```

### 4.3 Phase 2: Build (代码实现)

| 属性 | 值 |
|------|-----|
| **Agent** | Developer |
| **输入** | `trace.yaml`, `design/*` |
| **输出** | `src/*`, `tests/*` |
| **Gate** | `build_passed` (阈值 90，**阻塞**) |

### 4.4 Phase 3: Review (验收评审)

| 属性 | 值 |
|------|-----|
| **Agent** | QA |
| **输入** | `src/*`, `tests/*`, `spec.yaml` |
| **输出** | `review/report.md` |
| **Gate** | `review_passed` (阈值 90，**阻塞**) |

---

## 5. 统一配置

```yaml
# .specbmad/config.yaml

# Schema 版本化 (🆕 必需字段)
$schema: "https://specbmad.dev/schemas/config/v1.0.0"
version: "1.0.0"

# Phase 配置
phases:
  0: { name: specify, next: [1], gate: spec_valid }
  1: { name: design, next: [2], gate: design_valid }
  2: { name: build, next: [3], gate: build_passed }
  3: { name: review, next: [0, 2], gate: review_passed }

# Gate 配置
gates:
  spec_valid:
    threshold: 80
    blocking: false
    checks:
      - type: ears_format
        weight: 30
      - type: coverage
        weight: 40
        params: { min: 80 }
      - type: no_conflicts
        weight: 30

  design_valid:
    threshold: 80
    blocking: false
    checks:
      - type: trace_coverage
        weight: 50
        params: { min: 80 }
      - type: no_orphans
        weight: 30
      - type: deps_valid
        weight: 20

  build_passed:
    threshold: 90
    blocking: true  # 阻塞
    checks:
      - type: tests_pass
        weight: 40
      - type: lint_pass
        weight: 30
      - type: coverage
        weight: 30
        params: { min: 70 }

  review_passed:
    threshold: 90
    blocking: true  # 阻塞
    checks:
      - type: reqs_verified
        weight: 50
      - type: trace_complete
        weight: 30
      - type: no_critical_issues
        weight: 20

# Agent 合约
agents:
  Analyst:
    scope:
      read: ["**/*.md", "**/*.yaml"]
      write: [".specbmad/spec.yaml"]
      forbidden: ["src/**", "tests/**"]
    tools: [Read, Write]

  Architect:
    scope:
      read: [".specbmad/spec.yaml"]
      write: [".specbmad/trace.yaml", "design/**"]
      forbidden: ["src/**", ".specbmad/spec.yaml"]
    tools: [Read, Write]

  Developer:
    scope:
      read: [".specbmad/**", "design/**"]
      write: ["src/**", "tests/**"]
      forbidden: [".specbmad/spec.yaml", ".specbmad/trace.yaml"]
    tools: [Read, Write, Edit, Bash]

  QA:
    scope:
      read: ["**/*"]
      write: ["review/**"]
      forbidden: ["src/**", ".specbmad/spec.yaml"]
    tools: [Read, Write]

# Gate 分数语义 (🆕)
gate_scoring:
  scale: "0-100"
  severity_mapping:
    critical: -20       # 每个 critical 问题扣 20 分
    high: -10           # 每个 high 问题扣 10 分
    medium: -5          # 每个 medium 问题扣 5 分
    low: -2             # 每个 low 问题扣 2 分
  rounding: floor       # 向下取整
  remediation: true     # 每个检查输出修复建议

# 安全模式配置 (🆕)
safe_mode:
  enabled: true
  tools: [Read, Glob, Grep]  # 熔断器开路时允许的只读工具

# 可观测性配置 (🆕)
observability:
  metrics:
    enabled: true
    prefix: "specbmad"
  tracing:
    enabled: true
    trace_id_header: "x-specbmad-trace-id"
  logging:
    level: "info"
    format: "json"

# 可选功能
features:
  semgrep: false        # 默认关闭
  llm_enhance: false    # 默认关闭
  human_approval: false # 默认关闭
```

---

## 6. Agent 抽象层

解决 Claude Agent SDK 依赖风险：

```typescript
// src/core/agent/runtime.ts

export interface IAgentRuntime {
  execute(prompt: string, options: AgentOptions): AsyncIterable<AgentMessage>;
  abort(): void;
}

export class AgentRuntimeFactory {
  static create(type: 'claude-sdk' | 'direct-api' | 'mock'): IAgentRuntime {
    switch (type) {
      case 'claude-sdk':
        return new ClaudeSDKRuntime();
      case 'direct-api':
        return new DirectAPIRuntime();
      case 'mock':
        return new MockRuntime();
    }
  }

  static createWithFallback(): IAgentRuntime {
    try {
      return this.create('claude-sdk');
    } catch (e) {
      console.warn('Claude SDK unavailable, falling back to direct API');
      return this.create('direct-api');
    }
  }
}
```

---

## 7. Boundary Guard (Fail-Closed 设计)

> 🔒 **安全原则**: 熔断器开路时限制为安全工具集，而非完全放行

```typescript
// src/core/agent/boundary-guard.ts

// 安全模式下允许的只读工具
const SAFE_MODE_TOOLS = ['Read', 'Glob', 'Grep'] as const;

// 每个工具的敏感参数定义
const TOOL_PARAM_SCHEMAS: Record<string, Record<string, 'path' | 'command' | 'content'>> = {
  Write: { file_path: 'path', content: 'content' },
  Edit: { file_path: 'path', old_string: 'content', new_string: 'content' },
  Bash: { command: 'command' },
  Read: { file_path: 'path' },
  Glob: { pattern: 'path' },
  Grep: { path: 'path', pattern: 'content' },
};

export class BoundaryGuard {
  private circuitBreaker: CircuitBreaker;
  private contracts: AgentContracts;

  constructor(config: BoundaryConfig) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000,
    });
    this.contracts = config.contracts;
  }

  async preToolUse(
    agentName: string,
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<BoundaryResult> {
    // 🔒 Fail-Closed: 熔断器开路时，仅允许安全工具
    if (this.circuitBreaker.isOpen()) {
      if (SAFE_MODE_TOOLS.includes(toolName as any)) {
        this.logWarning(`Circuit breaker open, allowing safe tool: ${toolName}`);
        return { allowed: true, reason: 'safe-mode' };
      }
      this.logError(`Circuit breaker open, blocking unsafe tool: ${toolName}`);
      return { allowed: false, reason: 'circuit-breaker-open-unsafe-tool' };
    }

    try {
      const contract = this.contracts[agentName];

      // 1. 检查工具权限
      if (!contract.tools.includes(toolName)) {
        return { allowed: false, reason: `Tool ${toolName} not allowed` };
      }

      // 2. 检查所有敏感参数 (不仅是 file_path)
      const paramSchema = TOOL_PARAM_SCHEMAS[toolName];
      if (paramSchema) {
        for (const [param, type] of Object.entries(paramSchema)) {
          const value = toolInput[param];
          if (value === undefined) continue;

          if (type === 'path') {
            const pathResult = this.validatePath(value as string, contract);
            if (!pathResult.allowed) return pathResult;
          } else if (type === 'command') {
            const cmdResult = this.validateCommand(value as string, contract);
            if (!cmdResult.allowed) return cmdResult;
          }
        }
      }

      this.circuitBreaker.recordSuccess();
      return { allowed: true };

    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw error;
    }
  }

  private validatePath(path: string, contract: AgentContract): BoundaryResult {
    // 检查 forbidden
    for (const pattern of contract.scope.forbidden) {
      if (minimatch(path, pattern)) {
        return { allowed: false, reason: `Path ${path} is forbidden` };
      }
    }
    // 检查 write (对于写操作)
    for (const pattern of contract.scope.write) {
      if (minimatch(path, pattern)) {
        return { allowed: true };
      }
    }
    // 检查 read (对于读操作)
    for (const pattern of contract.scope.read) {
      if (minimatch(path, pattern)) {
        return { allowed: true };
      }
    }
    return { allowed: false, reason: `Path ${path} not in allowed scope` };
  }

  private validateCommand(command: string, contract: AgentContract): BoundaryResult {
    // 检查危险命令
    const dangerousPatterns = [
      /rm\s+-rf/i,
      /sudo/i,
      /chmod\s+777/i,
      />\s*\/dev\//i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return { allowed: false, reason: `Dangerous command pattern detected` };
      }
    }
    return { allowed: true };
  }
}
```

---

## 8. Gate 系统 (质量分数)

```typescript
// src/core/gates/gate-system.ts

export interface GateResult {
  gateId: string;
  score: number;        // 0-100
  threshold: number;    // 配置的阈值
  passed: boolean;      // score >= threshold
  blocking: boolean;    // 是否阻塞
  checks: CheckResult[];
}

export class GateSystem {
  async checkGate(gateId: string, context: GateContext): Promise<GateResult> {
    const config = this.config.gates[gateId];
    const checks: CheckResult[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    for (const check of config.checks) {
      const checker = this.getChecker(check.type);
      const result = await checker.check(check.params, context);

      checks.push(result);
      totalScore += result.score * check.weight;
      totalWeight += check.weight;
    }

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    return {
      gateId,
      score: Math.round(finalScore),
      threshold: config.threshold,
      passed: finalScore >= config.threshold,
      blocking: config.blocking,
      checks,
    };
  }
}
```

### 8.1 Gate 分数语义 (🆕)

> 基于 Codex 评审反馈添加

| 分数范围 | 状态 | 说明 |
|----------|------|------|
| 90-100 | 🟢 Excellent | 几乎没有问题 |
| 80-89 | 🟡 Good | 有少量 medium/low 问题 |
| 60-79 | 🟠 Needs Work | 有 high 问题或多个 medium 问题 |
| 0-59 | 🔴 Critical | 有 critical 问题或大量问题 |

**扣分规则**:

```
base_score = 100
final_score = base_score
            - (critical_count × 20)
            - (high_count × 10)
            - (medium_count × 5)
            - (low_count × 2)
final_score = max(0, floor(final_score))
```

**修复建议输出**:

每个检查失败时，必须输出修复建议：

```typescript
interface CheckResult {
  checkId: string;
  passed: boolean;
  score: number;
  findings: Finding[];
  remediation?: string;  // 🆕 修复建议
}

// 示例输出
{
  checkId: "ears_format",
  passed: false,
  score: 60,
  findings: [
    { id: "REQ-003", issue: "Missing SHALL/MUST keyword" }
  ],
  remediation: "Add 'SHALL' or 'MUST' to requirement statement, e.g., 'The system SHALL...'"
}
```

---

## 9. 代码分析 (ESLint 优先)

```typescript
// src/core/analyzer/code-analyzer.ts

export class CodeAnalyzer {
  private eslintEngine: ESLint;
  private semgrepEnabled: boolean;

  constructor(config: AnalyzerConfig) {
    this.eslintEngine = new ESLint({
      useEslintrc: true,
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    });
    this.semgrepEnabled = config.features?.semgrep ?? false;
  }

  async analyze(paths: string[]): Promise<AnalysisResult> {
    const findings: Finding[] = [];

    // 1. ESLint (始终运行)
    const eslintResults = await this.eslintEngine.lintFiles(paths);
    findings.push(...this.mapESLintResults(eslintResults));

    // 2. Semgrep (可选)
    if (this.semgrepEnabled && await this.isSemgrepAvailable()) {
      try {
        const semgrepResults = await this.runSemgrep(paths);
        findings.push(...semgrepResults);
      } catch (e) {
        this.logWarning('Semgrep failed, continuing with ESLint results only');
      }
    }

    // 3. 计算分数
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;

    const score = Math.max(0, 100 - criticalCount * 20 - highCount * 10);

    return {
      score,
      passed: criticalCount === 0,
      findings,
      metrics: {
        filesAnalyzed: paths.length,
        issuesFound: findings.length,
      },
    };
  }

  private async isSemgrepAvailable(): Promise<boolean> {
    try {
      execSync('semgrep --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## 10. 目录结构 (简化)

```
.specbmad/
├── config.yaml        # 统一配置 (phases, gates, agents, features)
├── spec.yaml          # 规范数据 (intent + requirements)
├── trace.yaml         # 追溯矩阵
├── design/
│   ├── arch.md        # 架构设计
│   └── plan.yaml      # 实施计划
├── review/
│   └── report.md      # 评审报告
└── logs/
    └── audit.jsonl    # 审计日志 (合并)
```

---

## 11. 实施路线 (10 周)

| 阶段 | 周数 | 内容 | 交付物 |
|------|------|------|--------|
| **Phase 1** | 1-2 | 核心基础设施 | PhaseController 升级, config.yaml 解析 |
| **Phase 2** | 3-4 | Gate 系统 | 质量分数 Gate, 4 个检查器 |
| **Phase 3** | 5-6 | Agent 边界 | 抽象层, BoundaryGuard, 熔断器 |
| **Phase 4** | 7-8 | 追溯系统 | TraceabilityMgr, 覆盖率, 孤儿检测 |
| **Phase 5** | 9-10 | 集成测试 | E2E 测试, 文档, 迁移指南 |

---

## 12. 迁移路径

从 4-Phase MVP 迁移到 V2：

```bash
# 1. 更新依赖
pnpm add @specbmad/core@2.0.0

# 2. 初始化 V2 配置
bmad migrate --from=v1 --to=v2

# 3. 验证配置
bmad doctor --check-v2

# 4. 渐进启用功能
bmad config set features.semgrep true      # 可选
bmad config set features.llm_enhance true  # 可选
```

**兼容性**:
- V1 的 `phase_transitions.yaml` 自动迁移到 `config.yaml`
- 现有 `.specbmad/` 目录结构保持兼容
- Gate 检查器向后兼容

---

## 13. 关键决策总结

| 决策 | 选择 | 原因 |
|------|------|------|
| Phase 数量 | 4 | 简化，合并 Capture+Formalize |
| Gate 阈值 | 可配置 (默认 80-90) | 务实，避免强制 100% |
| 阻塞 Gate | 仅 build/review | 早期阶段允许推进 |
| Agent SDK | 抽象层 + 回退 | 降低单一依赖风险 |
| 代码分析 | ESLint + 可选 Semgrep | 减少外部依赖 |
| 配置文件 | 3 个 | 减少复杂度 |
| 语言 | 纯 TypeScript | 统一代码库 |
| LLM 增强 | 可选 | 控制成本 |

---

## 14. Schema 版本化 (🆕)

> 基于 Claude + Codex 共同建议添加

### 14.1 Schema 定义

所有 `.specbmad/*.yaml` 文件必须包含版本信息：

```yaml
# 必需字段
$schema: "https://specbmad.dev/schemas/{type}/v{major}.{minor}.{patch}"
version: "{major}.{minor}.{patch}"
```

### 14.2 版本检测和迁移

```typescript
// src/core/schema/migrator.ts

export class SchemaMigrator {
  private migrations: Map<string, Migration[]>;

  async migrate(data: any, fromVersion: string, toVersion: string): Promise<any> {
    const migrations = this.getMigrationPath(fromVersion, toVersion);
    let result = data;

    for (const migration of migrations) {
      result = await migration.up(result);
      console.log(`Migrated ${migration.from} → ${migration.to}`);
    }

    return { ...result, version: toVersion };
  }

  async validate(data: any): Promise<ValidationResult> {
    const schemaUrl = data.$schema;
    if (!schemaUrl) {
      return { valid: false, errors: ['Missing $schema field'] };
    }

    const schema = await this.loadSchema(schemaUrl);
    return this.validateAgainstSchema(data, schema);
  }
}

// 迁移定义示例
const migrations: Migration[] = [
  {
    from: '1.0.0',
    to: '1.1.0',
    up: (data) => ({
      ...data,
      // 添加新字段，设置默认值
      gate_scoring: data.gate_scoring ?? { scale: '0-100', rounding: 'floor' },
    }),
    down: (data) => {
      const { gate_scoring, ...rest } = data;
      return rest;
    },
  },
];
```

### 14.3 CLI 迁移命令

```bash
# 检查版本
bmad schema:check

# 自动迁移到最新版本
bmad schema:migrate

# 迁移到指定版本
bmad schema:migrate --to=1.1.0

# 验证配置
bmad schema:validate
```

---

## 15. 自动化追溯 (🆕)

> 基于 Codex 建议："自动化追溯可以通过代码注解实现"

### 15.1 代码注解方式

使用 JSDoc/TSDoc 注解标记需求追溯：

```typescript
// src/validators/email.ts

/**
 * Email validator following RFC 5322
 * @traces REQ-001
 * @traces REQ-002
 */
export class EmailValidator implements IEmailValidator {
  /**
   * Validate email format
   * @traces REQ-001
   */
  validate(email: string): ValidationResult {
    // implementation
  }
}
```

### 15.2 测试注解

```typescript
// tests/validators/email.test.ts

/**
 * @traces REQ-001
 */
describe('EmailValidator', () => {
  /**
   * @traces REQ-001.AC-1
   */
  it('should accept valid emails', () => {
    // test
  });

  /**
   * @traces REQ-001.AC-2
   */
  it('should reject invalid emails', () => {
    // test
  });
});
```

### 15.3 自动生成 trace.yaml

```typescript
// src/core/trace/generator.ts

export class TraceGenerator {
  async generate(srcPaths: string[]): Promise<TraceYaml> {
    const traces: Map<string, TraceEntry> = new Map();

    for (const file of srcPaths) {
      const content = await fs.readFile(file, 'utf-8');
      const annotations = this.extractAnnotations(content);

      for (const { reqId, component, type } of annotations) {
        const entry = traces.get(reqId) ?? { components: [], tests: [] };

        if (type === 'component') {
          entry.components.push(component);
        } else if (type === 'test') {
          entry.tests.push(component);
        }

        traces.set(reqId, entry);
      }
    }

    return this.buildTraceYaml(traces);
  }

  private extractAnnotations(content: string): Annotation[] {
    const regex = /@traces\s+(REQ-\d+(?:\.[A-Z]+-\d+)?)/g;
    // ... extraction logic
  }
}
```

### 15.4 CI 集成

```yaml
# .github/workflows/trace.yml
name: Traceability Check

on: [push, pull_request]

jobs:
  trace:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: bmad trace:generate        # 生成 trace.yaml
      - run: bmad trace:check           # 检查覆盖率
      - run: git diff --exit-code .specbmad/trace.yaml  # 确保提交了最新版本
```

---

## 16. 运维支持 (🆕)

### 16.1 可观测性

```typescript
// src/core/observability/metrics.ts

export class MetricsCollector {
  private prefix = 'specbmad';

  // Gate 指标
  recordGateResult(gateId: string, result: GateResult): void {
    this.gauge(`${this.prefix}_gate_score`, result.score, { gate: gateId });
    this.counter(`${this.prefix}_gate_executions_total`, 1, {
      gate: gateId,
      passed: String(result.passed),
    });
  }

  // 边界违规指标
  recordBoundaryViolation(agentName: string, toolName: string): void {
    this.counter(`${this.prefix}_boundary_violations_total`, 1, {
      agent: agentName,
      tool: toolName,
    });
  }

  // 追溯覆盖率指标
  recordTraceCoverage(coverage: number): void {
    this.gauge(`${this.prefix}_trace_coverage_percent`, coverage);
  }
}
```

### 16.2 并发控制

```typescript
// src/core/config/lock.ts

export class ConfigLock {
  private lockFile = '.specbmad/.lock';

  async acquire(operation: string): Promise<LockHandle> {
    const lockContent = {
      operation,
      timestamp: Date.now(),
      pid: process.pid,
      host: os.hostname(),
    };

    try {
      // 原子性创建锁文件
      await fs.writeFile(this.lockFile, JSON.stringify(lockContent), { flag: 'wx' });
      return { release: () => this.release() };
    } catch (e) {
      if (e.code === 'EEXIST') {
        throw new Error(`Config locked by another process: ${await this.getLockInfo()}`);
      }
      throw e;
    }
  }

  async release(): Promise<void> {
    await fs.unlink(this.lockFile);
  }
}
```

### 16.3 错误恢复

```typescript
// src/core/phase/recovery.ts

export class PhaseRecovery {
  async recover(phase: Phase, error: Error): Promise<RecoveryAction> {
    const state = await this.loadState();

    // 1. 分析错误类型
    const errorType = this.classifyError(error);

    // 2. 确定恢复策略
    switch (errorType) {
      case 'gate_failed':
        return {
          action: 'rollback',
          targetPhase: phase.prev,
          reason: `Gate ${state.lastGate} failed with score ${state.lastScore}`,
          remediation: state.lastRemediation,
        };

      case 'agent_boundary_violation':
        return {
          action: 'retry',
          targetPhase: phase,
          reason: 'Agent boundary violation detected',
          remediation: 'Review agent contract and tool permissions',
        };

      case 'partial_completion':
        return {
          action: 'resume',
          targetPhase: phase,
          reason: 'Phase partially completed',
          checkpoint: state.lastCheckpoint,
        };

      default:
        return {
          action: 'manual',
          reason: `Unknown error: ${error.message}`,
          remediation: 'Review logs and manually resolve',
        };
    }
  }
}
```

### 16.4 退出标准

Review Phase 的成功标准：

| 标准 | 要求 | 验证方式 |
|------|------|----------|
| 需求覆盖 | 所有 REQ 都有对应测试 | trace.yaml 覆盖率 = 100% |
| 测试通过 | 所有测试通过 | Jest/Vitest 结果 |
| 无 Critical 问题 | 0 个 critical 级别问题 | Code analysis 结果 |
| 追溯完整 | 无孤儿组件 | orphan_components = [] |
| 质量分数 | ≥ 90 | review_passed gate score |

---

## 17. 评审反馈整合 (🆕)

### 17.1 评审来源

| 评审者 | 模型 | 日期 |
|--------|------|------|
| Claude Architect Agent | Claude Opus 4.5 | 2026-02-01 |
| OpenAI Codex | GPT-5.2 | 2026-02-01 |

### 17.2 采纳的变更

| 反馈 | 来源 | 变更 |
|------|------|------|
| **Fail-open 是安全漏洞** | Codex | 改为 fail-closed + safe mode |
| **路径检查不完整** | Codex | 检查所有工具的所有敏感参数 |
| **Gate 分数语义不明** | Codex | 添加分数范围、扣分规则、修复建议 |
| **追溯矩阵脆弱** | Codex + Claude | 代码注解 + 自动生成 |
| **缺少 Schema 版本化** | Codex + Claude | 所有 YAML 添加 $schema + version |
| **Claude SDK 依赖风险** | Claude | 抽象层 + 回退机制 |
| **100% 覆盖不现实** | Claude | 可配置阈值（默认 80-90） |
| **缺少错误恢复** | Claude | 添加 PhaseRecovery |
| **缺少可观测性** | Codex | 添加 metrics, tracing, logging |

### 17.3 未采纳的建议

| 建议 | 来源 | 原因 |
|------|------|------|
| 使用 OPA/Rego 策略引擎 | Codex | 增加复杂度，当前规模不需要 |
| 数据库追溯 | Claude | 文件追溯更简单，git 版本化 |
| 完全移除熔断器 | Codex | 保留但改为 fail-closed |

### 17.4 两模型共识

1. ✅ 4-Phase 简化是正确的
2. ✅ Agent 抽象层是好设计
3. ✅ 质量分数比二元更灵活
4. ✅ 追溯需要自动化
5. ✅ 需要 Schema 版本化

---

## 18. 下一步

1. [ ] 团队评审本文档
2. [ ] 确认实施优先级
3. [ ] 创建详细任务拆分
4. [ ] 启动 Phase 1 开发
