# P0-2 Plugin Testing Plan - 接力文档

**日期**: 2026-02-11
**创建者**: Claude Opus 4.5
**状态**: 准备执行
**分支**: `feat/test-coverage-phase1`

---

## P0-1 完成总结

### 成果
| 指标 | 基线 | 完成后 | 提升 |
|------|------|--------|------|
| Commands 覆盖率 | 4.2% | **30.0%** | 7.1x |
| 整体覆盖率 | 39% | **43.4%** | +4.4% |
| 总测试数 | 349 | **380** | +31 |
| Commands 测试 | ~10 | **92** | +82 |

### 修复的Bug
1. ✅ `mockOrchestrator()` 返回类型 (object → array)
2. ✅ `mockPhaseController().transitionTo` 返回类型 (boolean → object)
3. ✅ `workflow.ts` 动态导入 → 静态导入
4. ✅ 测试原型模式支持方法覆盖

### 新增测试文件
- `tests/commands/workflow.test.ts` - 18 tests ✅
- `tests/commands/phase.test.ts` - 17 tests ✅
- `tests/commands/specify.test.ts` - 29 tests ✅
- `tests/commands/analyze.test.ts` - 28 tests ✅

---

## P0-2 目标: Plugin 测试覆盖

### 目标覆盖率
- **TypeScript Plugin**: 0% → 85%+
- **Python Plugin**: 0% → 80%+
- **C++ Plugin**: 0% → 75%+
- **整体覆盖率**: 43.4% → 50%+

### Plugin 文件分析

| Plugin | 文件 | LOC | 方法数 | 测试数 |
|--------|------|-----|--------|--------|
| TypeScript | `src/plugins/stack-typescript/index.ts` | 54 | 4 | 18-22 |
| Python | `src/plugins/stack-python/index.ts` | 148 | 4 | 28-35 |
| C++ | `src/plugins/stack-cpp/index.ts` | 187 | 5 | 35-42 |
| **合计** | - | 389 | 13 | **81-99** |

### 每个 Plugin 的关键方法

#### TypeScript Plugin
```typescript
detect(): boolean                    // 检测 package.json, tsconfig.json
generateSkeleton(): void             // 生成项目结构
getRunCommand(): string              // 返回 npm run/start
getTestCommand(): string             // 返回 npm test
```

#### Python Plugin
```typescript
detect(): boolean                    // 检测 requirements.txt, setup.py, pyproject.toml
generateSkeleton(): void             // 生成 7+ 文件
toPkgName(name: string): string      // 包名转换
getRunCommand(): string              // 返回 python 命令
getTestCommand(): string             // 返回 pytest
```

#### C++ Plugin
```typescript
detect(): boolean                    // 检测 CMakeLists.txt, Makefile, .cpp/.hpp
generateSkeleton(): void             // 生成 8+ 文件 (GoogleTest CMake)
toPkgName(name: string): string      // 包名转换
getRunCommand(): string              // 返回 ./build/main
getBuildCommand(): string            // 返回 cmake && make
getTestCommand(): string             // 返回 ctest
```

---

## Agent Team 执行计划

### 阶段 1: 创建测试工具库 (1 agent)

**Agent**: `general-purpose`
**任务**: 创建 `tests/plugins/plugin-test-utils.ts`

```typescript
// 需要实现的工具函数
export function createMockGeneratorOptions(overrides?: Partial<GeneratorOptions>): GeneratorOptions
export function createTempProjectDir(prefix: string): string
export function cleanupTempDir(dirPath: string): void
export function assertFileExists(filePath: string): void
export function assertFileContains(filePath: string, content: string): void
export function assertDirectoryStructure(basePath: string, structure: string[]): void
export function mockFsOperations(): { restore: () => void }
```

### 阶段 2: 实现 Plugin 测试 (3 agents 并行)

**Agent 1**: TypeScript Plugin Tests
- 文件: `tests/plugins/stack-typescript.test.ts`
- 测试数: 18-22
- 重点: detect(), generateSkeleton(), getRunCommand()

**Agent 2**: Python Plugin Tests
- 文件: `tests/plugins/stack-python.test.ts`
- 测试数: 28-35
- 重点: detect(), generateSkeleton(), toPkgName(), 模板插值

**Agent 3**: C++ Plugin Tests
- 文件: `tests/plugins/stack-cpp.test.ts`
- 测试数: 35-42
- 重点: detect(), generateSkeleton(), CMake 配置, GoogleTest 集成

### 阶段 3: 验证和集成 (1 agent)

**Agent**: `code-reviewer`
**任务**:
- 运行所有测试
- 验证覆盖率提升
- 检查类型和lint错误

---

## 下一个对话的恢复提示

```
继续 P0-2 Plugin 测试覆盖率提升工作。

参考文档:
- docs/handoff/20260211-p0-2-plugin-testing-plan.md

当前状态:
- ✅ P0-1 完成 (Commands 30%, 整体 43.4%)
- 🟡 P0-2 准备执行 (Plugins 0%)

立即执行 Agent Team:

阶段 1 (串行):
- Agent: general-purpose
- 任务: 创建 tests/plugins/plugin-test-utils.ts 测试工具库

阶段 2 (并行，3个agents):
- Agent 1: 实现 TypeScript plugin 测试 (tests/plugins/stack-typescript.test.ts)
- Agent 2: 实现 Python plugin 测试 (tests/plugins/stack-python.test.ts)
- Agent 3: 实现 C++ plugin 测试 (tests/plugins/stack-cpp.test.ts)

阶段 3 (串行):
- Agent: code-reviewer
- 任务: 验证测试通过，检查覆盖率

目标:
- Plugins 覆盖率: 0% → 75%+
- 整体覆盖率: 43.4% → 50%+
- 新增测试: 80-100个
```

---

## 关键文件路径

### Source Files (待测试)
- `src/plugins/stack-typescript/index.ts`
- `src/plugins/stack-python/index.ts`
- `src/plugins/stack-cpp/index.ts`
- `src/plugins/base-stack.ts`

### Test Files (待创建)
- `tests/plugins/plugin-test-utils.ts` - 工具库
- `tests/plugins/stack-typescript.test.ts`
- `tests/plugins/stack-python.test.ts`
- `tests/plugins/stack-cpp.test.ts`

### Reference Files
- `tests/commands/command-test-utils.ts` - Mock 模式参考
- `tests/commands/workflow.test.ts` - 测试结构参考

---

## Mock 策略

### 需要 Mock 的依赖
```typescript
// 文件系统操作
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
}));

// 路径操作
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/')),
}));

// Logger
jest.mock('@/utils/logger', () => mockLogger());
```

### 测试数据 Fixtures
```typescript
// TypeScript 项目结构
const tsProjectStructure = {
  'package.json': '{"name": "test", "dependencies": {"typescript": "^5.0.0"}}',
  'tsconfig.json': '{"compilerOptions": {"target": "ES2020"}}',
  'src/index.ts': 'export const main = () => console.log("hello");',
};

// Python 项目结构
const pyProjectStructure = {
  'requirements.txt': 'flask>=2.0\nrequests>=2.28',
  'setup.py': 'from setuptools import setup; setup(name="test")',
};

// C++ 项目结构
const cppProjectStructure = {
  'CMakeLists.txt': 'cmake_minimum_required(VERSION 3.14)',
  'src/main.cpp': '#include <iostream>\nint main() { return 0; }',
};
```

---

## 预估工时

| 阶段 | 任务 | 预估时间 |
|------|------|----------|
| 阶段 1 | 创建测试工具库 | 30 分钟 |
| 阶段 2 | TypeScript Plugin 测试 | 1.5 小时 |
| 阶段 2 | Python Plugin 测试 | 2 小时 |
| 阶段 2 | C++ Plugin 测试 | 2.5 小时 |
| 阶段 3 | 验证和集成 | 30 分钟 |
| **总计** | - | **7 小时** |

使用并行 agents 可压缩到 **3-4 小时**

---

## 成功标准

- [ ] `tests/plugins/plugin-test-utils.ts` 创建完成
- [ ] TypeScript Plugin: 18+ tests, 85%+ 覆盖率
- [ ] Python Plugin: 28+ tests, 80%+ 覆盖率
- [ ] C++ Plugin: 35+ tests, 75%+ 覆盖率
- [ ] 所有测试通过: `pnpm test tests/plugins/`
- [ ] 类型检查通过: `pnpm type-check`
- [ ] Lint 检查通过: `pnpm lint`
- [ ] 整体覆盖率 > 50%

---

## 风险与缓解

### 风险 1: 文件系统 Mock 复杂度
**缓解**: 使用 `jest.requireActual('fs')` 保留真实函数，仅 mock 特定方法

### 风险 2: 跨平台路径问题
**缓解**: 使用 `path.posix` 或 `path.sep` 处理路径分隔符

### 风险 3: 模板插值测试难度
**缓解**: 创建固定的输入/输出 fixtures，验证关键字段存在

---

## 联系方式

如有问题，参考:
- `CLAUDE.md` - 项目规范
- `tests/commands/command-test-utils.ts` - Mock 模式
- `docs/handoff/20260210-test-coverage-phase1-progress.md` - 历史记录
