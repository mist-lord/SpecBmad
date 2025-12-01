# Vision 0→1 测试执行清单

**测试文件**: `tests/manual/test-vision-0-to-1.ts`  
**执行方式**: `node tests/manual/test-vision-0-to-1.ts`  
**预计时间**: 3-5 个工作日

---

## 📋 快速执行清单

每完成一项，请在 `[ ]` 中打 `[x]` 标记。

---

### ✅ 阶段 0: 环境准备（已完成）

- [x] 清理临时测试目录
- [x] 创建工作区目录
- [x] 定义用户需求常量

**状态**: ✅ 已完成

---

### 🔲 阶段 1: 需求分析（新增）

#### 任务 1.1: 初始化 Mock LLM

```typescript
// 在 run0to1() 函数开始处添加
process.env.BMAD_MOCK_LLM = '1';
const { llmManager } = await import('../../dist/core/llm/manager');
await llmManager.initialize();
const client = llmManager.getDefaultClient();
```

- [ ] 设置 `BMAD_MOCK_LLM=1` 环境变量
- [ ] 导入并初始化 `llmManager`
- [ ] 获取默认 LLM client
- [ ] 验证 client 不为 null
- [ ] 输出成功消息

#### 任务 1.2: 执行需求分析

```typescript
const { AgentFactory } = await import('../../dist/agents/factory');
const AnalystAgent = AgentFactory.get('Analyst');
const analyst = new AnalystAgent(client);
const analysisResult = await analyst.execute({...});
```

- [ ] 导入 AgentFactory
- [ ] 获取 Analyst 代理
- [ ] 创建代理实例
- [ ] 执行分析（传入 USER_PROMPT）
- [ ] 验证结果包含 `success: true`
- [ ] 打印分析结果摘要

**验证点**:
- [ ] 控制台输出 "✓ LLM client initialized"
- [ ] 控制台输出 "✓ Analysis completed"
- [ ] 无错误抛出

---

### 🔲 阶段 2: 配置生成（改进现有）

#### 任务 2.1: 从分析结果提取配置

```typescript
const projectConfig = {
  name: analysisResult.metadata?.projectName || "todo-cli",
  stack: analysisResult.metadata?.stack || "python",
  type: analysisResult.metadata?.projectType || "cli",
  enableTests: true
};
```

- [ ] 删除硬编码配置
- [ ] 从 `analysisResult` 提取配置
- [ ] 添加回退默认值
- [ ] 打印配置信息
- [ ] 保存配置到 `.specbmad.json`（如果需要）

**验证点**:
- [ ] 控制台显示 "Detected configuration: ..."
- [ ] 配置包含正确的 stack、type、name

---

### 🔲 阶段 3: 骨架生成（改进现有）

#### 任务 3.1: 优先使用 CLI 命令

```typescript
// 方案 A: 使用 generate 命令
await execa('node', [CLI_PATH, 'generate', ...], {...});

// 方案 B: 回退到 StackManager（如果命令未实现）
const { stackManager } = await import('...');
await plugin.generateSkeleton({...});
```

- [ ] 尝试使用 `generate` CLI 命令
- [ ] 如果失败，回退到 StackManager API
- [ ] 传入正确的项目配置
- [ ] 等待生成完成
- [ ] 打印成功消息

**验证点**:
- [ ] 控制台输出 "✓ Project skeleton generated"
- [ ] 项目目录被创建
- [ ] 无严重错误

---

### 🔲 阶段 4: 文件验证（扩展现有）

#### 任务 4.1: Python 项目验证（改进）

```typescript
const requiredFiles = [
  'pyproject.toml',
  'README.md',
  'src/todo_cli/__init__.py',
  'src/todo_cli/__main__.py',
  'tests/__init__.py',
  'tests/test_basic.py',
  '.gitignore'
];
// 检查每个文件是否存在
```

- [ ] 定义必需文件列表
- [ ] 遍历检查每个文件
- [ ] 记录缺失文件
- [ ] 如果有缺失则抛出错误
- [ ] 打印验证结果

#### 任务 4.2: TypeScript 项目验证（新增）

```typescript
if (projectConfig.stack === 'typescript') {
  // 检查 package.json, tsconfig.json, src/index.ts 等
}
```

- [ ] 添加 TypeScript 分支判断
- [ ] 定义 TS 必需文件列表
- [ ] 执行相同的验证逻辑
- [ ] 打印验证结果

#### 任务 4.3: C++ 项目验证（新增）

```typescript
if (projectConfig.stack === 'cpp') {
  // 检查 CMakeLists.txt, src/main.cpp 等
}
```

- [ ] 添加 C++ 分支判断
- [ ] 定义 C++ 必需文件列表
- [ ] 执行相同的验证逻辑
- [ ] 打印验证结果

**验证点**:
- [ ] 控制台输出 "✓ All required [Stack] files exist"
- [ ] 所有必需文件都存在
- [ ] 测试不抛出错误

---

### 🔲 阶段 5: 内容质量验证（新增）

#### 任务 5.1: README 内容检查

```typescript
const readmeContent = fs.readFileSync(readmePath, 'utf-8');
const checks = [
  { pattern: /# .*todo/i, name: 'Project title' },
  { pattern: /## Installation/i, name: 'Installation section' },
  ...
];
```

- [ ] 读取 README.md 内容
- [ ] 定义内容检查规则（正则表达式）
- [ ] 检查标题、安装说明、使用说明
- [ ] 打印检查结果

#### 任务 5.2: 主文件入口检查

```typescript
if (projectConfig.stack === 'python') {
  // 检查 __main__.py 包含 def main 或 if __name__
}
```

- [ ] 根据技术栈读取主文件
- [ ] Python: 检查入口点（`def main` 或 `if __name__`）
- [ ] TypeScript: 检查导出（`export` 或 `function`）
- [ ] C++: 检查 main 函数
- [ ] 打印验证结果

#### 任务 5.3: 测试文件检查

```typescript
const testContent = fs.readFileSync(testPath, 'utf-8');
if (!testContent.includes('def test_')) {
  console.log('⚠ Test file missing test cases');
}
```

- [ ] 读取测试文件内容
- [ ] Python: 检查 `def test_` 或 `class Test`
- [ ] TypeScript: 检查 `test(` 或 `it(`
- [ ] C++: 检查 `TEST(`
- [ ] 打印检查结果

**验证点**:
- [ ] 控制台输出多个 "✓ README contains: ..."
- [ ] 控制台输出 "✓ [Stack] main file has entry point"
- [ ] 控制台输出 "✓ Test file contains test cases"

---

### 🔲 阶段 6: 依赖安装（新增）

#### 任务 6.1: Python 依赖安装

```typescript
// 检测解释器
let pythonCmd = 'python';
try { await execa('python', ['--version']); }
catch { pythonCmd = 'python3'; }

// 创建虚拟环境
await execa(pythonCmd, ['-m', 'venv', '.venv'], {...});

// 安装依赖
await execa('.venv/bin/pip', ['install', '-e', '.'], {...});
```

- [ ] 检测 Python 解释器（python 或 python3）
- [ ] 创建虚拟环境 `.venv`
- [ ] 使用 pip 安装项目依赖
- [ ] 设置合理的超时时间（60秒）
- [ ] 打印安装进度

#### 任务 6.2: TypeScript 依赖安装

```typescript
if (projectConfig.stack === 'typescript') {
  await execa('npm', ['install'], {cwd: projectDir, ...});
}
```

- [ ] 添加 TypeScript 分支
- [ ] 运行 `npm install`
- [ ] 验证 `node_modules/` 目录存在
- [ ] 打印成功消息

#### 任务 6.3: C++ 依赖配置

```typescript
if (projectConfig.stack === 'cpp') {
  await execa('cmake', ['..'], {cwd: buildDir, ...});
}
```

- [ ] 添加 C++ 分支
- [ ] 创建 `build/` 目录
- [ ] 运行 `cmake ..` 配置
- [ ] 打印成功消息

**验证点**:
- [ ] 控制台输出 "✓ [Stack] dependencies installed"
- [ ] Python: `.venv/` 目录存在
- [ ] TypeScript: `node_modules/` 目录存在
- [ ] C++: `build/` 目录存在且包含 CMake 缓存

---

### 🔲 阶段 7: 构建测试（新增）

#### 任务 7.1: TypeScript 编译

```typescript
if (projectConfig.stack === 'typescript') {
  await execa('npm', ['run', 'build'], {cwd: projectDir, ...});
  // 验证 dist/ 目录
}
```

- [ ] 运行 `npm run build`
- [ ] 验证 `dist/` 目录生成
- [ ] 检查编译产物文件
- [ ] 打印成功消息

#### 任务 7.2: C++ 编译

```typescript
if (projectConfig.stack === 'cpp') {
  await execa('cmake', ['--build', '.'], {cwd: buildDir, ...});
}
```

- [ ] 运行 `cmake --build .`
- [ ] 验证可执行文件生成
- [ ] 打印成功消息

#### 任务 7.3: Python 语法检查

```typescript
if (projectConfig.stack === 'python') {
  await execa('python', ['-m', 'py_compile', 'src/...'], {...});
}
```

- [ ] 运行 `py_compile` 检查语法
- [ ] 打印检查结果

**验证点**:
- [ ] 控制台输出 "✓ [Stack] compiled/checked successfully"
- [ ] 无编译错误
- [ ] 产物文件存在

---

### 🔲 阶段 8: 测试执行（新增）

#### 任务 8.1: Python 测试

```typescript
const result = await execa('.venv/bin/pytest', ['-v'], {
  cwd: projectDir,
  reject: false  // 允许测试失败
});
```

- [ ] 运行 `pytest -v`
- [ ] 捕获退出代码
- [ ] 打印测试结果
- [ ] 记录通过/失败状态

#### 任务 8.2: TypeScript 测试

```typescript
if (projectConfig.stack === 'typescript') {
  await execa('npm', ['test'], {cwd: projectDir, reject: false});
}
```

- [ ] 运行 `npm test`
- [ ] 打印测试结果
- [ ] 记录状态

#### 任务 8.3: C++ 测试

```typescript
if (projectConfig.stack === 'cpp') {
  await execa('ctest', ['--output-on-failure'], {cwd: buildDir, ...});
}
```

- [ ] 运行 `ctest`
- [ ] 打印测试结果
- [ ] 记录状态

**验证点**:
- [ ] 控制台输出 "✓ All [Stack] tests passed" 或 "⚠ Some tests failed"
- [ ] 测试命令成功执行（即使测试失败）
- [ ] 测试输出可读

---

### 🔲 阶段 9: 应用运行（新增）

#### 任务 9.1: Python 应用运行

```typescript
const result = await execa('.venv/bin/python', ['-m', 'todo_cli', '--help'], {
  cwd: projectDir,
  reject: false
});
```

- [ ] 运行 `python -m todo_cli --help`
- [ ] 检查退出代码
- [ ] 验证输出包含 "usage"
- [ ] 打印输出预览

#### 任务 9.2: TypeScript 应用运行

```typescript
if (projectConfig.stack === 'typescript') {
  await execa('node', ['dist/index.js', '--help'], {cwd: projectDir, ...});
}
```

- [ ] 运行生成的应用
- [ ] 验证能够启动
- [ ] 打印输出预览

#### 任务 9.3: C++ 应用运行

```typescript
if (projectConfig.stack === 'cpp') {
  const execPath = path.join(projectDir, 'build/todo-cli');
  await execa(execPath, ['--help'], {...});
}
```

- [ ] 查找可执行文件
- [ ] 运行应用
- [ ] 验证输出
- [ ] 打印结果

**验证点**:
- [ ] 控制台输出 "✓ [Stack] app runs successfully"
- [ ] 应用无崩溃
- [ ] 有正确的帮助输出

---

### 🔲 阶段 10: 产物验证与报告（新增）

#### 任务 10.1: BMAD 产物验证

```typescript
const expectedArtifacts = ['analysis.json'];
// 检查每个产物是否存在
// 验证 JSON 格式
// 验证关键字段
```

- [ ] 检查 `.bmad/artifacts/` 目录
- [ ] 验证 `analysis.json` 存在
- [ ] 解析 JSON 格式
- [ ] 验证包含 `workflow` 和 `summary` 字段
- [ ] 打印验证结果

#### 任务 10.2: 生成测试报告

```typescript
const report = {
  testName: 'Vision 0→1 Complete Test',
  timestamp: new Date().toISOString(),
  phases: { phase1: true, ... },
  artifacts: foundArtifacts,
  success: true
};
fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
```

- [ ] 创建报告对象
- [ ] 记录所有阶段状态
- [ ] 记录产物列表
- [ ] 记录项目统计信息
- [ ] 保存为 JSON 文件
- [ ] 打印报告路径

#### 任务 10.3: 打印测试摘要

```typescript
console.log('\n✅ All Phases Completed!\n');
console.log('Summary:');
console.log(`  User Prompt: ${USER_PROMPT}`);
console.log(`  Project: ${projectConfig.name}`);
console.log(`  Files Generated: ${fileCount}`);
```

- [ ] 打印成功标题
- [ ] 打印用户需求
- [ ] 打印项目信息
- [ ] 打印生成文件数量
- [ ] 打印产物统计
- [ ] 打印报告位置

**验证点**:
- [ ] 控制台输出 "✓ analysis.json exists and valid"
- [ ] 控制台输出 "✓ Test report saved to: ..."
- [ ] 控制台输出 "✅ All Phases Completed!"
- [ ] `test-report.json` 文件生成

---

## 🎯 最终验证清单

完成所有阶段后，进行最终验证：

### 必需项（全部通过才算成功）

- [ ] **所有 10 个阶段**无错误完成
- [ ] **项目目录**存在且包含所有必需文件
- [ ] **依赖安装**成功（Python 虚拟环境或 node_modules）
- [ ] **测试能够运行**（即使部分失败）
- [ ] **应用能够启动**并响应 `--help`
- [ ] **测试报告**生成且包含完整信息
- [ ] **控制台输出** "✅ All Phases Completed!"

### 技术栈覆盖

- [ ] **Python**: 完全通过（必需）
- [ ] **TypeScript**: 通过（推荐）
- [ ] **C++**: 通过（可选）

### 产物验证

- [ ] **`.bmad/artifacts/analysis.json`** 存在且有效
- [ ] **`test-report.json`** 存在且完整
- [ ] **项目文件数 > 10**

---

## 📊 执行追踪

### 第 1 天进度

- [ ] 阶段 1 完成
- [ ] 阶段 2 完成
- [ ] 阶段 3 完成
- [ ] Python 路径测试通过

### 第 2 天进度

- [ ] 阶段 4 完成（所有技术栈）
- [ ] 阶段 5 完成
- [ ] 内容验证测试通过

### 第 3 天进度

- [ ] 阶段 6 完成（依赖安装）
- [ ] 阶段 7 完成（构建）
- [ ] 环境测试通过

### 第 4 天进度

- [ ] 阶段 8 完成（测试执行）
- [ ] 阶段 9 完成（应用运行）
- [ ] 运行时测试通过

### 第 5 天进度

- [ ] 阶段 10 完成（报告）
- [ ] 完整回归测试
- [ ] 所有技术栈验证
- [ ] 文档更新

---

## 🐛 常见问题排查

### Python 相关

**问题**: `python: command not found`  
**解决**: 使用 `python3` 作为回退

**问题**: `pip install` 超时  
**解决**: 增加超时时间或使用镜像源

**问题**: 虚拟环境激活失败  
**解决**: 使用绝对路径 `.venv/bin/python`

### TypeScript 相关

**问题**: `npm install` 失败  
**解决**: 检查 `package.json` 是否正确，尝试清除缓存

**问题**: 编译错误  
**解决**: 检查 `tsconfig.json` 配置

### C++ 相关

**问题**: `cmake: command not found`  
**解决**: 安装 CMake 或跳过 C++ 测试

**问题**: 编译失败  
**解决**: 检查编译器版本和依赖

### 通用问题

**问题**: LLM 初始化失败  
**解决**: 确保设置了 `BMAD_MOCK_LLM=1`

**问题**: 某个阶段超时  
**解决**: 增加 `timeout` 值或检查网络连接

---

## ✅ 提交前检查

在提交代码前，确认：

- [ ] 代码已格式化（`npm run lint:fix`）
- [ ] 所有阶段都有注释
- [ ] 错误处理完善
- [ ] 日志输出清晰
- [ ] 测试可重复运行（清理临时文件）
- [ ] 更新了 `test-vision-0-to-1.ts` 文件
- [ ] 测试至少运行成功 3 次
- [ ] 文档已更新

---

## 📝 执行记录

**开始时间**: ___________  
**完成时间**: ___________  
**执行人**: ___________

**遇到的主要问题**:
1. 
2. 
3. 

**解决方案**:
1. 
2. 
3. 

**改进建议**:
1. 
2. 
3. 

---

**祝测试顺利！🎉**

如有任何问题，请参考 `test-vision-0-to-1-实施计划.md` 获取详细代码示例。

