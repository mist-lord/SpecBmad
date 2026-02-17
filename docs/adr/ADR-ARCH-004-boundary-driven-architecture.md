# ADR-ARCH-004: Boundary-Driven Architecture

> **状态**: Revised (v2.1)
> **日期**: 2026-02-02 (最后更新)
> **创建日期**: 2026-02-01
> **作者**: SpecBmad Team
> **评审者**: Claude Architect Agent, OpenAI Codex (GPT-5.2)

---

## 修订历史

| 版本 | 日期 | 变更 | 原因 |
|------|------|------|------|
| 1.0 | 2026-02-01 | 初始提案 | - |
| 2.0 | 2026-02-01 | Claude 架构评审 | 风险缓解 |
| 2.1 | 2026-02-02 | 整合 Codex 交叉评审 | 安全强化 |

---

## 背景与问题

在设计 SpecBmad 的 5-Phase SDD 架构时，提出了三个核心问题：

### 问题一：边界定义与验证

**规范边界**：需求出来后，生成规范，规范边界怎么定义？人来验证吗？

**设计边界**：规范有了之后开始架构设计，设计的边界又在哪里？还是人事后校验吗？

**Agent 边界**：Agent 团队协作时，每个 Agent 扮演一个角色，他们的边界又在哪里？是否按需完成了任务？有没有越界？有没有任务真空地带？

### 问题二：SDK 使用

既然有 MCP SDK，还有一个 Agent SDK，怎么用起来？

### 问题三：代码分析能力

Snyk 之前的 DeepCode 是开源的，能不能自己实现，不调用他的接口，把这个能力单独形成一个 SDK？

---

## 决策

### 1. 规范边界 (Spec Boundary)

**方案**：用 **Schema + Contract** 定义边界，用 **Validator Gate** 验证

```
Intent (需求)                    Spec (规范)
┌──────────────────┐            ┌──────────────────┐
│ 自然语言描述      │  ────────► │ EARS 格式规范     │
│ 用户故事          │            │ - SHALL/MUST 语句 │
│ 验收标准          │            │ - 可测试条件      │
└──────────────────┘            └────────┬─────────┘
                                         │
                                         ▼
                            ┌────────────────────┐
                            │   Spec Validator   │
                            │   (Gate: spec_valid)│
                            └────────────────────┘
```

**验证规则**：
- 每个需求有唯一 ID (REQ-001)
- 每个需求有 SHALL/MUST 语句
- 每个需求有可验证的验收标准
- 需求间无冲突 (静态分析)
- 覆盖所有 Intent 中的用户故事

**验证方式**：

| 验证类型 | 方式 | 何时 |
|----------|------|------|
| 结构验证 | 自动 (Schema) | 实时 |
| 完整性验证 | 自动 (覆盖率) | Gate |
| 语义验证 | LLM + 人工 | Gate 后 |
| 业务验证 | 人工审批 | Gate 阻塞等待 |

---

### 2. 设计边界 (Design Boundary)

**方案**：用 **Spec→Design 追溯矩阵** 定义边界

```yaml
# traceability.yaml
REQ-001:
  components: [AuthService, LoginController]
  interfaces: [IAuthProvider]
  tests: [auth.test.ts]

REQ-002:
  components: [EncryptionUtil]
  interfaces: [IEncryption]
  tests: [encryption.test.ts]
```

**验证规则**：
- 每个 REQ 至少映射到 1 个 Component
- 每个 Component 至少关联 1 个 REQ (无孤儿组件)
- 接口定义完整
- 测试覆盖所有 REQ

**问题检测**：

| 问题 | 检测方式 |
|------|----------|
| 设计遗漏 (REQ 没有 Component) | 自动：追溯矩阵覆盖率 < 100% |
| 过度设计 (Component 没有 REQ) | 自动：孤儿组件检测 |
| 架构偏离 (实现与设计不符) | 静态分析：依赖图对比 |

---

### 3. Agent 边界 (Agent Boundary)

**方案**：用 **Task Contract + Boundary Guard** 定义和验证

#### Agent Contract 定义

```yaml
Analyst:
  scope:
    read: [intent.yaml, user_stories.md]
    write: [requirements.yaml, spec.md]
    forbidden: [架构设计, 代码编写, 测试执行]
  input_schema: IntentSpec
  output_schema: RequirementsSpec
  success_criteria:
    - all_user_stories_covered: true
    - each_req_has_acceptance_criteria: true

Architect:
  scope:
    read: [spec.md, requirements.yaml]
    write: [architecture.md, plan.yaml, traceability.yaml]
    forbidden: [需求分析, 代码编写, 测试执行]
  input_schema: RequirementsSpec
  output_schema: DesignSpec
  success_criteria:
    - all_reqs_have_components: true
    - no_orphan_components: true

Developer:
  scope:
    read: [architecture.md, plan.yaml]
    write: [src/*, tests/*]
    forbidden: [需求分析, 架构设计]
  input_schema: DesignSpec
  output_schema: CodeArtifacts
  success_criteria:
    - all_tasks_completed: true
    - tests_pass: true

QA:
  scope:
    read: [spec.md, src/*, tests/*]
    write: [review_report.md]
    forbidden: [需求分析, 架构设计, 代码编写]
  input_schema: CodeArtifacts
  output_schema: ReviewReport
  success_criteria:
    - all_reqs_verified: true
    - no_critical_issues: true
```

#### Boundary Guard 实现

使用 Claude Agent SDK 的 Hooks 机制：

```python
async def boundary_guard(input_data, tool_use_id, context):
    agent_name = context.get("agent_name")
    contract = AGENT_CONTRACTS.get(agent_name)

    tool_name = input_data["tool_name"]
    tool_input = input_data["tool_input"]

    # 检查工具权限
    if tool_name not in contract["allowed_tools"]:
        return {
            "hookSpecificOutput": {
                "permissionDecision": "deny",
                "permissionDecisionReason": f"{agent_name} cannot use {tool_name}",
            }
        }

    # 检查路径权限
    if tool_name == "Write":
        path = tool_input.get("file_path", "")
        if not any(path.startswith(p) for p in contract["allowed_paths"]):
            return {
                "hookSpecificOutput": {
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"{agent_name} cannot write to {path}",
                }
            }

    return {}
```

#### 三层验证

| 层级 | 检测内容 | 实现方式 |
|------|----------|----------|
| 越界检测 | Agent 访问了不该访问的资源 | PreToolUse Hook |
| 输出验证 | Agent 输出符合 Contract | PostToolUse Hook + Schema |
| 真空检测 | 任务没有被任何 Agent 认领 | Coverage Matrix 分析 |

#### 任务真空检测

```
Coverage Matrix:

Task              | Analyst | Architect | Developer | QA
─────────────────────────────────────────────────────────
需求分析           |    ✓    |           |           |
架构设计           |         |     ✓     |           |
接口定义           |         |     ✓     |           |
代码实现           |         |           |     ✓     |
单元测试           |         |           |     ✓     |
集成测试           |         |           |           |   ✓
⚠️ 安全审计        |         |           |           |       ← 真空!
```

---

### 4. SDK 集成方案

#### Claude Agent SDK

来源: https://github.com/anthropics/claude-agent-sdk-python

**核心能力**：

| 能力 | 用途 |
|------|------|
| query() | 简单查询 |
| ClaudeSDKClient | 交互式对话 |
| Subagents | 多 Agent 并行 |
| Hooks | 边界控制 |
| Custom Tools | 自定义工具 (MCP) |

**集成示例**：

```python
from claude_agent_sdk import (
    ClaudeSDKClient, ClaudeAgentOptions, HookMatcher,
    tool, create_sdk_mcp_server
)

# 定义自定义工具 (MCP Server)
@tool("parse_requirements", "Parse natural language requirements", {"text": str})
async def parse_requirements(args):
    requirements = parse_to_ears_format(args["text"])
    return {"content": [{"type": "text", "text": requirements}]}

specbmad_server = create_sdk_mcp_server(
    name="specbmad",
    version="1.0.0",
    tools=[parse_requirements]
)

# 创建 Agent 实例
async def create_agent(agent_name: str, system_prompt: str):
    contract = AGENT_CONTRACTS[agent_name]

    options = ClaudeAgentOptions(
        system_prompt=system_prompt,
        allowed_tools=contract["allowed_tools"],
        mcp_servers={"specbmad": specbmad_server},
        hooks={
            "PreToolUse": [
                HookMatcher(matcher="*", hooks=[boundary_guard]),
            ],
        },
        context={"agent_name": agent_name}
    )

    return ClaudeSDKClient(options=options)
```

---

### 5. 代码分析 SDK

**选择 Semgrep 作为核心引擎**：

| 工具 | 语言支持 | AI 增强 | 自定义规则 | 推荐度 |
|------|----------|---------|------------|--------|
| Semgrep | 30+ | ✓ | ✓ (简单语法) | ⭐⭐⭐⭐⭐ |
| SonarQube | 25+ | ✗ | ✓ (复杂) | ⭐⭐⭐⭐ |
| PMD | 8 | ✗ | ✓ | ⭐⭐⭐ |

**SDK 设计**：

```typescript
// @specbmad/code-analyzer

export interface AnalysisResult {
  passed: boolean;
  findings: Finding[];
  coverage: { files: number; lines: number; issues: number };
  specCompliance?: { reqId: string; status: 'compliant' | 'violation' | 'unknown' }[];
}

export class CodeAnalyzer {
  async runSemgrep(paths: string[]): Promise<Finding[]>;
  async checkSpecCompliance(codePath: string, specPath: string): Promise<SpecCompliance[]>;
  async suggestFix(finding: Finding): Promise<string>;  // LLM 增强
  async analyze(paths: string[], specPath?: string): Promise<AnalysisResult>;
}
```

---

## 后果

### 正面

1. **边界清晰**：每个阶段、每个 Agent 都有明确的输入/输出边界
2. **可验证**：通过 Gate 和 Hook 机制实现自动验证
3. **可追溯**：追溯矩阵确保需求到代码的完整追踪
4. **可审计**：所有 Agent 行为都被记录和验证

### 负面

1. **复杂度增加**：Contract 和 Hook 系统增加了系统复杂度
2. **性能开销**：每次工具调用都需要经过 Hook 验证
3. **维护成本**：Contract 需要随业务变化而更新

---

## 决策变更记录 (🆕 v2.1)

基于 Claude Architect Agent 和 OpenAI Codex (GPT-5.2) 的双模型交叉评审，记录以下关键决策变更：

### 变更 1: Fail-Open → Fail-Closed 🔒

**原决策**: 熔断器开路时允许所有操作 (fail-open)

**新决策**: 熔断器开路时仅允许只读安全工具 (fail-closed + safe mode)

**原因**: Codex 评审指出 "Fail-open is a security foot-gun"，少量失败可能导致安全检查完全失效

**实现**:
```typescript
const SAFE_MODE_TOOLS = ['Read', 'Glob', 'Grep'] as const;

if (this.circuitBreaker.isOpen()) {
  if (SAFE_MODE_TOOLS.includes(toolName as any)) {
    return { allowed: true, reason: 'safe-mode' };
  }
  return { allowed: false, reason: 'circuit-breaker-open-unsafe-tool' };
}
```

---

### 变更 2: 添加 Schema 版本化

**原决策**: 配置文件无版本管理

**新决策**: 所有 `.specbmad/*.yaml` 必须包含 `$schema` 和 `version` 字段

**原因**: Claude 和 Codex 都强调需要显式 Schema 版本化和迁移策略

**实现**:
```yaml
# 所有 YAML 文件必须包含
$schema: "https://specbmad.dev/schemas/{type}/v{major}.{minor}.{patch}"
version: "{major}.{minor}.{patch}"
```

---

### 变更 3: 自动化追溯矩阵

**原决策**: 手动维护 `trace.yaml`

**新决策**: 代码注解 + 自动生成

**原因**: 两个模型都指出手动维护追溯矩阵容易漂移，需要自动化

**实现**:
```typescript
// 代码中使用 @traces 注解
/** @traces REQ-001 */
export class EmailValidator { ... }

// 构建步骤自动生成
// bmad trace:generate
```

---

### 变更 4: 完善工具参数检查

**原决策**: 仅检查 `file_path` 参数

**新决策**: 检查所有工具的所有敏感参数

**原因**: Codex 指出工具可能使用其他参数绕过检查

**实现**:
```typescript
const TOOL_PARAM_SCHEMAS = {
  Write: { file_path: 'path', content: 'content' },
  Edit: { file_path: 'path', old_string: 'content', new_string: 'content' },
  Bash: { command: 'command' },
  Read: { file_path: 'path' },
};
```

---

### 变更 5: Gate 分数语义明确化

**原决策**: 分数范围和扣分规则未定义

**新决策**: 明确定义 0-100 分数范围、severity 扣分规则、修复建议输出

**原因**: Codex 指出 "Gate scoring semantics are underspecified"

**实现**:
```yaml
gate_scoring:
  scale: "0-100"
  severity_mapping:
    critical: -20
    high: -10
    medium: -5
    low: -2
  rounding: floor
  remediation: true
```

---

## 参考

- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-python)
- [Semgrep](https://github.com/returntocorp/semgrep)
- [AI Agent Orchestration Patterns - Microsoft](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [IBM - AI Agent Orchestration](https://www.ibm.com/think/topics/ai-agent-orchestration)
- [SPECBMAD_V2_FINAL.md](../architecture/SPECBMAD_V2_FINAL.md) - 整合评审后的最终架构
- [ARCHITECTURE_REVIEW.md](../architecture/ARCHITECTURE_REVIEW.md) - Claude 评审报告
- [CODEX_CROSS_REVIEW.md](../architecture/CODEX_CROSS_REVIEW.md) - Codex 交叉评审报告
