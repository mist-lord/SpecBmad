# SpecBmad Project

AI-driven software development workflow tool (AI驱动的软件开发工作流工具)

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js >= 18
- **Package Manager**: pnpm
- **Testing**: Jest
- **Linting**: ESLint

## Common Commands

```bash
# Build
pnpm build           # Full build (ts + ui)
pnpm build:ts        # TypeScript only

# Test
pnpm test            # Run all tests
pnpm test:watch      # Watch mode
pnpm test:integration # Integration tests only

# Lint
pnpm lint            # Check lint errors
pnpm lint:fix        # Auto-fix lint errors
pnpm lint:gate       # Strict lint (no warnings)

# Type Check
pnpm type-check      # TypeScript type check
```

## Project Structure

- `src/` - Source code
  - `agents/` - Agent implementations
  - `commands/` - CLI commands
  - `core/` - Core modules (llm, phase, spec, workflow)
  - `plugins/` - Stack plugins (cpp, python, typescript)
  - `ui/` - UI server
- `tests/` - Test files
- `ui/` - Frontend UI (Remotion)
- `tools/` - Build scripts and utilities

## Code Style

- Use TypeScript strict mode
- Prefer async/await over callbacks
- Use meaningful variable names
- Keep functions focused and small

## Claude + Codex 协作工作流

### 实时协作模式

1. **分工**: 根据专长分配任务
   - Claude: 架构设计、类型定义、核心逻辑
   - Codex: 安全评审、测试用例、配置验证

2. **交叉评审**: 每轮实现后互相评审
   - 使用 `codex exec --full-auto "评审 <file>"` 调起 Codex
   - Codex 输出 Findings 按严重度排序 (CRITICAL > HIGH > MEDIUM > LOW)

3. **测试验证**: 评审后运行测试
   - `pnpm test <test-path>`
   - `pnpm type-check`
   - `pnpm lint`

### 协作流程示例

```
Claude                        Codex
──────                        ─────
1. 实现核心功能           ←→  1. 安全评审
   ↓                              ↓
2. 修复评审问题           ←→  2. 编写测试
   ↓                              ↓
   └────── 同步代码 ──────────┘
   ↓                              ↓
3. 集成测试               ←→  3. 验证测试通过
```

## BoundaryGuard 使用指南

### 概述

BoundaryGuard 是 Fail-Closed 安全系统，确保 Agent 只能执行其权限范围内的操作。

### SDK 集成

```typescript
import { ToolExecutionContext } from '@/core/boundary/sdk-integration';

// 创建 Agent 上下文
const ctx = new ToolExecutionContext('Developer');

// 安全执行工具
const result = await ctx.executeToolSafely(
  'Write',
  { file_path: 'src/index.ts', content: '...' },
  async () => fs.writeFile(...)
);

// 检查熔断器状态
if (ctx.isInSafeMode()) {
  console.warn('Circuit breaker is open - only safe tools allowed');
}
```

### Agent 权限

| Agent | 允许的工具 | 允许的路径 |
|-------|-----------|-----------|
| **Analyst** | Read, Glob, Grep, Write | ./spec/**, ./docs/** |
| **Architect** | Read, Glob, Grep, Write | ./spec/**, ./docs/**, ./design/** |
| **Developer** | Read, Glob, Grep, Write, Edit, Bash | ./src/**, ./tests/**, ./config/** |
| **QA** | Read, Glob, Grep, Write | ./spec/**, ./src/**, ./tests/**, ./docs/review/** |

### 熔断器机制

- **Closed**: 正常状态，按 Contract 验证权限
- **Open**: 安全模式，仅允许 Read, Glob, Grep
- **Half-Open**: 恢复探测，成功后关闭熔断器

### 配置文件

Agent Contract 配置位于 `.specbmad/agent-contracts.yaml`

## 自动化安全评审

### 使用 /security-review 技能

```bash
# 评审指定文件
/security-review src/core/boundary/guard.ts

# 评审多个文件
/security-review src/core/boundary/guard.ts src/core/boundary/tool-validator.ts
```

### 使用自动评审脚本

```bash
# 命令行直接调用
npx ts-node tools/scripts/auto-review.ts <file1> [file2...]

# JSON 格式输出 (用于程序集成)
npx ts-node tools/scripts/auto-review.ts --json src/core/boundary/guard.ts
```

### 评审输出示例

```
🔍 Running Codex security review for: src/core/boundary/guard.ts

============================================================
📋 REVIEW RESULTS
============================================================

⚠️  HIGH:
   src/core/boundary/guard.ts:103
   └─ agentName is trusted directly without verification...

📝 MEDIUM:
   src/core/boundary/guard.ts:173
   └─ validateOutput is a stub...

------------------------------------------------------------
Summary: 0 CRITICAL, 1 HIGH, 1 MEDIUM, 0 LOW
------------------------------------------------------------

❌ Review FAILED: CRITICAL or HIGH issues must be resolved
```

### 严重度分级

| 级别 | 说明 | 处理要求 |
|------|------|---------|
| **CRITICAL** | 可直接利用的安全漏洞 | 必须立即修复 |
| **HIGH** | 重大安全风险 | commit 前必须修复 |
| **MEDIUM** | 中等风险 | 应尽快修复 |
| **LOW** | 低风险/建议 | 可后续处理 |

### 与 CI 集成

评审脚本返回 exit code:
- `0`: 通过 (无 CRITICAL/HIGH)
- `1`: 失败 (存在 CRITICAL/HIGH)

可集成到 pre-commit hook 或 CI pipeline:

```yaml
# .github/workflows/ci.yml
- name: Security Review
  run: npx ts-node tools/scripts/auto-review.ts $(git diff --name-only HEAD~1 | grep '^src/')
```

## 相关文档

- [ADR-004: Boundary-Driven Architecture](docs/adr/ADR-ARCH-004-boundary-driven-architecture.md)
- 单元测试: `tests/unit/boundary/`
- 集成测试: `tests/integration/boundary-guard.test.ts`
- 自动评审脚本: `tools/scripts/auto-review.ts`
- Claude 技能: `.claude/skills/security-review/SKILL.md`
