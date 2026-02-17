# SpecBmad 功能评审与测试评审总结

**日期**: 2026-02-08
**评审者**: Claude Opus 4.5 + Security Reviewer Agent
**项目版本**: v0.1.0 (90% 完成)

---

## 执行摘要

完成了对 SpecBmad BoundaryGuard 安全模块的全面评审，包括功能评审和测试覆盖率分析。

### 关键发现

| 类别 | 数量 | 严重程度 |
|------|------|---------|
| CRITICAL 安全问题 | 2 | 阻塞发布 |
| HIGH 安全问题 | 4 | 需修复 |
| MEDIUM 问题 | 5 | 应修复 |
| 架构缺陷 | 4 | 需补充 |
| 测试覆盖率 | 35.95% | 远低于 80% 目标 |

---

## 一、安全评审发现

### CRITICAL (阻塞发布)

#### [SEC-001] 符号链接路径遍历绕过

**位置**: `src/core/boundary/tool-validator.ts:323-339`

**问题**: `path.resolve()` 不解析符号链接，攻击者可创建 symlink 指向任意位置

**攻击方式**:
```bash
ln -s /etc/passwd ./src/data/sensitive.txt
# Read tool 可以读取 /etc/passwd
```

**修复**:
```typescript
import * as fs from 'fs';
const resolvedPath = fs.realpathSync(filePath);
```

#### [SEC-002] 熔断器竞态条件

**位置**: `src/core/boundary/circuit-breaker.ts:89-121`

**问题**: 状态变更非原子操作，并发环境下可绕过安全检查

**修复**: 使用 mutex 或原子操作

### HIGH

| ID | 问题 | 位置 |
|----|------|------|
| SEC-003 | Unicode/编码绕过命令注入检测 | tool-validator.ts:31-90 |
| SEC-004 | 路径规范化不完整 | tool-validator.ts:187-209 |
| SEC-005 | validateOutput 是 Stub | guard.ts:332-351 |
| SEC-006 | Agent 身份可伪造 | guard.ts:216-220 |

### MEDIUM

| ID | 问题 | 位置 |
|----|------|------|
| SEC-007 | YAML 解析器注入风险 | contract.ts:26-78 |
| SEC-008 | 共享熔断器单例可被重置 | circuit-breaker.ts:232-251 |
| SEC-009 | 默认合约回退过于宽松 | contract.ts:130-137 |
| SEC-010 | Glob 模式匹配过于宽松 | tool-validator.ts:194-201 |
| SEC-011 | 安全日志不持久 | guard.ts:462-469 |

---

## 二、架构评审发现

### 缺失的 Agent 合约

| Agent | 状态 | 优先级 |
|-------|------|--------|
| SecurityExpert | 缺失 | P0 |
| ScrumMaster | 缺失 | P1 |

### ADR-ARCH-004 未完成项

| 要求 | 状态 | 说明 |
|------|------|------|
| Schema 版本化 | 未实现 | ADR v2.1 变更 2 |
| Gate 评分语义 | 未实现 | ADR v2.1 变更 5 |
| validateOutput | Stub | 需要 Zod 实现 |

---

## 三、测试覆盖率分析

### 当前状态

```
Overall Coverage: 35.95% (目标 80%)
├── Statements: 35.89%
├── Branches: 24.32%
├── Lines: 35.95%
└── Functions: 38.79%
```

### 关键模块覆盖率

| 模块 | 覆盖率 | 优先级 |
|------|--------|--------|
| commands/ | ~13% | P0 |
| core/spec/ | 5.83% | P0 |
| core/verification/ | 0% | P0 |
| core/phase/gates.ts | 12.12% | P1 |
| core/workflow/base.ts | 0% | P1 |
| agents/ | 71.65% | P2 |
| core/boundary/ | 85.87% | OK |

---

## 四、后续工作清单

### 立即修复 (阻塞发布) - ✅ 已完成 (2026-02-09)

- [x] **SEC-001**: 实现 symlink 解析 (`fs.lstatSync` + `fs.realpathSync`)
  - 文件: `src/core/boundary/tool-validator.ts:325-372`
  - 新增 `symlink-escape-detected` 权限拒绝原因
- [x] **SEC-002**: 添加熔断器状态 mutex (`transitionInProgress` 守卫)
  - 文件: `src/core/boundary/circuit-breaker.ts:49-228`
- [x] **ARCH-001**: 添加 SecurityExpert 合约
  - 文件: `.specbmad/agent-contracts.yaml:118-145`
  - 文件: `src/core/boundary/contract.ts:261-272` (默认合约)
- [x] **TEST-P0**: 添加安全测试用例
  - `tests/unit/boundary/tool-validator.test.ts` - 4个 symlink 测试
  - `tests/unit/boundary/circuit-breaker.test.ts` - 4个竞态测试
  - `tests/unit/boundary/contract.test.ts` - 4个 SecurityExpert 测试

### 短期修复 (2 周内)

- [ ] **SEC-003**: Unicode 规范化命令检测
- [ ] **SEC-005**: 实现 validateOutput (Zod)
- [ ] **SEC-007**: 替换 YAML 解析器为 js-yaml
- [ ] **ARCH-003**: 实现 Schema 版本化验证

### 测试补充

```bash
# P0 测试目标
tests/commands/go.command.test.ts
tests/commands/phase.command.test.ts
tests/core/spec/openspec.test.ts
tests/core/spec/protection.test.ts
tests/core/verification/deepcode.test.ts

# P1 测试目标
tests/core/phase/gates.test.ts
tests/core/workflow/base.test.ts
tests/agents/security-expert.test.ts
```

---

## 五、评审报告文件

| 文件 | 内容 |
|------|------|
| [SECURITY_REVIEW_CLAUDE_2026-02-08.md](SECURITY_REVIEW_CLAUDE_2026-02-08.md) | Claude 功能评审 |
| 本文档 | 综合评审总结 |

---

## 六、恢复上下文指南

在新对话中继续此工作时，请使用以下提示：

```
继续 SpecBmad 代码评审工作。参考: docs/REVIEW_SUMMARY_2026-02-08.md

已完成 (2026-02-09):
1. ✅ SEC-001 symlink 绕过修复 (tool-validator.ts)
2. ✅ SEC-002 熔断器竞态修复 (circuit-breaker.ts)
3. ✅ SecurityExpert 合约添加 (agent-contracts.yaml + contract.ts)
4. ✅ P0 安全测试用例 (12个新测试)
5. ✅ 所有测试通过 (216/216)

待完成:
1. SEC-003: Unicode/编码绕过命令注入检测 (tool-validator.ts:31-90)
2. SEC-005: 实现 validateOutput (guard.ts - 需要 Zod)
3. SEC-007: 替换 YAML 解析器为 js-yaml (contract.ts)
4. 补充 P0 测试: commands/, core/spec/, core/verification/
5. 提高测试覆盖率到 80%
```

---

**评审状态**: CRITICAL 问题已修复
**下一步**: 修复 HIGH 问题 (SEC-003, SEC-005, SEC-007)
