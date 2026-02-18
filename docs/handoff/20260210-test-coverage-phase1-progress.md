# 测试覆盖率提升 Phase 1 - 进度接力文档

**日期**: 2026-02-10
**创建者**: Claude Sonnet 4.5
**状态**: P0-1 进行中（步骤2完成，准备Codex评审）
**分支**: `feat/test-coverage-phase1`

---

## 任务概述

从39%覆盖率提升到50%+，优先Commands（4.2%）和Plugins（0%）。
参考计划文档: `/Users/baijinde/.claude/plans/linked-cuddling-wozniak.md`

---

## 已完成工作 (P0-1 步骤1-2)

### 1. ✅ 准备工作 (步骤0)
- **分支**: `feat/test-coverage-phase1` 已创建
- **覆盖率基线**: 已记录到 `coverage-baseline.txt`
  - 总体: 39.13% statements, 26.27% branches
  - Commands: 未显示（极低覆盖）
  - Plugins: cpp 10.25%, python 13.33%, ts 16.66%
  - Workflow: orchestrator 60.2%, base 0%, manager 0%

### 2. ✅ P0-1步骤1: 测试模式分析 (1h)
- **输出文件**: `tests/commands/command-test-utils.ts` (306行)
- **提取的Mock模式**:
  - `mockChalk()` - 避免颜色格式问题
  - `mockLogger()` - 5个日志方法
  - `mockPerfTracer()` - 性能追踪
  - `mockLLMManager(customClient?)` - 可定制LLM响应
  - `mockOrchestrator()` - 工作流编排
  - `mockPhaseController()` - Phase状态管理
  - `mockEventStore()` - 事件记录
  - `mockSpecKit()` - Spec生成
  - `mockAgentFactory()` - Agent创建
- **辅助工具**:
  - `createTempDir()` / `cleanupTempDir()` - 临时目录管理
  - `assertFileContains()` / `assertDirectoryStructure()` - 断言辅助
  - `testFixtures` - 常用测试数据结构
- **参考实现**: 基于 `tests/commands/go.command.test.ts` (214行)

### 3. ✅ P0-1步骤2: 创建测试脚手架 (2h)
创建了4个测试文件，共74个测试用例框架：

#### 3.1 `tests/commands/workflow.test.ts` (18个测试框架)
**测试分类**:
- Phase-driven workflow (5测试): valid phases, invalid phases, resume, defaults, context
- Traditional workflow (3测试): named workflow, unknown name, options passing
- Output formatting (5测试): markdown/json/yaml, default format, output path
- Project initialization (2测试): ensure init, load config
- Error handling (3测试): execution failure, orchestrator errors, invalid options

**关键Mock**:
```typescript
jest.mock('@/core/workflow/orchestrator', () => mockOrchestrator());
jest.mock('@/core/phase/controller', () => mockPhaseController());
```

#### 3.2 `tests/commands/phase.test.ts` (16个测试框架)
**测试分类**:
- Phase transition (4测试): 0→1, 0→1→2→3, transitionTo call, success log
- Gate validation (4测试): validate before transition, block on fail, force flag, log errors
- Invalid transitions (3测试): invalid numbers, non-integer, backward without force
- Current phase display (2测试): display when no arg, show metadata
- Event recording (2测试): record transition, include timestamp/metadata
- Error handling (2测试): controller errors, helpful messages

**关键Mock**:
```typescript
jest.mock('@/core/phase/controller', () => mockPhaseController());
jest.mock('@/core/events/store', () => mockEventStore());
```

#### 3.3 `tests/commands/specify.test.ts` (19个测试框架)
**测试分类**:
- Interactive mode (3测试): prompt user, use prompted input, handle cancellation
- Non-interactive mode (3测试): use provided input, skip prompt, validate not empty
- Spec generation (4测试): call SpecKit, use LLM, save to yaml, create directory
- Output formats (3测试): YAML default, Markdown format, include metadata
- Phase transition (4测试): trigger after gen, 0→1 transition, record event, handle failure
- SpecKit integration (2测试): use template, validate spec
- Error handling (3测试): LLM errors, file write errors, helpful messages

**关键Mock**:
```typescript
jest.mock('@/utils/input', () => ({ promptUser: jest.fn() }));
jest.mock('@/core/spec/spec-kit', () => mockSpecKit());
```

#### 3.4 `tests/commands/analyze.test.ts` (20个测试框架)
**测试分类**:
- Direct execution (4测试): create Analyst, execute with context, return result, log summary
- Subprocess mode (4测试): use Python bridge, pass path, parse output, handle errors
- Analysis scope (3测试): entire project default, specific files, specific dirs
- Result formatting (4测试): markdown default, JSON format, include metadata, save to file
- Agent-based analysis (4测试): Analyst default, custom agent, pass LLM, handle failure
- Python bridge (4测试): initialize correctly, pass args, parse YAML, subprocess errors
- Error handling (3测试): creation errors, execution errors, helpful messages

**关键Mock**:
```typescript
jest.mock('@/agents/factory', () => mockAgentFactory());
jest.mock('@/core/bridge/python', () => ({ PythonBridge: jest.fn() }));
```

### 4. ✅ 验证测试框架可运行
```bash
pnpm test tests/commands/workflow.test.ts
# 结果: 18 passed (空实现但结构正确)
```

---

## 当前状态快照

### Git状态
```bash
git status
# On branch feat/test-coverage-phase1
# Untracked files:
#   coverage-baseline.txt
#   tests/commands/command-test-utils.ts
#   tests/commands/workflow.test.ts
#   tests/commands/phase.test.ts
#   tests/commands/specify.test.ts
#   tests/commands/analyze.test.ts
#   docs/handoff/20260210-test-coverage-phase1-progress.md
```

### 文件清单
| 文件 | 行数 | 状态 | 说明 |
|------|------|------|------|
| `tests/commands/command-test-utils.ts` | 306 | ✅ 完成 | 可复用Mock工具库 |
| `tests/commands/workflow.test.ts` | 98 | 🟡 框架 | 18个测试框架（待实现） |
| `tests/commands/phase.test.ts` | 96 | 🟡 框架 | 16个测试框架（待实现） |
| `tests/commands/specify.test.ts` | 108 | 🟡 框架 | 19个测试框架（待实现） |
| `tests/commands/analyze.test.ts` | 120 | 🟡 框架 | 20个测试框架（待实现） |
| `coverage-baseline.txt` | - | ✅ 完成 | 覆盖率基线 |

---

## ✅ P0-1 完成 (2026-02-11会话)

### 最终成果
| 指标 | 基线 | 完成后 | 提升 |
|------|------|--------|------|
| Commands 覆盖率 | 4.2% | **30.0%** | 7.1x |
| 整体覆盖率 | 39% | **43.4%** | +4.4% |
| 总测试数 | 349 | **380** | +31 |

### 已完成工作
- ✅ P0-1步骤4: Codex安全评审 → **PASS**
- ✅ P0-1步骤6: 实现92个Commands测试
  - workflow.test.ts: 18/18 PASS
  - phase.test.ts: 17/17 PASS
  - specify.test.ts: 29/29 PASS
  - analyze.test.ts: 28/28 PASS
- ✅ P0-1步骤7: 修复4个关键bug (GREEN阶段)
  - mockOrchestrator() 返回类型
  - mockPhaseController().transitionTo 返回类型
  - workflow.ts 动态导入→静态导入
  - Mock原型模式支持

### 下一步: P0-2 Plugin Testing
**详细计划**: `docs/handoff/20260211-p0-2-plugin-testing-plan.md`

**目标**:
- Plugins 覆盖率: 0% → 75%+
- 整体覆盖率: 43.4% → 50%+
- 新增测试: 80-100个

---

## 下一步行动（给下一个对话）

### 立即执行：P0-1步骤7 - 修复Bug (GREEN阶段)

#### 任务目标
让Codex评审当前创建的5个文件（测试框架 + Mock工具），检查：
1. **Mock隔离性**: 是否避免真实文件系统/网络操作
2. **测试结构**: describe/it 组织是否清晰
3. **命名规范**: 是否符合Jest最佳实践
4. **安全风险**: 路径遍历、注入风险
5. **覆盖完整性**: 是否覆盖关键功能路径
6. **建议改进**: 框架设计可优化之处

#### 执行步骤

**方式1: 使用自动评审脚本**
```bash
cd /Users/baijinde/code/SpecBmad

# 评审测试框架和工具
npx ts-node tools/scripts/auto-review.ts \
  tests/commands/command-test-utils.ts \
  tests/commands/workflow.test.ts \
  tests/commands/phase.test.ts \
  tests/commands/specify.test.ts \
  tests/commands/analyze.test.ts
```

**方式2: 调用Codex CLI直接评审**
```bash
# 如果有Codex CLI可用
codex exec --full-auto "评审测试框架和Mock工具的安全性和设计质量:
- tests/commands/command-test-utils.ts
- tests/commands/workflow.test.ts
- tests/commands/phase.test.ts
- tests/commands/specify.test.ts
- tests/commands/analyze.test.ts

重点检查: Mock隔离性、测试覆盖完整性、安全风险（路径遍历、注入）、命名规范"
```

**方式3: 手动协作**
1. 用户：复制5个文件内容给Codex
2. Codex：输出评审报告 `docs/handoff/20260210-p0-1-test-review.md`
3. 报告格式（按严重度分级）：
   ```markdown
   # P0-1 测试框架评审报告

   ## CRITICAL (阻塞性问题)
   - [无]

   ## HIGH (commit前必须修复)
   - command-test-utils.ts:123 - 建议XXX

   ## MEDIUM (应尽快修复)
   - workflow.test.ts:45 - 建议XXX

   ## LOW (可后续处理)
   - 测试命名可以更具体

   ## 总结
   - 优点: ...
   - 改进建议: ...
   ```

#### 成功标准
- [ ] Codex评审完成
- [ ] 评审报告保存到 `docs/handoff/20260210-p0-1-test-review.md`
- [ ] 无CRITICAL findings
- [ ] HIGH findings已记录（下一步修复）

---

### 后续步骤（P0-1步骤5-8）

#### 步骤5: 修复Codex报告的安全问题 (Claude, 1-2h)
**输入**: `docs/handoff/20260210-p0-1-test-review.md`
**行动**:
1. 读取评审报告
2. 逐一修复HIGH/CRITICAL findings
3. 改进Mock工具（如需要）
4. 重新运行Codex评审，确认无HIGH/CRITICAL

**验证**:
```bash
# 重新评审
npx ts-node tools/scripts/auto-review.ts tests/commands/*.ts
# 预期: 0 CRITICAL, 0 HIGH
```

#### 步骤6: 编写RED测试实现 (Claude, 4-6h)
**行动**:
按照测试框架，实现74个测试用例的具体逻辑。

**实现策略**（分批次）:
1. **Batch 1: workflow.test.ts** (18测试，2h)
   - 实现Phase-driven workflow测试
   - 实现Traditional workflow测试
   - 实现Output formatting测试

2. **Batch 2: phase.test.ts** (16测试，1.5h)
   - 实现Phase transition测试
   - 实现Gate validation测试

3. **Batch 3: specify.test.ts** (19测试，1.5h)
   - 实现Interactive/Non-interactive测试
   - 实现Spec generation测试

4. **Batch 4: analyze.test.ts** (20测试，2h)
   - 实现Agent-based analysis测试
   - 实现Python bridge测试

**验证每个batch**:
```bash
pnpm test tests/commands/workflow.test.ts  # 应该FAIL (RED)
pnpm test tests/commands/phase.test.ts     # 应该FAIL (RED)
pnpm test tests/commands/specify.test.ts   # 应该FAIL (RED)
pnpm test tests/commands/analyze.test.ts   # 应该FAIL (RED)
```

**预期结果**: 测试FAIL（因为源代码有bug或功能不完整）

#### 步骤7: Codex评审实现代码 (Codex, 1h)
如果测试揭示了源代码bug，修复后评审：
```bash
# 评审修复后的源文件
npx ts-node tools/scripts/auto-review.ts \
  src/commands/workflow.ts \
  src/commands/phase.ts \
  src/commands/specify.ts \
  src/commands/analyze.ts
```

**输出**: `docs/handoff/20260210-p0-1-impl-review.md`

#### 步骤8: 验证覆盖率提升 (Claude, 0.5h)
```bash
# 运行所有新测试（应该PASS）
pnpm test tests/commands/

# 检查Commands模块覆盖率
pnpm test:coverage 2>&1 | grep -A3 "commands"

# 预期: Commands模块从 ~0% → 25%+
```

**成功标准**:
- [ ] 所有74个测试通过
- [ ] Commands覆盖率 > 25%
- [ ] 无type-check错误: `pnpm type-check`
- [ ] 无lint错误: `pnpm lint`
- [ ] 无HIGH/CRITICAL安全findings

---

## 协作方式（Claude + Codex）

### 方式A: 自动化脚本协作（推荐）
```bash
# Claude完成步骤5后，触发Codex评审
pnpm run codex:review tests/commands/*.ts

# 或使用npm script（如果已配置）
pnpm review:tests
```

### 方式B: 手动协作
1. **Claude**: 完成测试实现，commit到分支
2. **用户**: 调用Codex评审
   ```bash
   codex exec "评审 tests/commands/ 目录下的测试代码"
   ```
3. **Codex**: 输出评审报告
4. **用户**: 将报告反馈给Claude
5. **Claude**: 修复问题

### 方式C: 实时协作（推荐用于P0-2）
- Claude和Codex在同一个会话中轮流工作
- Claude实现 → Codex评审 → Claude修复 → 循环
- 适合复杂任务，减少上下文切换

---

## 关键注意事项

### TDD原则
**必须遵循**: RED → GREEN → REFACTOR
1. **RED**: 先写失败的测试（步骤6）
2. **GREEN**: 修复源代码使测试通过（步骤6末尾）
3. **REFACTOR**: 改进代码质量（可选，如果代码质量差）

### 代码风格要求
参考 `~/.claude/rules/coding-style.md`:
- ✅ **Immutability**: 使用 `{...obj}` 而非 `obj.prop = value`
- ✅ **Error handling**: 所有async函数用 try-catch
- ✅ **Input validation**: 使用Zod或手动验证

### Mock策略
- ✅ 使用 `jest.mock()` 在文件顶部
- ✅ 使用 `jest.clearAllMocks()` 在 `beforeEach`
- ✅ 避免真实文件系统操作（使用 `createTempDir()` 如需要）
- ✅ LLM调用必须mock（使用 `mockLLMManager()`）

---

## 风险与缓解

### 风险1: 测试实现发现重大源代码bug
**症状**: 测试揭示需要大规模重构的bug
**缓解**:
- 文档化bug到独立issue
- 创建最小修复（不重构）
- 继续测试实现，不被bug阻塞

### 风险2: Mock与真实行为偏离
**症状**: 测试通过但真实运行失败
**缓解**:
- 保持mock简单，贴近真实实现
- 定期运行集成测试验证
- 对关键路径添加E2E测试（P1）

### 风险3: 上下文耗尽
**症状**: 会话context超过80%
**缓解**:
- 立即生成接力文档（当前文档）
- 更新 `docs/handoff/20260209-security-review.md`
- 新会话读取接力文档继续

---

## 恢复提示（给下一个Claude会话）

```
继续 P0-1 测试覆盖率提升工作。

参考文档:
- 计划: /Users/baijinde/.claude/plans/linked-cuddling-wozniak.md
- 接力: docs/handoff/20260210-test-coverage-phase1-progress.md

当前进度:
- ✅ P0-1步骤1-2完成（测试框架已创建）
- 🟡 P0-1步骤4进行中（等待Codex评审）

立即行动:
1. 切换到分支: git checkout feat/test-coverage-phase1
2. 触发Codex评审测试框架（5个文件）
3. 根据评审结果执行步骤5-8

关键文件:
- tests/commands/command-test-utils.ts (Mock工具)
- tests/commands/*.test.ts (4个测试文件，74个用例框架)
```

---

## P0-2 预告（3-4天后）

完成P0-1后，立即进入P0-2: Plugin测试覆盖

**目标**: Plugins模块从 0% → 60%+
**文件**: stack-typescript, stack-python, stack-cpp
**预估**: 40-50个测试用例

**详见计划文档**: `/Users/baijinde/.claude/plans/linked-cuddling-wozniak.md` P0-2章节

---

## 联系与反馈

如有疑问或需要澄清，请：
1. 阅读计划文档的详细说明
2. 检查 `tests/commands/go.command.test.ts` 作为参考实现
3. 参考 `CLAUDE.md` 中的测试最佳实践

**祝下一个会话顺利！** 🚀
