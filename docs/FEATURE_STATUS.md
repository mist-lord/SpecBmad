# SpecBmad 功能清单与架构图

> 生成日期: 2026-01-30
> 版本: 0.1.0

---

## 架构图 (Canvas)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              SpecBmad Architecture                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Interaction Layer                                │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │ │
│  │  │  Unified    │    │   Web UI    │    │   IDE       │                  │ │
│  │  │    CLI      │    │  Dashboard  │    │  Export     │                  │ │
│  │  │  (26 cmds)  │    │  (40% done) │    │  (Cursor/   │                  │ │
│  │  │     ✅      │    │     🟡      │    │   Cline)✅  │                  │ │
│  │  └──────┬──────┘    └──────┬──────┘    └─────────────┘                  │ │
│  └─────────┼─────────────────┼──────────────────────────────────────────────┘ │
│            │                 │                                                │
│            ▼                 ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Runtime Layer                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │ │
│  │  │                    Phase Controller (0-5) ✅                     │    │ │
│  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │    │ │
│  │  │  │  0  │→│  1  │→│  2  │→│  3  │→│  4  │→│  5  │               │    │ │
│  │  │  │Intent│ │Spec │ │Arch │ │Impl │ │Verify│ │Iter │               │    │ │
│  │  │  └─────┘ └──┬──┘ └─────┘ └──┬──┘ └──┬──┘ └─────┘               │    │ │
│  │  │             │               │       │                           │    │ │
│  │  │        ┌────▼────┐    ┌────▼────┐  │                           │    │ │
│  │  │        │OpenSpec │    │DeepCode │◄─┘                           │    │ │
│  │  │        │ Gate ✅ │    │ Gate ✅ │                               │    │ │
│  │  │        └─────────┘    └─────────┘                               │    │ │
│  │  └─────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                          │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                │ │
│  │  │  Orchestrator │  │ State Manager │  │  Event Store  │                │ │
│  │  │      ✅       │  │      ✅       │  │      ✅       │                │ │
│  │  └───────────────┘  └───────────────┘  └───────────────┘                │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Agent Layer                                      │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │ │
│  │  │ Analyst  │ │Architect │ │Developer │ │    QA    │ │  Scrum   │      │ │
│  │  │    ✅    │ │    ✅    │ │    ✅    │ │    ✅    │ │ Master ✅│      │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │ │
│  │                                                                          │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐   │ │
│  │  │                    Security Expert ✅                             │   │ │
│  │  └──────────────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Intelligence Layer                               │ │
│  │  ┌───────────────────────────────┐  ┌───────────────────────────────┐   │ │
│  │  │         LLM Manager           │  │        Python Bridge          │   │ │
│  │  │  ┌───────┐ ┌───────┐ ┌─────┐ │  │  ┌─────────┐ ┌──────────┐    │   │ │
│  │  │  │Claude │ │OpenAI │ │Mock │ │  │  │Spec-Kit │ │ OpenSpec │    │   │ │
│  │  │  │  ✅   │ │  ✅   │ │ ✅  │ │  │  │   ✅    │ │    ✅    │    │   │ │
│  │  │  └───────┘ └───────┘ └─────┘ │  │  └─────────┘ └──────────┘    │   │ │
│  │  │                               │  │                              │   │ │
│  │  │  P95监控 ✅  缓存 ✅  并发 ✅ │  │  DeepCode ✅                  │   │ │
│  │  └───────────────────────────────┘  └───────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Infrastructure Layer                             │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │ │
│  │  │  Logger   │ │  Config   │ │   Path    │ │   Perf    │ │  Plugin   │ │ │
│  │  │    ✅     │ │    ✅     │ │    ✅     │ │    ✅     │ │    🟡     │ │ │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

图例: ✅ 已实现  🟡 部分实现  ❌ 未实现
```

---

## 功能清单

### 一、核心编排层

| 功能 | 状态 | 文件路径 | 说明 |
|------|------|----------|------|
| Phase Controller | ✅ 已实现 | `src/core/phase/controller.ts` | Phase 0-5 状态机，含失败回退 |
| Phase Transitions | ✅ 已实现 | `spec/phase_transitions.yaml` | YAML配置驱动 |
| Workflow Orchestrator | ✅ 已实现 | `src/core/workflow/orchestrator.ts` | 支持V1链式和V2 Phase驱动 |
| Workflow Manager | ✅ 已实现 | `src/core/workflow/manager.ts` | 工作流注册与管理 |
| Event Store | ✅ 已实现 | `src/core/events/store.ts` | 事件持久化与查询 |
| State Manager | ✅ 已实现 | `.bmad/workflow.state.json` | 工作流状态持久化 (注：旧版使用 `.specbmad/`) |

### 二、Gate 系统 (4-Phase MVP 简化)

| 功能 | 状态 | 文件路径 | 说明 |
|------|------|----------|------|
| Gate Registry | ✅ 已实现 | `src/core/phase/gates.ts` | Gate检查器注册表 |
| Review Gate | ✅ 已实现 | `src/core/phase/gates.ts` | QA 验收 Gate (Phase 3) |
| ~~OpenSpec Gate~~ | ⛔ 已废弃 | `src/core/spec/openspec.ts` | 4-Phase MVP 不再使用 |
| ~~DeepCode Gate~~ | ⛔ 已废弃 | `src/core/verification/deepcode.ts` | 4-Phase MVP 不再使用 |
| ~~Performance Gate~~ | ⛔ 已删除 | - | 4-Phase MVP 删除 |
| ~~Stability Gate~~ | ⛔ 已删除 | - | 4-Phase MVP 删除 |

### 三、Agent 系统

| Agent | 状态 | 文件路径 | 能力 |
|-------|------|----------|------|
| Base Agent | ✅ 已实现 | `src/agents/base/agent.ts` | 缓存、重试、性能指标 |
| Agent Factory | ✅ 已实现 | `src/agents/factory.ts` | 动态创建Agent |
| Analyst | ✅ 已实现 | `src/agents/analyst.ts` | 需求分析、任务拆解 |
| Architect | ✅ 已实现 | `src/agents/architect.ts` | 架构设计、技术选型 |
| Developer | ✅ 已实现 | `src/agents/developer.ts` | 代码实现 |
| QA | ✅ 已实现 | `src/agents/qa.ts` | 测试设计、质量检查 |
| Scrum Master | ✅ 已实现 | `src/agents/scrum-master.ts` | 任务协调 |
| Security Expert | ✅ 已实现 | `src/agents/security-expert.ts` | 安全审计 |

### 四、LLM 集成

| 功能 | 状态 | 文件路径 | 说明 |
|------|------|----------|------|
| LLM Manager | ✅ 已实现 | `src/core/llm/manager.ts` | 多客户端管理 |
| Claude Client | ✅ 已实现 | `src/core/llm/clients/claude.ts` | Anthropic API |
| OpenAI Client | ✅ 已实现 | `src/core/llm/clients/openai.ts` | OpenAI API |
| Mock Client | ✅ 已实现 | `src/core/llm/clients/mock.ts` | 离线测试支持 |
| LLM Cache | ✅ 已实现 | `src/core/llm/cache.ts` | 响应缓存 |
| LLM Concurrency | ✅ 已实现 | `src/core/llm/concurrency.ts` | 并发控制+P95监控 |

### 五、规范系统 (Python Bridge)

| 功能 | 状态 | 文件路径 | 说明 |
|------|------|----------|------|
| Python Bridge | ✅ 已实现 | `src/core/bridge/python.ts` | 跨语言调用 |
| Spec-Kit | ✅ 已实现 | `src/core/spec/spec-kit.ts` | 意图捕获 |
| OpenSpec | ✅ 已实现 | `src/core/spec/openspec.ts` | 形式化规范 |
| DeepCode | ✅ 已实现 | `src/core/verification/deepcode.ts` | 代码验证 |
| Spec Protection | ✅ 已实现 | `src/core/spec/protection.ts` | 规范保护 |

### 六、CLI 命令 (26个)

| 命令 | 状态 | 文件路径 | 功能 |
|------|------|----------|------|
| init | ✅ 已实现 | `src/commands/init.ts` | 初始化项目 |
| config | ✅ 已实现 | `src/commands/config.ts` | 配置管理 |
| status | ✅ 已实现 | `src/commands/status.ts` | 项目状态 |
| specify | ✅ 已实现 | `src/commands/specify.ts` | 生成规格文档 |
| tasks | ✅ 已实现 | `src/commands/tasks.ts` | 任务拆解 |
| analyze | ✅ 已实现 | `src/commands/analyze.ts` | 需求分析 |
| plan | ✅ 已实现 | `src/commands/plan.ts` | 实施计划 |
| implement | ✅ 已实现 | `src/commands/implement.ts` | 代码实现 |
| qa | ✅ 已实现 | `src/commands/qa.ts` | 质量保障 |
| deploy | ✅ 已实现 | `src/commands/deploy.ts` | 部署发布 |
| workflow | ✅ 已实现 | `src/commands/workflow.ts` | 工作流执行 |
| go | ✅ 已实现 | `src/commands/go.ts` | 一键生成 |
| export | ✅ 已实现 | `src/commands/export.ts` | IDE规则导出 |
| report | ✅ 已实现 | `src/commands/report.ts` | 生成报告 |
| phase | ✅ 已实现 | `src/commands/phase.ts` | Phase管理 |
| doctor | ✅ 已实现 | `src/commands/doctor/index.ts` | 系统诊断 |
| generate | ✅ 已实现 | `src/commands/generate.ts` | 代码生成 |
| run | ✅ 已实现 | `src/commands/run.ts` | 运行步骤 |
| quick | ✅ 已实现 | `src/commands/quick.ts` | 快速执行 |
| solution | ✅ 已实现 | `src/commands/solution.ts` | 解决方案 |
| bmm | ✅ 已实现 | `src/commands/bmm.ts` | 业务模型 |
| agents | ✅ 已实现 | `src/commands/agents.ts` | Agent管理 |
| plugins | ✅ 已实现 | `src/commands/plugins.ts` | 插件管理 |
| constitution | ✅ 已实现 | `src/commands/constitution.ts` | 项目宪章 |
| change | ✅ 已实现 | `src/commands/change/index.ts` | 变更管理 |
| ui | ✅ 已实现 | `src/commands/ui/index.ts` | Web UI |

### 七、代码生成

| 功能 | 状态 | 文件路径 | 说明 |
|------|------|----------|------|
| Template System | ✅ 已实现 | `src/generator/index.ts` | 模板引擎 |
| TypeScript App | ✅ 已实现 | `src/generator/templates/ts-app/` | TS应用模板 |
| TypeScript API | ✅ 已实现 | `src/generator/templates/ts-api/` | TS API模板 |
| TypeScript CLI | ✅ 已实现 | `src/generator/templates/ts-cli/` | TS CLI模板 |
| Python CLI | ✅ 已实现 | `src/generator/templates/py-cli/` | Python CLI模板 |
| Python Lib | ✅ 已实现 | `src/generator/templates/py-lib/` | Python库模板 |
| C++ CLI | ✅ 已实现 | `src/generator/templates/cpp-cli/` | C++ CLI模板 |
| TypeScript Chat | ✅ 已实现 | `src/generator/templates/ts-chat/` | TS对话应用模板 |

### 八、基础设施

| 功能 | 状态 | 文件路径 | 说明 |
|------|------|----------|------|
| Logger | ✅ 已实现 | `src/utils/logger.ts` | Winston日志 |
| Config Manager | ✅ 已实现 | `src/utils/config.ts` | 配置管理 |
| Config Validator | ✅ 已实现 | `src/utils/config-validator.ts` | Zod验证 |
| Config Migrator | ✅ 已实现 | `src/utils/config-migrator.ts` | 配置迁移 |
| Path Manager | ✅ 已实现 | `src/utils/paths.ts` | 路径常量 |
| Perf Tracker | ✅ 已实现 | `src/utils/perf.ts` | 性能追踪 |
| Error Handler | ✅ 已实现 | `src/utils/error.ts` | 错误处理 |
| Auto Init | ✅ 已实现 | `src/utils/auto-init.ts` | 自动初始化 |

### 九、插件系统

| 功能 | 状态 | 文件路径 | 说明 |
|------|------|----------|------|
| Plugin Manager | ✅ 已实现 | `src/core/plugin/manager.ts` | 插件管理器 |
| Plugin Base | ✅ 已实现 | `src/core/plugin/base.ts` | 插件基类 |
| Artifacts Indexer | ✅ 已实现 | `src/plugins/artifacts-indexer.ts` | 工件索引 |
| Stack TypeScript | ✅ 已实现 | `src/plugins/stack-typescript/` | TS技术栈 |
| Stack Python | ✅ 已实现 | `src/plugins/stack-python/` | Python技术栈 |
| Stack C++ | ✅ 已实现 | `src/plugins/stack-cpp/` | C++技术栈 |
| 示例插件 | ❌ 未实现 | - | 缺少示例Gate/Agent插件 |

### 十、Web UI

| 功能 | 状态 | 文件路径 | 说明 |
|------|------|----------|------|
| Express Server | ✅ 已实现 | `src/ui/server/app.ts` | 后端服务 |
| API Routes | ✅ 已实现 | `src/ui/server/routes/` | REST API |
| Dashboard Page | ✅ 已实现 | `ui/src/pages/Dashboard.tsx` | 仪表盘 |
| Changes Page | ✅ 已实现 | `ui/src/pages/Changes.tsx` | 变更页面 |
| Workflow Page | ❌ 未实现 | - | 工作流可视化 |
| Agents Page | ❌ 未实现 | - | Agent管理 |
| Files Page | ❌ 未实现 | - | 文件浏览 |
| Phase Viewer | ❌ 未实现 | - | Phase状态组件 |
| Event Timeline | ❌ 未实现 | - | 事件时间线 |

### 十一、变更管理

| 功能 | 状态 | 文件路径 | 说明 |
|------|------|----------|------|
| Change Manager | ✅ 已实现 | `src/core/change/manager.ts` | 变更管理器 |
| Change Types | ✅ 已实现 | `src/core/change/types.ts` | 类型定义 |
| 提案创建 | ✅ 已实现 | CLI: `change create` | 创建变更提案 |
| 提案列表 | ✅ 已实现 | CLI: `change list` | 列出提案 |
| 审批工作流 | 🟡 部分实现 | - | 需完善生命周期 |
| 冲突检测 | ❌ 未实现 | - | 待实现 |
| 提案回滚 | ❌ 未实现 | - | 待实现 |

### 十二、文档

| 文档 | 状态 | 文件路径 |
|------|------|----------|
| 架构文档 | ✅ 已完成 | `docs/ARCHITECTURE.md` |
| 冻结版架构 | ✅ 已完成 | `docs/spec_bmad_unified_architecture_v_2_frozen_edition.md` |
| 用户手册 | ✅ 已完成 | `docs/用户使用手册.md` |
| 技术规范 | ✅ 已完成 | `docs/技术规范与架构设计.md` |
| 测试策略 | ✅ 已完成 | `docs/测试策略与质量保证.md` |
| ADR-001 | ✅ 已完成 | `docs/adr/ADR-ARCH-001-target-architecture-pattern.md` |
| ADR-002 | ✅ 已完成 | `docs/adr/ADR-ARCH-002-domain-boundaries.md` |
| ADR-003 | ✅ 已完成 | `docs/adr/ADR-ARCH-003-phase-controller-gates.md` |

---

## 统计汇总

| 分类 | 已实现 | 部分实现 | 未实现 | 完成率 |
|------|--------|----------|--------|--------|
| 核心编排 | 6 | 0 | 0 | 100% |
| Gate系统 | 6 | 0 | 0 | 100% |
| Agent系统 | 8 | 0 | 0 | 100% |
| LLM集成 | 6 | 0 | 0 | 100% |
| 规范系统 | 5 | 0 | 0 | 100% |
| CLI命令 | 26 | 0 | 0 | 100% |
| 代码生成 | 8 | 0 | 0 | 100% |
| 基础设施 | 8 | 0 | 0 | 100% |
| 插件系统 | 6 | 0 | 1 | 86% |
| Web UI | 4 | 0 | 5 | 44% |
| 变更管理 | 4 | 1 | 2 | 64% |
| 文档 | 8 | 0 | 0 | 100% |
| **总计** | **95** | **1** | **8** | **90%** |

---

## 测试覆盖

| 测试类型 | 数量 | 状态 |
|----------|------|------|
| 单元测试 | 87 | ✅ 全部通过 |
| 集成测试 | 8 | ✅ 全部通过 |
| E2E测试 | 2 | ✅ 全部通过 |

---

## 下一步工作

### P0 (必须完成)
- [x] 修复controller测试
- [x] Gate单元测试
- [x] ADR文档

### P1 (高优先级)
- [x] Python桥接proposal参数
- [x] LLM P95监控接入

### P2 (中优先级)
- [ ] Web UI前端页面 (Workflow/Agents/Files)
- [ ] 示例插件 (Gate/Agent)
- [ ] 变更管理完善 (审批/冲突/回滚)
