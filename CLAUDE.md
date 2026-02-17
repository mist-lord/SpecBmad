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

## Agent Teams 协作工作流

### 何时使用 Agent Teams

- 复杂多步骤任务（如跨多文件的重构、新功能实现）
- 需要并行执行的独立子任务
- 需要多角色协作（如实现 + 评审 + 测试）

### Team 工作流程

1. **创建 Team**: 根据任务拆分为多个 Agent
2. **分配任务**: 用 TaskList 管理，每个 Agent 认领任务
3. **并行执行**: 独立任务并行推进，依赖任务按序执行
4. **Codex 评审**: 所有代码变更完成后，必须触发 Codex 评审
5. **修复问题**: 根据评审结果修复 CRITICAL/HIGH 问题
6. **测试验证**: 确保所有测试通过后才算完成

### 任务完成标准 (Definition of Done)

任何代码变更任务，必须满足以下全部条件才算完成：

1. **代码实现完成** — 所有功能已实现
2. **Codex 评审通过** — 无 CRITICAL/HIGH 问题
   ```bash
   npx ts-node tools/scripts/auto-review.ts <changed-files>
   ```
3. **测试通过** — 所有测试 PASS
   ```bash
   pnpm test
   ```
4. **类型检查通过**
   ```bash
   pnpm type-check
   ```
5. **Lint 通过**
   ```bash
   pnpm lint
   ```

### Agent 角色分配参考

| 角色 | subagent_type | 职责 |
|------|--------------|------|
| 实现者 | general-purpose | 编写核心代码 |
| 测试者 | tdd-guide | 编写测试、验证覆盖率 |
| 评审者 | code-reviewer / go-reviewer | 代码质量检查 |
| 安全评审 | security-reviewer | 安全漏洞检测 |
| 架构师 | architect | 架构设计、技术决策 |

### 完成流程 Checklist

```
实现代码 → Codex评审 → 修复问题 → 重新评审(如有CRITICAL/HIGH)
    ↓                                        ↓
测试通过 ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←┘
    ↓
type-check + lint 通过
    ↓
✅ 任务完成
```

## 上下文接力工作流

### 触发时机

当出现以下情况时，主动生成接力文档：
- 上下文窗口接近 80% 使用率
- 复杂任务预计无法在当前会话完成
- 需要中断当前工作（如等待 CI、code review）
- 用户主动要求保存进度

### 接力文档规范

**保存位置**: `docs/handoff/YYYYMMDD-<任务名>.md`

**命名示例**:
- `docs/handoff/20260209-security-review.md`
- `docs/handoff/20260209-test-coverage.md`

### 文档模板

```markdown
# [任务名] 接力文档

**日期**: YYYY-MM-DD
**创建者**: Claude/Codex
**状态**: 进行中 | 阻塞 | 待评审

---

## 任务概述

[1-2句话描述任务目标]

## 已完成工作

1. ✅ 任务1 - 简要说明
   - 修改文件: `path/to/file.ts`
2. ✅ 任务2 - 简要说明

## 待完成工作

1. [ ] **P0** 任务A - 详细说明
   - 目标文件: `path/to/target.ts`
   - 关键点: ...
2. [ ] **P1** 任务B - 详细说明

## 关键文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/core/xxx.ts` | 已修改 | 添加了 XXX 功能 |
| `tests/xxx.test.ts` | 待创建 | 需要补充测试 |

## 阻塞项 (如有)

- [ ] 等待 PR #123 合并
- [ ] 需要确认 API 设计

## 恢复提示

复制以下内容到新对话开始:

    继续 [任务名] 工作。

    参考文档: docs/handoff/YYYYMMDD-xxx.md

    已完成:
    1. ✅ ...
    2. ✅ ...

    待完成 (按优先级):
    1. P0: ...
    2. P1: ...

    请先阅读接力文档，然后继续执行待完成任务。
```

### 协作流程集成

在 Claude + Codex 协作中加入接力环节:

```
Claude                        Codex
──────                        ─────
1. 实现核心功能           ←→  1. 安全评审
   ↓                              ↓
2. 修复评审问题           ←→  2. 编写测试
   ↓                              ↓
   └────── 同步代码 ──────────┘
   ↓                              ↓
3. 检查上下文使用率       ←→  3. 验证测试通过
   ↓
[上下文 > 80%?]
   ↓ Yes
4. 生成接力文档 → docs/handoff/
   ↓
新会话: 读取接力文档继续
```

### 最佳实践

1. **定期检查点**: 每完成一个里程碑就更新接力文档
2. **优先级标注**: 用 P0/P1/P2 标注待完成任务
3. **代码引用**: 包含具体文件路径和行号
4. **可执行恢复提示**: 确保新会话可直接复制使用

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

## 测试覆盖率提升最佳实践

### 目标与策略

**项目目标**: 从58%提升到80%覆盖率（当前 58.21%, 914 测试）
**策略**: 优先低覆盖率模块（workflow 34%, project 7%, prompt 27%, plugin-manager 43%）

### 测试工具库设计

#### 创建可复用Mock工厂

**位置**: `tests/commands/command-test-utils.ts` (参考实现)

**核心Mock模式**:
```typescript
// 1. 依赖注入Mock（在文件顶部）
jest.mock('chalk', () => mockChalk());
jest.mock('@/utils/logger', () => mockLogger());
jest.mock('@/core/llm/manager', () => mockLLMManager());

// 2. 可定制LLM响应
const customClient = createMockLLMClient({
  'phase workflow': 'Phase workflow response',
  'analyze project': 'Analysis result',
});

// 3. 临时目录管理
const tmpDir = createTempDir('test-');
// ... 测试逻辑
cleanupTempDir(tmpDir); // 在afterAll中清理
```

**优点**:
- 避免真实文件系统/网络操作
- 提供确定性测试结果
- 减少测试间耦合

### TDD工作流

**严格遵循**: RED → GREEN → REFACTOR

#### RED阶段（先写失败的测试）
```typescript
describe('WorkflowCommand', () => {
  it('should execute phase workflow with valid phases', async () => {
    await workflowCommand({ phase: true, startPhase: 0, endPhase: 1 });

    expect(Orchestrator.prototype.executePhaseWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ projectState: expect.anything() }),
      0,
      1
    );
  });
});

// 运行: pnpm test workflow.test.ts
// 预期: FAIL (源代码可能有bug或功能未实现)
```

#### GREEN阶段（修复源代码）
```typescript
// 修复 src/commands/workflow.ts 中的bug
// 最小化修改，仅让测试通过

// 运行: pnpm test workflow.test.ts
// 预期: PASS
```

#### REFACTOR阶段（可选）
- 提取重复代码
- 改进变量命名
- 确保immutability

**重要**: 每次refactor后立即运行测试确保仍PASS

### 测试结构设计

#### 使用describe分组
```typescript
describe('CommandName', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // 避免测试间污染
  });

  describe('Feature 1', () => {
    it('should handle normal case', () => {});
    it('should handle edge case', () => {});
    it('should handle error case', () => {});
  });

  describe('Feature 2', () => {
    // ...
  });
});
```

#### 命名规范
- **Describe**: 功能模块名（如 "Phase-driven workflow"）
- **It**: 具体行为（如 "should execute phase workflow with valid phases"）
- 使用 "should" 开头描述期望行为

### 测试覆盖率验证

#### 模块级验证
```bash
# 验证Commands模块覆盖率
pnpm test:coverage 2>&1 | grep -A5 "commands"

# 预期输出:
# commands/workflow.ts | 85.2 | 78.5 | 90.1 | 85.2 |
```

#### 整体覆盖率
```bash
pnpm test:coverage

# 关键指标:
# - Statements: 目标 80%+
# - Branches: 目标 70%+
# - Functions: 目标 80%+
# - Lines: 目标 80%+
```

### Claude + Codex协作最佳实践

#### 评审触发点
- ✅ **测试框架创建后**: Codex评审测试结构和Mock安全性
- ✅ **测试实现后**: Codex评审测试覆盖完整性
- ✅ **源码修复后**: Codex评审修复代码的安全性

#### 评审命令
```bash
# 评审测试代码
npx ts-node tools/scripts/auto-review.ts tests/commands/*.test.ts

# 评审实现代码
npx ts-node tools/scripts/auto-review.ts src/commands/*.ts
```

#### 严重度处理
- **CRITICAL/HIGH**: 必须修复后才能继续
- **MEDIUM**: 应在commit前修复
- **LOW**: 可后续处理，记录到issue

### 常见陷阱与解决方案

#### 陷阱1: 测试隔离失败
**症状**: 单独运行PASS，批量运行FAIL
**解决**:
```typescript
beforeEach(() => {
  jest.clearAllMocks(); // 清理所有mock状态
});

// 避免共享可变对象
const config = { ...defaultConfig }; // 每次创建新对象
```

#### 陷阱2: Mock过度导致假阳性
**症状**: 测试通过但真实运行失败
**解决**:
- 保持mock简单，贴近真实行为
- 对关键路径添加集成测试
- 定期手动运行真实场景验证

#### 陷阱3: 异步测试竞态条件
**症状**: 测试结果不稳定
**解决**:
```typescript
// ❌ 错误：缺少await
it('should save file', () => {
  saveFile('test.txt');
  expect(fs.existsSync('test.txt')).toBe(true); // 可能失败
});

// ✅ 正确：使用async/await
it('should save file', async () => {
  await saveFile('test.txt');
  expect(fs.existsSync('test.txt')).toBe(true);
});
```

#### 陷阱4: 上下文耗尽
**症状**: 会话context超过80%使用率
**解决**:
1. 立即生成接力文档到 `docs/handoff/`
2. 使用 `TodoWrite` 记录进度
3. 新会话读取接力文档继续

### 快速参考

#### 测试命令
```bash
pnpm test                    # 运行所有测试
pnpm test:watch              # 监听模式
pnpm test:coverage           # 覆盖率报告
pnpm test <pattern>          # 运行特定测试
pnpm type-check              # 类型检查
pnpm lint                    # Lint检查
```

#### 关键文件
- 参考测试: `tests/commands/go.command.test.ts`
- Mock工具: `tests/commands/command-test-utils.ts`
- 接力文档: `docs/handoff/YYYYMMDD-*.md`
- 计划文档: `.claude/plans/*.md`

### 经验教训总结

**2026-02-10更新**:

1. ✅ **先创建测试框架，再实现细节**
   - 74个测试用例先创建框架（TODO注释）
   - 验证Jest能识别和运行
   - 再逐批实现具体逻辑

2. ✅ **Mock工具库先行**
   - 提取可复用的mock工厂（10+个）
   - 减少重复代码
   - 提供一致的测试体验

3. ✅ **分批次实现测试**
   - Batch 1: workflow.test.ts (18测试)
   - Batch 2: phase.test.ts (16测试)
   - Batch 3: specify.test.ts (19测试)
   - Batch 4: analyze.test.ts (20测试)
   - 每批次独立验证

4. ✅ **及时触发Codex评审**
   - 测试框架完成 → 评审结构
   - 测试实现完成 → 评审覆盖
   - 源码修复完成 → 评审安全
   - 避免积累大量问题

5. ⚠️ **管理上下文消耗**
   - 测试实现代码量大（预计4000+行）
   - 在步骤2完成后生成接力文档
   - 让Codex评审，下一个会话继续实现

## 相关文档

- [ADR-004: Boundary-Driven Architecture](docs/adr/ADR-ARCH-004-boundary-driven-architecture.md)
- 单元测试: `tests/unit/boundary/`
- 集成测试: `tests/integration/boundary-guard.test.ts`
- 自动评审脚本: `tools/scripts/auto-review.ts`
- Claude 技能: `.claude/skills/security-review/SKILL.md`
- 测试覆盖率计划: `.claude/plans/linked-cuddling-wozniak.md`
- 接力文档: `docs/handoff/20260210-test-coverage-phase1-progress.md`
