# ADR-ARCH-001: Target Architecture Pattern

## Status
**Accepted** (2026-01-30)

## Context

SpecBmad 需要一个清晰的目标架构模式来指导系统设计和实现。该架构必须支持：
- AI驱动的软件开发工作流
- 规格驱动开发(Spec-Driven Development)
- 多Agent协作
- 严格的Phase状态控制

## Decision

采用 **Phase-Gated Domain-Separated Architecture** 作为目标架构模式：

### 1. Phase-Gated 状态机

系统采用6阶段状态机控制所有工作流：

| Phase | 名称 | 负责人 | 输出 |
|-------|------|--------|------|
| 0 | Intent Capture | Spec-Kit | intent.yaml |
| 1 | Formal Specification | OpenSpec | formal_spec.yaml |
| 2 | Architecture & Planning | BMAD PM/Architect | architecture.md, plan.yaml |
| 3 | Implementation | BMAD-DEV + DeepCode | /code |
| 4 | Verification | OpenSpec + DeepCode | verification_report.md |
| 5 | Iteration/Evolution | Phase Controller | 回退到Phase 1/3 |

### 2. Domain Separation

系统划分为三个不可混淆的域：

```
┌─────────────────────────────────────┐
│         Spec Domain (Python)        │
│  Spec-Kit, OpenSpec                 │
│  拥有 Spec 主权，禁止调用 Node 逻辑 │
├─────────────────────────────────────┤
│      Execution Domain (Node.js)     │
│  BMAD-CORE, Role Agents             │
│  只读 Spec，只写 Code               │
├─────────────────────────────────────┤
│      Intelligence Domain            │
│  DeepCode, LLM Gateway              │
│  裁判与推理，不是决策者             │
└─────────────────────────────────────┘
```

### 3. Gate System

每个Phase迁移由Gate守护：
- **功能Gate**: OpenSpec校验、DeepCode校验（阻塞性）
- **稳定性Gate**: Event Store可用性（可降级）
- **性能Gate**: LLM P95延迟（仅记录）

Gate优先级: 功能 > 稳定性 > 性能

### 4. 权力结构

| 组件 | 推进Phase | 阻断Phase | 修改Spec | 修改Code |
|------|-----------|-----------|----------|----------|
| Phase Controller | ✅ | ✅ | ❌ | ❌ |
| OpenSpec | ❌ | ✅ | ✅ | ❌ |
| DeepCode | ❌ | ✅(P3/P4) | ❌ | ❌ |
| BMAD Agent | ❌ | ❌ | ❌ | ✅ |
| CLI/UI | ❌ | ❌ | ❌ | ❌ |

## Consequences

### Positive
- 清晰的职责边界，便于维护和扩展
- 强制规范先行，提高代码质量
- Gate机制保证每个阶段的交付物质量
- 支持回退和迭代

### Negative
- 实现复杂度较高
- 需要维护Python和Node.js两个运行时
- Phase迁移有一定开销

### Risks
- Python桥接可能引入跨进程通信延迟
- Gate检查失败时的回退逻辑需要充分测试

## References

- [spec_bmad_unified_architecture_v_2_frozen_edition.md](../spec_bmad_unified_architecture_v_2_frozen_edition.md) Section 1-6
- [ARCHITECTURE.md](../ARCHITECTURE.md)
