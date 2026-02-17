# ADR-ARCH-003: Phase Controller & Gate Rules

## Status
**Accepted** (2026-01-30)

## Context

SpecBmad 系统需要一个强约束的状态机来控制开发工作流的各个阶段，并通过 Gate 机制确保每个阶段的交付物质量。

## Decision

### 1. Phase Controller 设计

#### 核心职责

Phase Controller 是系统的最高权力机构，拥有：
- ✅ 推进 Phase 的唯一权力
- ✅ 阻断 Phase 的权力
- ❌ 不可修改 Spec
- ❌ 不可修改 Code

#### 状态机定义

```yaml
# spec/phase_transitions.yaml
phases:
  0:  # Intent Capture
    next: [1]
    gates: []
  1:  # Formal Specification
    next: [2]
    gates: [openspec_passed]
  2:  # Architecture & Planning
    next: [3]
    gates: []
  3:  # Implementation
    next: [4]
    gates: [deepcode_passed, performance_warning, stability_check]
  4:  # Verification
    next: [5]
    gates: [verification_passed]
  5:  # Iteration/Evolution
    next: [1, 3]  # 支持回退
    gates: []
```

#### Phase Controller API

```typescript
// src/core/phase/controller.ts
export class PhaseController {
  // 获取当前 Phase
  getCurrentPhase(): PhaseNumber;

  // 检查是否可以迁移到目标 Phase
  canTransitionTo(targetPhase: PhaseNumber): boolean;

  // 检查指定 Phase 的所有 Gate
  checkGates(phase: PhaseNumber, context: PhaseContext): Promise<GateResult[]>;

  // 执行 Phase 迁移
  transitionTo(targetPhase: PhaseNumber, context: PhaseContext): Promise<PhaseResult>;
}
```

### 2. Gate System 设计

#### Gate 分类与优先级

| Gate类型 | 优先级 | 失败行为 | 示例 |
|----------|--------|----------|------|
| 功能Gate | 高 | 阻断迁移，自动回退 | openspec_passed, deepcode_passed |
| 稳定性Gate | 中 | 可降级，必须记录 | stability_check |
| 性能Gate | 低 | 仅记录，不阻塞 | performance_warning |

#### Gate Registry

```typescript
// src/core/phase/gates.ts
export interface GateChecker {
  checkGate(gateId: string, context: GateCheckContext): Promise<GateResult>;
}

export const gateRegistry = new Map<string, GateChecker>();

// 注册默认 Gate
export function registerDefaultGates(): void {
  gateRegistry.set('openspec_passed', new OpenSpecGateChecker());
  gateRegistry.set('deepcode_passed', new DeepCodeGateChecker());
  gateRegistry.set('verification_passed', new VerificationGateChecker());
  gateRegistry.set('performance_warning', new PerformanceGateAdapter());
  gateRegistry.set('stability_check', new StabilityGateAdapter());
}
```

#### Gate 检查结果

```typescript
export interface GateResult {
  gateId: string;
  passed: boolean;
  blocking: boolean;  // 是否阻塞 Phase 迁移
  message: string;
  details?: Record<string, unknown>;
}
```

### 3. 失败模式与恢复策略

#### 失败模式矩阵

| Gate | 失败时行为 | 回退目标 |
|------|-----------|----------|
| openspec_passed | 阻断 + 回退 | Phase 0 或 1 |
| deepcode_passed | 阻断 + 固定回退 | Phase 3 |
| verification_passed | 阻断 + 回退 | Phase 3 |
| stability_check | 降级 + 记录 | 无回退 |
| performance_warning | 仅记录 | 无回退 |

#### 回退逻辑实现

```typescript
// src/core/phase/controller.ts
private async handleGateFailure(
  gateId: string,
  context: PhaseContext
): Promise<PhaseNumber> {
  // OpenSpec 失败：回退到 Phase 0 或 1
  if (gateId === 'openspec_passed') {
    return context.currentPhase > 1 ? 1 : 0;
  }

  // DeepCode 失败：固定回退到 Phase 3
  if (gateId === 'deepcode_passed') {
    return 3;
  }

  // 其他功能 Gate：回退到上一个 Phase
  return Math.max(0, context.currentPhase - 1);
}
```

### 4. Event Store 集成

所有 Phase 迁移和 Gate 检查都记录到 Event Store：

```typescript
interface PhaseEvent {
  type: 'phase_transition' | 'gate_check';
  timestamp: string;
  fromPhase?: PhaseNumber;
  toPhase?: PhaseNumber;
  gateId?: string;
  status: 'passed' | 'failed';
  message?: string;
  details?: Record<string, unknown>;
}
```

### 5. 非功能 Gate 实现

#### Performance Gate

```typescript
// src/core/phase/gates/performance-gate.ts
export class PerformanceGateChecker {
  async checkPerformanceGate(context: PerformanceGateContext): Promise<PerformanceGateResult> {
    const { llmP95Latency = 0, llmP95Threshold = 5000 } = context;
    const passed = llmP95Latency <= llmP95Threshold;

    return {
      gateId: 'performance_warning',
      passed,
      blocking: false,  // 永不阻塞
      message: passed ? '性能正常' : `P95延迟超阈值: ${llmP95Latency}ms`,
    };
  }
}
```

#### Stability Gate

```typescript
export class StabilityGateChecker {
  async checkStabilityGate(context: PerformanceGateContext): Promise<PerformanceGateResult> {
    const issues = [];

    if (!context.eventStoreAvailable) {
      issues.push('Event Store 不可用');
    }

    if (context.peakActiveRequests / context.concurrencyLimit > 0.9) {
      issues.push('并发压力过高');
    }

    return {
      gateId: 'stability_check',
      passed: issues.length === 0,
      blocking: false,  // 支持降级
      message: issues.length ? issues.join('; ') : '稳定性检查通过',
      details: { canDegrade: true }
    };
  }
}
```

## Consequences

### Positive
- Phase 状态严格受控，不可被绕过
- Gate 机制确保交付物质量
- 完整的事件记录支持审计和回放
- 非功能 Gate 提供系统健康度监控

### Negative
- Gate 检查增加了工作流执行时间
- 回退逻辑复杂，需要充分测试

### Risks
- Gate 检查依赖外部组件（Python/LLM），可能引入不确定性
- 并发执行时的状态一致性需要保证

## Implementation Checklist

- [x] PhaseController 实现
- [x] Gate Registry 实现
- [x] OpenSpec Gate Checker
- [x] DeepCode Gate Checker
- [x] Performance Gate Checker
- [x] Stability Gate Checker
- [x] Event Store 集成
- [x] 失败回退逻辑
- [x] 单元测试覆盖

## References

- [spec_bmad_unified_architecture_v_2_frozen_edition.md](../spec_bmad_unified_architecture_v_2_frozen_edition.md) Section 2, 3, 6.1.9-6.1.12
- [src/core/phase/controller.ts](../../src/core/phase/controller.ts)
- [src/core/phase/gates.ts](../../src/core/phase/gates.ts)
- [src/core/phase/gates/performance-gate.ts](../../src/core/phase/gates/performance-gate.ts)
- [spec/phase_transitions.yaml](../../spec/phase_transitions.yaml)
