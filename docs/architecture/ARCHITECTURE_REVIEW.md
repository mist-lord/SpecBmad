# SpecBmad V2 Architecture Review

> **评审日期**: 2026-02-01
> **评审者**: Architect Agent
> **状态**: Completed

---

## 执行摘要

SpecBmad V2 架构提出从当前 4-Phase MVP 演进到 5-Phase "边界驱动规范驱动开发" 平台。架构引入了 Agent 合约、边界守卫和追溯矩阵等复杂概念。虽然愿景引人注目，但在实施前有几个领域需要改进。

**总体评估**: 架构方向正确，但需要为实际实施进行精简。建议先聚焦 MVP 子集（Gates + 基础 Contracts + 追溯）再添加高级功能。

---

## 1. 优势

### 1.1 清晰的 Phase Pipeline

5-Phase 流水线提供了良好的关注点分离：

| Phase | 名称 | 职责 |
|-------|------|------|
| 0 | Capture | 自然语言 → 结构化意图 |
| 1 | Formalize | 意图 → EARS 格式需求 |
| 2 | Design | 需求 → 带追溯的架构 |
| 3 | Build | 设计 → 带测试的代码 |
| 4 | Review | 验证和签字 |

### 1.2 EARS 语法

选择 EARS (Easy Approach to Requirements Syntax) 用于形式化需求是优秀的决定：
- 可测试、无歧义的需求
- 机器可解析的结构
- 行业标准方法

### 1.3 追溯矩阵

`trace.yaml` 概念确保从需求到实现的完整追溯，解决了大多数开发流程中的关键空白。

### 1.4 Agent 合约系统

基于合约的边界定义考虑周全，防止 Agent 越权。

### 1.5 Gate 系统设计

四个 Gate 配合可配置检查，在关键节点提供质量保证。

---

## 2. 弱点和风险

### 2.1 Claude Agent SDK 依赖 ⚠️ 高风险

| 问题 | 说明 |
|------|------|
| SDK 成熟度 | Claude Agent SDK 相对较新，可能有破坏性变更 |
| 语言混淆 | 文档展示 Python 示例但代码库是 TypeScript |
| 无降级策略 | SDK 不可用时没有备选方案 |

**建议**: 构建抽象层，支持回退到直接 API 调用。

### 2.2 性能开销 ⚠️ 中高风险

每个工具调用经过：
1. PreToolUse hook (权限检查)
2. 实际工具执行
3. PostToolUse hook (输出验证)

典型 Agent 会话有 50+ 工具调用，这会增加显著延迟。

**建议**: 实现缓存；按项目可选启用 hooks。

### 2.3 100% 覆盖率要求 ⚠️ 中风险

强制要求可能不切实际：
- 某些需求可能故意推迟
- 探索性工作可能不映射到需求
- 严格执行可能鼓励数据造假

**建议**: 使阈值按项目可配置。

### 2.4 双语言混淆

文档混合 Python 和 TypeScript，但现有代码库完全是 TypeScript。

**建议**: 统一为 TypeScript。

### 2.5 缺少错误恢复

未充分说明：
- Gate 失败后怎么办？
- 如何回滚到前一阶段？
- 如何处理部分完成？

---

## 3. 缺失组件

| 组件 | 说明 |
|------|------|
| **状态持久化策略** | 如何从失败恢复、状态同步、冲突解决 |
| **人机交互集成** | 如何请求人工审核、通知机制、审批 UI |
| **测试策略** | 如何测试 BoundaryGuard、Gate 检查器 |
| **版本和迁移** | 合约版本化、从 4-Phase 迁移路径 |
| **可观测性** | 指标收集、分布式追踪、告警 |
| **安全模型** | Agent 身份认证、审计日志防篡改 |

---

## 4. 过度工程担忧

### 4.1 独立 SDK 包

提议创建三个独立包可能是过早模块化。

**建议**: 从单一包开始，有明确外部消费需求时再拆分。

### 4.2 YAML 配置激增

架构引入过多配置文件，增加认知负担。

**建议**: 整合为更少的文件：
```
.specbmad/
  config.yaml       # 所有配置
  spec.yaml         # 所有规范数据
  trace.yaml        # 仅追溯
```

### 4.3 LLM 增强一切

LLM 增强会增加成本、延迟，可能产生不一致结果。

**建议**: 使 LLM 增强可选，在扩展前测量 ROI。

---

## 5. 实施挑战

| 挑战 | 说明 | 建议 |
|------|------|------|
| **Semgrep 集成** | 需要安装二进制，跨平台行为不同 | 可选，优雅降级 |
| **孤儿组件检测** | "组件" 定义因语言而异 | 按语言栈明确定义 |
| **实时边界执行** | Hook 执行延迟、网络故障、竞态条件 | 实现熔断器模式 |
| **EARS 验证正则** | 简单正则可能误报 | 使用 NLP 或 LLM 语义验证 |

---

## 6. 替代方案

### 6.1 MCP 直接使用 vs 自定义 Agent SDK

现有 `packages/mcp-gate/` 已提供 MCP 集成，扩展它而不是创建新抽象层。

**优势**: 与任何 MCP 兼容客户端工作，实现更简单，生态兼容性更好。

### 6.2 数据库追溯 vs 文件追溯

使用 GraphQL API 的数据库支持追溯。

**优势**: 可查询关系，更易可视化，支持跨项目追溯。

### 6.3 质量信号 vs 阻塞 Gate

异步质量信号配合可配置阈值，非阻塞开发流程。

### 6.4 ESLint vs 完整 Semgrep

对 TypeScript 项目，利用 TypeScript 编译器和 ESLint。

**优势**: 执行更快，TypeScript 集成更好，无外部二进制依赖。

---

## 7. 待澄清问题

1. **Subagent 继承**: Subagent 是否继承父 Agent 的边界限制？预期行为是什么？

2. **冲突解决**: 两个需求冲突时，解决流程是什么？

3. **增量采用**: 团队能否增量采用 V2（如仅用 Gates 不用 Contracts）？

4. **多项目追溯**: 追溯如何跨 monorepo 包或多仓库工作？

5. **Agent 内存**: 现有 `BaseAgent` 的 `AgentMemory` 如何与 Contract 系统集成？

6. **CI/CD 集成**: Gates 如何与现有 CI 流水线集成？

7. **成本追踪**: LLM 增强分析的成本如何按项目追踪和预算？

8. **离线模式**: 系统能否在无 API 访问的敏感代码库中工作？

---

## 8. 建议

### 8.1 立即行动（实施前）

| 行动 | 优先级 |
|------|--------|
| 统一为 TypeScript | P0 |
| 定义 MVP 子集 | P0 |
| Claude Agent SDK 评估 spike | P0 |

### 8.2 架构变更

1. **合并 Phase 0 和 1**: "Capture" 和 "Formalize" 可作为单一阶段的两个子步骤

2. **Gate 可配置**:
   ```yaml
   gates:
     spec_valid:
       enabled: true
       blocking: false  # 允许覆盖
       checks:
         - ears_format
         - coverage: 80  # 不是 100%
   ```

3. **添加熔断器**:
   ```typescript
   if (this.circuitBreaker.isOpen()) {
     return {}; // 失败开放，记录警告
   }
   ```

4. **引入质量分数替代二元 Gate**:
   ```typescript
   interface PhaseResult {
     qualityScore: number; // 0-100
     passed: boolean;      // score >= threshold
   }
   ```

### 8.3 推荐实施策略

| 阶段 | 周数 | 内容 |
|------|------|------|
| Phase 1 | 1-2 | 核心基础设施：SpecValidator、GateSystem、5-Phase 迁移 |
| Phase 2 | 3-4 | 边界系统：AgentContract、BoundaryGuard、违规日志 |
| Phase 3 | 5-6 | 追溯：TraceabilityMatrix、孤儿检测、覆盖率计算 |
| Phase 4 | 7-8 | 集成：可选 Semgrep、可选 LLM 增强、E2E 测试 |
| Buffer | 9-10 | 文档完善、边缘情况处理 |

### 8.4 风险缓解

| 风险 | 缓解措施 |
|------|----------|
| Claude Agent SDK 不稳定 | 构建抽象层；支持回退到直接 API |
| 性能开销 | 实现缓存；按项目可选 hooks |
| 100% 覆盖不现实 | 使阈值按项目可配置 |
| Semgrep 可用性 | 可选；提供 ESLint 回退 |

---

## 结论

SpecBmad V2 架构为边界驱动、规范驱动开发呈现了全面愿景。核心概念——EARS 需求、追溯矩阵、Agent 合约、基于 Gate 的质量控制——是合理的，解决了 AI 辅助开发中的真实问题。

**改进方向**:
1. **简化**: 更少配置文件，可选 LLM 增强
2. **灵活性**: 可配置阈值，非阻塞 Gate
3. **务实**: 分阶段实施，降级策略
4. **一致性**: 单一语言 (TypeScript)，统一 SDK 方法

**推荐时间线**: 10-12 周（原提议 8 周过于激进）

**MVP 聚焦**: Gates + 基础 Contracts + 追溯
