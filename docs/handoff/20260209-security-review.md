# 安全评审与测试覆盖接力文档

**日期**: 2026-02-09
**更新**: 2026-02-10
**创建者**: Claude Opus 4.5
**状态**: ✅ 已完成

---

## 任务概述

继续完成 REVIEW_SUMMARY_2026-02-08.md 中的安全修复和测试覆盖率改进任务。

## 已完成工作

1. ✅ **SEC-003**: Unicode 规范化命令检测修复
   - 修改文件: `src/core/boundary/tool-validator.ts:268-295`
   - 添加 `normalizeForSecurity()` 方法，使用 NFKD 规范化
   - 移除 zero-width 和 bidi 控制字符
   - 测试: 9个新测试全部通过

2. ✅ **SEC-005**: validateOutput Zod 实现
   - 新建文件: `src/core/boundary/schemas/output-schemas.ts`
   - 修改文件: `src/core/boundary/guard.ts:332-378`
   - 实现 5 个 Schema: RequirementsSpec, DesignSpec, CodeArtifacts, QAReport, SecurityReport
   - 测试: 8个新测试全部通过

3. ✅ **P0 测试**: go.command.test.ts
   - 新建文件: `tests/commands/go.command.test.ts`
   - 13个测试用例全部通过
   - 覆盖: 输入验证、目录结构、工作流执行、错误处理、slugify

4. ✅ **上下文接力工作流文档**
   - 修改文件: `CLAUDE.md` (添加"上下文接力工作流"章节)
   - 新建目录: `docs/handoff/`

5. ✅ **P0 测试**: openspec.test.ts (2026-02-10)
   - 新建文件: `tests/core/spec/openspec.test.ts`
   - 23个测试用例全部通过
   - 覆盖: OpenSpecIntegration.execute(), mockOpenSpec(), OpenSpecGateChecker.checkGate()
   - 达成 100% 代码覆盖率 on `src/core/spec/openspec.ts`

6. ✅ **P0 测试**: deepcode.test.ts (2026-02-10)
   - 新建文件: `tests/core/verification/deepcode.test.ts`
   - 20个测试用例全部通过
   - 覆盖: DeepCodeIntegration, DeepCodeGateChecker, VerificationGateChecker
   - 达成 100% 代码覆盖率 on `src/core/verification/deepcode.ts`

7. ✅ **P1 测试验证** (2026-02-10)
   - 全部 288 测试通过
   - type-check 通过
   - lint 通过

8. ✅ **SEC-007 评估**: YAML 解析器替换 (2026-02-10)
   - 详见下方评估报告

---

## SEC-007: YAML 解析器安全评估

### 发现

| 文件 | 问题 | 严重度 |
|------|------|--------|
| `src/core/boundary/contract.ts` | 自定义 YAML 解析器 (lines 26-78)，功能有限且脆弱 | MEDIUM |
| `src/core/bridge/python.ts` | 解析 Python 输出时无 schema 验证 | MEDIUM |
| 其他 6 个文件 | 使用 `yaml` 包但无 safe loading 配置 | LOW |

### 当前状态

- `contract.ts` 使用自定义的简单 YAML 解析器，只支持基本 key-value 和数组
- 其他文件使用 `yaml` 包 v2.3.4，没有配置 schema 验证
- 输入来源主要是本地配置文件，风险可控

### 建议 (延后至未来 Sprint)

1. **替换自定义解析器**: 使用 `js-yaml` + `SAFE_SCHEMA`
2. **添加 Zod 验证**: 对解析后的 YAML 进行 schema 验证
3. **更新 python.ts**: 验证 Python 脚本输出

### 优先级

**MEDIUM** - 当前风险可控（配置文件为本地），但建议在下一个安全增强 Sprint 中处理。

---

## 关键文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/core/boundary/tool-validator.ts` | ✅ 已修改 | SEC-003 Unicode 规范化 |
| `src/core/boundary/guard.ts` | ✅ 已修改 | SEC-005 validateOutput |
| `src/core/boundary/schemas/output-schemas.ts` | ✅ 新建 | Zod 输出 schemas |
| `tests/unit/boundary/tool-validator.test.ts` | ✅ 已修改 | +9 Unicode 测试 |
| `tests/unit/boundary/guard.test.ts` | ✅ 已修改 | +8 validateOutput 测试 |
| `tests/commands/go.command.test.ts` | ✅ 新建 | 13 go 命令测试 |
| `tests/core/spec/openspec.test.ts` | ✅ 新建 | 23 OpenSpec 测试 |
| `tests/core/verification/deepcode.test.ts` | ✅ 新建 | 20 DeepCode 测试 |

## 测试状态

```
当前通过测试: 288
新增测试: 43 (openspec: 23, deepcode: 20)
openspec.ts 覆盖率: 100%
deepcode.ts 覆盖率: 100%
整体覆盖率: ~39% (项目目标 80% 需要更多工作)
```

## 后续工作建议

1. **SEC-007**: 下一个 Sprint 替换 YAML 解析器
2. **测试覆盖率**: 继续提升至 50%+
3. **其他未覆盖模块**: `commands/`, `core/workflow/`, `plugins/`
