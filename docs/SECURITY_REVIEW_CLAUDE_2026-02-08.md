# SpecBmad 安全功能评审报告 (Claude)

**评审日期**: 2026-02-08
**评审者**: Claude Opus 4.5
**评审范围**: BoundaryGuard 安全模块
**文档参考**: ADR-ARCH-004 v2.1

---

## 执行摘要

对 SpecBmad 的 BoundaryGuard 安全模块进行了全面的安全功能评审。整体评价：**安全实现良好**，但存在若干需要关注的问题。

| 评估维度 | 评分 | 说明 |
|---------|------|------|
| Fail-Closed 实现 | A | 默认拒绝，未知 Agent/Tool 被阻止 |
| TOCTOU 防护 | A | deepFreeze + JSON 序列化 |
| 熔断器机制 | A | 3 状态正确实现 |
| 危险命令检测 | B+ | 90+ 模式，但有改进空间 |
| Agent 合约 | B- | 缺少 SecurityExpert/ScrumMaster |
| Schema 版本化 | F | ADR v2.1 变更 2 未实现 |

---

## 1. BoundaryGuard Fail-Closed 评审

### 1.1 checkPermission 分析 (guard.ts:221-323)

**PASS - Fail-Closed 正确实现**

```typescript
// 1. Getter/toJSON 对象检测 (Line 225-233)
if (hasSecurityConcerningProperties(toolCall.toolInput)) {
  return { allowed: false, reason: 'validation-error', ... }
}

// 2. 非序列化输入拒绝 (Line 246-257)
catch {
  return { allowed: false, reason: 'validation-error', ... }
}

// 3. 未知 Agent 拒绝 (Line 271-280)
if (!contract) {
  return { allowed: false, reason: 'contract-not-found', ... }
}
```

**安全保证**:
- 未知 Agent → 默认拒绝 (contract-not-found)
- 未知 Tool → 默认拒绝 (tool-not-allowed)
- 恶意输入 → 默认拒绝 (validation-error)

### 1.2 TOCTOU 防护 (guard.ts:47-132)

**PASS - 多层防护正确实现**

| 防护层 | 函数 | 说明 |
|-------|------|------|
| 检测恶意属性 | `hasSecurityConcerningProperties` | 检测 getter/toJSON/Proxy |
| 深度冻结 | `deepFreeze` | 递归冻结所有嵌套对象 |
| JSON 序列化 | `JSON.parse(JSON.stringify())` | 隔离原始引用 |

**代码审查**:
```typescript
// Line 108-132: deepFreeze 正确处理循环引用
function deepFreeze<T>(obj: T, visited: WeakSet<object> = new WeakSet()): T {
  if (visited.has(obj as object)) return obj;  // 循环引用保护
  visited.add(obj as object);
  // ... 递归冻结
  return Object.freeze(obj);
}
```

### 1.3 executeWithGuard vs executeWithGuardSafe

| 函数 | 安全性 | 使用场景 |
|------|--------|---------|
| `executeWithGuard` | 中 | 冻结原始 input，执行器可能持有引用 |
| `executeWithGuardSafe` | 高 | 传递冻结克隆，完全隔离 |

**建议**: 优先使用 `executeWithGuardSafe`

---

## 2. 熔断器安全模式评审

### 2.1 状态机分析 (circuit-breaker.ts)

**PASS - 3 状态正确实现**

```
┌─────────┐  recordFailure() x5   ┌─────────┐
│ CLOSED  │ ─────────────────────►│  OPEN   │
│(正常)   │                       │(安全模式)│
└────┬────┘                       └────┬────┘
     │                                  │
     │ recordSuccess()                  │ timeout (60s)
     │                                  │
     ▼                                  ▼
┌─────────────┐  recordSuccess() x3   ┌─────────────┐
│   CLOSED    │ ◄─────────────────────│ HALF-OPEN   │
│             │                       │(恢复探测)   │
└─────────────┘                       └─────────────┘
```

### 2.2 Safe Mode Tools 验证

**PASS - 仅允许只读工具**

```typescript
// types.ts
export const SAFE_MODE_TOOLS = ['Read', 'Glob', 'Grep'] as const;
```

**安全保证**:
- Open 状态: Write/Edit/Bash/Delete 全部阻止
- 恢复探测: 3 次成功后才恢复正常

---

## 3. 危险命令检测评审

### 3.1 模式覆盖分析 (tool-validator.ts:31-90)

**B+ - 覆盖良好，但有改进空间**

| 类别 | 覆盖模式数 | 示例 |
|------|-----------|------|
| 破坏性命令 | 5 | `rm -rf`, `format`, `mkfs` |
| 命令注入 | 6 | backticks, `$()`, `${}` |
| 危险重定向 | 5 | `> /dev/`, `> /etc/` |
| 权限提升 | 6 | `sudo`, `chmod 777` |
| 下载执行 | 8 | `curl\|sh`, `wget\|bash` |
| 系统破坏 | 6 | `dd`, `fdisk`, fork bomb |
| 凭证访问 | 4 | `.ssh/`, `.gnupg/` |
| 环境操纵 | 3 | `export PATH=`, `LD_*` |

### 3.2 发现的安全问题

#### [SEC-001] 缺少符号链接检测 - MEDIUM

**位置**: tool-validator.ts:309-368 (validatePathParam)

**问题**: `hasPathTraversal` 不检测符号链接

```typescript
// 当前实现只检测 .. 模式
if (normalizedPath.startsWith('..')) {
  return true;
}
// 未检测: /tmp/link -> /etc/passwd
```

**风险**: 攻击者可创建符号链接指向受保护路径

**建议**:
```typescript
import { realpathSync } from 'fs';
const realPath = realpathSync(filePath);
if (!realPath.startsWith(projectRoot)) {
  return { allowed: false, reason: 'symlink-escape' };
}
```

#### [SEC-002] 命令注入模式不完整 - LOW

**位置**: tool-validator.ts:31-90

**缺少模式**:
- `eval` 命令
- `xargs` 注入
- `find -exec` 链
- PowerShell 命令 (跨平台)

**建议**: 添加以下模式:
```typescript
/\beval\s/i,
/\bxargs\s.*sh\s-c/i,
/\bfind\s.*-exec\s/i,
/\bpowershell\s/i,
```

#### [SEC-003] URL 编码绕过风险 - LOW

**位置**: tool-validator.ts:215-247

**问题**: 只检测单层和双层 URL 编码

```typescript
/%2e%2e/i,   // 检测 %2e%2e
/%252e/i,    // 检测 %252e
// 未检测: 三层编码 %25252e
```

---

## 4. Agent 合约评审

### 4.1 默认合约分析 (contract.ts:211-268)

| Agent | 合约存在 | ADR 合规 |
|-------|---------|---------|
| Analyst | Yes | OK |
| Architect | Yes | OK |
| Developer | Yes | OK |
| QA | Yes | OK |
| **SecurityExpert** | **NO** | **缺失** |
| **ScrumMaster** | **NO** | **缺失** |

#### [ARCH-001] 缺少 SecurityExpert 合约 - HIGH

**位置**: contract.ts:211-268

**影响**: SecurityExpert Agent 无法在 BoundaryGuard 下工作

**建议**:
```typescript
{
  name: 'SecurityExpert',
  scope: {
    read: ['src/**', 'tests/**', 'config/**'],
    write: ['docs/security/**'],
    forbidden: ['需求分析', '架构设计', '代码编写'],
  },
  allowed_tools: ['Read', 'Glob', 'Grep', 'Write', 'Bash'],
  allowed_paths: ['./src/**', './tests/**', './config/**', './docs/security/**'],
}
```

#### [ARCH-002] 缺少 ScrumMaster 合约 - MEDIUM

**位置**: contract.ts:211-268

**建议**:
```typescript
{
  name: 'ScrumMaster',
  scope: {
    read: ['spec/**', 'docs/**'],
    write: ['docs/sprint/**'],
    forbidden: ['代码编写', '测试执行'],
  },
  allowed_tools: ['Read', 'Glob', 'Grep', 'Write'],
  allowed_paths: ['./spec/**', './docs/**'],
}
```

### 4.2 Schema 版本化评审

#### [ARCH-003] Schema 版本化未实现 - HIGH

**位置**: contract.ts:196-206 (parseConfig)

**ADR v2.1 变更 2 要求**:
```yaml
$schema: "https://specbmad.dev/schemas/{type}/v{major}.{minor}.{patch}"
version: "{major}.{minor}.{patch}"
```

**当前实现**:
```typescript
// 仅读取，不验证
return {
  $schema: (parsed.$schema as string) ?? '',
  version: (parsed.version as string) ?? '1.0.0',
  // ...
};
```

**缺失**:
- 版本兼容性检查
- Schema URL 验证
- 版本迁移策略

---

## 5. validateOutput 评审

#### [ARCH-004] validateOutput 是 Stub - MEDIUM

**位置**: guard.ts:332-351

```typescript
async validateOutput(output: unknown, schema: string): Promise<ValidationResult> {
  // TODO: Implement schema validation using zod or JSON Schema
  if (output === undefined || output === null) {
    return { valid: false, errors: ['Output is null or undefined'] };
  }
  return { valid: true };  // <- 总是返回 true
}
```

**影响**: PostToolUse Hook 不做实际验证

---

## 6. 发现汇总

| ID | 严重度 | 类别 | 描述 | 文件 |
|----|--------|------|------|------|
| SEC-001 | MEDIUM | 安全 | 缺少符号链接检测 | tool-validator.ts |
| SEC-002 | LOW | 安全 | 命令注入模式不完整 | tool-validator.ts |
| SEC-003 | LOW | 安全 | URL 编码绕过风险 | tool-validator.ts |
| ARCH-001 | HIGH | 架构 | 缺少 SecurityExpert 合约 | contract.ts |
| ARCH-002 | MEDIUM | 架构 | 缺少 ScrumMaster 合约 | contract.ts |
| ARCH-003 | HIGH | 架构 | Schema 版本化未实现 | contract.ts |
| ARCH-004 | MEDIUM | 架构 | validateOutput 是 Stub | guard.ts |

---

## 7. 建议修复优先级

### P0 (必须修复)

1. **[ARCH-001]** 添加 SecurityExpert 合约
2. **[ARCH-003]** 实现 Schema 版本化验证

### P1 (应该修复)

3. **[SEC-001]** 添加符号链接检测
4. **[ARCH-002]** 添加 ScrumMaster 合约
5. **[ARCH-004]** 实现 validateOutput

### P2 (可以修复)

6. **[SEC-002]** 扩展命令注入模式
7. **[SEC-003]** 增强 URL 编码检测

---

## 8. 下一步: Codex 交叉评审

请运行以下 Codex 命令进行交叉评审:

```bash
# BoundaryGuard 安全评审
codex exec --full-auto "Security review src/core/boundary/guard.ts"

# Tool Validator 评审
codex exec --full-auto "Security review src/core/boundary/tool-validator.ts"

# Circuit Breaker 评审
codex exec --full-auto "Security review src/core/boundary/circuit-breaker.ts"
```

将 Codex 输出粘贴给 Claude 进行整合。

---

**报告生成**: 2026-02-08
**下次评审**: 修复 P0/P1 问题后
