# ADR-ARCH-002: Spec Domain vs Execution Domain Boundaries

## Status
**Accepted** (2026-01-30)

## Context

SpecBmad 系统需要明确定义 Spec Domain 和 Execution Domain 之间的边界，以确保：
- 规范（Spec）的权威性和不可篡改性
- 执行逻辑的隔离性
- 跨语言（Python/Node.js）调用的安全性

## Decision

### 1. 域定义

#### Spec Domain (Python)

**组件**:
- `Spec-Kit` - 意图捕获，生成 intent.yaml
- `OpenSpec` - 形式化规范，生成 formal_spec.yaml

**权限**:
- ✅ 创建和修改 Spec 文件
- ✅ 验证规范的形式正确性
- ❌ 调用 Node.js 执行逻辑
- ❌ 生成或修改代码

**文件所有权**:
```
.specbmad/
├── intent.yaml       # Spec-Kit 所有
├── formal_spec.yaml  # OpenSpec 所有
└── spec_schema.json  # OpenSpec 所有
```

#### Execution Domain (Node.js/TypeScript)

**组件**:
- `BMAD-CORE` - 核心执行引擎
- `Role Agents` - 6个专业角色代理
- `Phase Controller` - 状态机控制器
- `Orchestrator` - 工作流编排器

**权限**:
- ✅ 读取 Spec 文件
- ✅ 写入 Code 文件
- ✅ 管理 Phase 状态
- ❌ 修改 Spec 文件

**文件所有权**:
```
.specbmad/
├── phase.state.json     # Phase Controller 所有
├── workflow.state.json  # Orchestrator 所有
└── artifacts/           # Agents 所有
    └── *.md

/code/                   # BMAD-DEV 所有
└── **/*
```

### 2. 调用方向规则（不可逆）

```
┌─────────────────────────────────────────────┐
│                调用方向规则                  │
├─────────────────────────────────────────────┤
│  Node.js → Python     ✅ 允许               │
│  Python → Node.js     ❌ 禁止               │
│                       (唯一例外: 响应回调)   │
├─────────────────────────────────────────────┤
│  Agent → Phase        ❌ 禁止               │
│  Phase → Agent        ✅ 唯一合法路径        │
└─────────────────────────────────────────────┘
```

### 3. 跨域通信实现

使用 Python Bridge 模式：

```typescript
// src/core/bridge/python.ts
export async function callPython(
  script: string,
  args: string[],
  timeout?: number
): Promise<string> {
  // 1. 准备输入文件（临时）
  // 2. 调用 Python 子进程
  // 3. 读取输出文件
  // 4. 返回结果
}
```

**通信协议**:
- 输入: YAML 文件
- 输出: YAML/JSON 文件
- 超时: 可配置（默认60秒）

### 4. 边界保护机制

#### Spec Protection

```typescript
// src/core/spec/protection.ts
export class SpecProtection {
  // 验证调用来源是否为合法的 Spec Domain 组件
  static validateCaller(component: string): boolean;

  // 验证写入操作是否合法
  static validateWrite(path: string, caller: string): boolean;
}
```

#### 禁止的操作

| 操作 | 来源域 | 结果 |
|------|--------|------|
| 修改 formal_spec.yaml | Execution | ❌ 抛出异常 |
| 直接调用 BMAD API | Spec | ❌ 无API暴露 |
| Phase迁移 | Agent | ❌ 权限拒绝 |

## Consequences

### Positive
- 规范不可被执行逻辑污染，保证了系统的正确性基础
- 清晰的职责划分，便于独立开发和测试
- 跨语言调用通过文件交换，解耦彻底

### Negative
- 跨域调用需要文件I/O，有一定性能开销
- 需要维护两套代码库（Python + Node.js）
- 调试跨域问题较为复杂

### Risks
- Python 环境依赖可能导致部署复杂性
- 文件交换格式变更需要同步两边代码

## Implementation Notes

### Python Bridge 使用示例

```typescript
// 调用 Spec-Kit
import { callSpecKit } from '@/core/spec/spec-kit';
const intent = await callSpecKit(naturalLanguageInput);

// 调用 OpenSpec
import { callOpenSpec } from '@/core/spec/openspec';
const formalSpec = await callOpenSpec(intent);

// 调用 DeepCode
import { callDeepCode } from '@/core/verification/deepcode';
const result = await callDeepCode(code, formalSpec);
```

### Mock 支持

当 Python 脚本不存在时，自动降级为 Mock 实现：

```typescript
if (!fs.existsSync(pythonScriptPath)) {
  return mockImplementation(args);
}
```

## References

- [spec_bmad_unified_architecture_v_2_frozen_edition.md](../spec_bmad_unified_architecture_v_2_frozen_edition.md) Section 4, 5
- [src/core/bridge/python.ts](../../src/core/bridge/python.ts)
- [src/core/spec/protection.ts](../../src/core/spec/protection.ts)
