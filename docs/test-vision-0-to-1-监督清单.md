# Vision 0→1 测试监督清单

**角色**: 测试监督者  
**职责**: 验证测试执行是否符合设计文档  
**参考文档**: 
- `test-vision-0-to-1-实施计划.md`
- `test-vision-0-to-1-执行清单.md`

---

## 📋 监督流程

### 监督原则

1. ✅ **对照检查**: 每个阶段必须与实施计划一致
2. ✅ **验证标准**: 必须满足所有验证点
3. ✅ **代码质量**: 检查实现是否符合最佳实践
4. ✅ **覆盖完整**: 不允许跳过必需的测试步骤

---

## 🔍 阶段监督检查表

### 阶段 0: 环境准备 ✅

**预期行为**:
- [ ] 清理 `temp-vision-test/` 目录
- [ ] 创建新的工作区目录
- [ ] 定义 USER_PROMPT 常量

**监督要点**:
- 是否使用 `fs.rmSync()` 清理旧目录？
- 是否使用 `fs.mkdirSync()` 创建新目录？
- USER_PROMPT 是否清晰定义？

**状态**: ⏸️ 待监督

---

### 阶段 1: 需求分析（新增）🔍

**预期行为**（参考实施计划第45-78行）:

#### 1.1 Mock LLM 初始化
```typescript
// 必须包含以下代码或等效实现
process.env.BMAD_MOCK_LLM = '1';
const { llmManager } = await import('../../dist/core/llm/manager');
await llmManager.initialize();
const client = llmManager.getDefaultClient();
```

**监督检查点**:
- [ ] 是否设置了 `BMAD_MOCK_LLM=1` 环境变量？
- [ ] 是否导入了 `llmManager`？
- [ ] 是否调用了 `initialize()` 方法？
- [ ] 是否验证了 client 不为 null？
- [ ] 是否有成功消息输出？

#### 1.2 Analyst 代理执行
```typescript
// 必须包含以下代码或等效实现
const { AgentFactory } = await import('../../dist/agents/factory');
const AnalystAgent = AgentFactory.get('Analyst');
const analyst = new AnalystAgent(client);
const analysisResult = await analyst.execute({
  projectState: { projectName: 'todo-cli', workflow: {} },
  workingDirectory: WORKSPACE_DIR,
  inputData: { prompt: USER_PROMPT, mode: 'technical' }
});
```

**监督检查点**:
- [ ] 是否导入了 `AgentFactory`？
- [ ] 是否正确获取了 Analyst 代理？
- [ ] 是否创建了代理实例并传入 client？
- [ ] execute() 参数是否包含：
  - [ ] `projectState` 对象
  - [ ] `workingDirectory`
  - [ ] `inputData.prompt` (USER_PROMPT)
  - [ ] `inputData.mode`
- [ ] 是否验证了 `analysisResult.success === true`？
- [ ] 是否打印了分析结果摘要？

**验证标准**:
- [ ] 控制台输出: "✓ LLM client initialized"
- [ ] 控制台输出: "✓ Analysis completed"
- [ ] 无错误抛出
- [ ] analysisResult 包含有效数据

**常见错误警示**:
- ❌ 直接硬编码配置，跳过 LLM 初始化
- ❌ 未设置 BMAD_MOCK_LLM 导致真实 API 调用
- ❌ 未验证 analysisResult 的有效性

**状态**: ⏸️ 待执行和监督

---

### 阶段 2: 配置生成（改进）🔍

**预期行为**（参考实施计划第84-97行）:

```typescript
// 必须从分析结果动态提取，不能硬编码
const projectConfig = {
  name: analysisResult.metadata?.projectName || "todo-cli",
  stack: analysisResult.metadata?.stack || "python",
  type: analysisResult.metadata?.projectType || "cli",
  enableTests: true
};
```

**监督检查点**:
- [ ] 是否删除了旧的硬编码配置？
- [ ] 是否从 `analysisResult.metadata` 提取配置？
- [ ] 是否有合理的默认值（|| "default"）？
- [ ] 是否打印了检测到的配置？
- [ ] 配置是否包含所有必需字段？

**验证标准**:
- [ ] 控制台输出: "Detected configuration: ..."
- [ ] 配置包含: name, stack, type, enableTests
- [ ] 如果分析失败，有合理的回退值

**常见错误警示**:
- ❌ 仍然使用硬编码配置
- ❌ 未从 analysisResult 提取
- ❌ 缺少默认值导致 undefined

**状态**: ⏸️ 待执行和监督

---

### 阶段 3: 骨架生成（改进）🔍

**预期行为**（参考实施计划第103-133行）:

**优先方案A**: 使用 CLI 命令
```typescript
await execa('node', [
  CLI_PATH, 'generate',
  '--input', requirementsPath,
  '--stack', projectConfig.stack,
  '--out', projectDir,
  '--auto-implement'
], {cwd: WORKSPACE_DIR, stdio: 'inherit'});
```

**回退方案B**: StackManager API
```typescript
const { stackManager } = await import('...');
const plugin = stackManager.getPlugin(projectConfig.stack);
await plugin.generateSkeleton({...});
```

**监督检查点**:
- [ ] 是否首先尝试 CLI 命令？
- [ ] 如果 CLI 失败，是否有回退逻辑？
- [ ] 是否使用了动态的 projectConfig.stack？
- [ ] 是否传入了正确的参数？
- [ ] 是否有成功/失败的日志输出？

**验证标准**:
- [ ] 控制台输出: "✓ Project skeleton generated"
- [ ] 项目目录存在
- [ ] 基础文件已创建

**状态**: ⏸️ 待执行和监督

---

### 阶段 4: 文件验证（扩展）🔍

**预期行为**（参考实施计划第139-193行）:

必须包含以下三种技术栈的验证：

#### 4.1 Python 项目验证
```typescript
if (projectConfig.stack === 'python') {
  const requiredFiles = [
    'pyproject.toml', 'README.md',
    'src/todo_cli/__init__.py', 'src/todo_cli/__main__.py',
    'tests/__init__.py', 'tests/test_basic.py',
    '.gitignore'
  ];
  // 检查逻辑
}
```

**监督检查点**:
- [ ] 是否定义了完整的必需文件列表（至少7个文件）？
- [ ] 是否检查了每个文件的存在性？
- [ ] 是否记录了缺失文件？
- [ ] 如果有缺失，是否抛出错误？

#### 4.2 TypeScript 项目验证（新增）
```typescript
if (projectConfig.stack === 'typescript') {
  const requiredFiles = [
    'package.json', 'tsconfig.json', 'README.md',
    'src/index.ts', 'tests/index.test.ts',
    '.gitignore'
  ];
  // 检查逻辑
}
```

**监督检查点**:
- [ ] 是否添加了 TypeScript 分支？
- [ ] 必需文件列表是否完整？
- [ ] 检查逻辑是否与 Python 一致？

#### 4.3 C++ 项目验证（新增）
```typescript
if (projectConfig.stack === 'cpp') {
  const requiredFiles = [
    'CMakeLists.txt', 'README.md',
    'src/main.cpp', 'include/todo.hpp',
    'tests/test_main.cpp', '.gitignore'
  ];
  // 检查逻辑
}
```

**监督检查点**:
- [ ] 是否添加了 C++ 分支？
- [ ] 必需文件列表是否包含 CMake 文件？
- [ ] 检查逻辑是否完整？

**验证标准**:
- [ ] 控制台输出: "✓ All required [Stack] files exist"
- [ ] 所有必需文件都存在
- [ ] 无文件缺失错误

**常见错误警示**:
- ❌ 只检查 Python，忽略其他技术栈
- ❌ 文件列表不完整
- ❌ 未检查重要文件（如测试文件）

**状态**: ⏸️ 待执行和监督

---

### 阶段 5: 内容质量验证（新增）🔍

**预期行为**（参考实施计划第199-247行）:

#### 5.1 README 内容检查
```typescript
const readmeContent = fs.readFileSync(readmePath, 'utf-8');
const readmeChecks = [
  { pattern: /# .*todo/i, name: 'Project title' },
  { pattern: /## Installation/i, name: 'Installation section' },
  { pattern: /## Usage/i, name: 'Usage section' },
  { pattern: /(pip install|npm install|cmake)/i, name: 'Install command' }
];
for (const check of readmeChecks) { /* 验证 */ }
```

**监督检查点**:
- [ ] 是否读取了 README.md 文件？
- [ ] 是否定义了至少4个检查规则？
- [ ] 是否使用正则表达式检查？
- [ ] 是否输出了每个检查的结果？

#### 5.2 主文件入口检查
```typescript
if (projectConfig.stack === 'python') {
  const mainContent = fs.readFileSync(mainFilePath, 'utf-8');
  if (!mainContent.includes('def main') && !mainContent.includes('if __name__')) {
    throw new Error('Python main file missing entry point');
  }
}
```

**监督检查点**:
- [ ] 是否检查了 Python 入口点（`def main` 或 `if __name__`）？
- [ ] 是否检查了 TypeScript 导出（`export` 或 `function`）？
- [ ] 是否检查了 C++ main 函数？
- [ ] 是否有相应的错误或警告？

#### 5.3 测试文件检查
```typescript
const testContent = fs.readFileSync(testPath, 'utf-8');
if (!testContent.includes('def test_') && !testContent.includes('class Test')) {
  console.log('⚠ Test file missing test cases');
}
```

**监督检查点**:
- [ ] 是否检查了测试文件内容？
- [ ] Python: 检查 `def test_` 或 `class Test`
- [ ] TypeScript: 检查 `test(` 或 `it(`
- [ ] C++: 检查 `TEST(`

**验证标准**:
- [ ] 控制台输出: "✓ README contains: [各项检查]"
- [ ] 控制台输出: "✓ [Stack] main file has entry point"
- [ ] 控制台输出: "✓ Test file contains test cases"

**状态**: ⏸️ 待执行和监督

---

### 阶段 6: 依赖安装（新增）🔍

**预期行为**（参考实施计划第253-298行）:

#### 6.1 Python 依赖安装
```typescript
// 检测解释器
let pythonCmd = 'python';
try { await execa('python', ['--version']); }
catch { pythonCmd = 'python3'; }

// 创建虚拟环境
await execa(pythonCmd, ['-m', 'venv', '.venv'], {cwd: projectDir});

// 安装依赖
await execa('.venv/bin/pip', ['install', '-e', '.'], {
  cwd: projectDir,
  timeout: 60000
});
```

**监督检查点**:
- [ ] 是否检测了 python/python3 解释器？
- [ ] 是否创建了虚拟环境 `.venv`？
- [ ] 是否使用虚拟环境的 pip 安装？
- [ ] 是否设置了超时（60秒）？
- [ ] 是否有错误处理？

#### 6.2 TypeScript 依赖安装
```typescript
if (projectConfig.stack === 'typescript') {
  await execa('npm', ['install'], {
    cwd: projectDir,
    timeout: 120000
  });
}
```

**监督检查点**:
- [ ] 是否运行 `npm install`？
- [ ] 超时是否足够（120秒）？
- [ ] 是否验证 `node_modules/` 存在？

#### 6.3 C++ 依赖配置
```typescript
if (projectConfig.stack === 'cpp') {
  const buildDir = path.join(projectDir, 'build');
  fs.mkdirSync(buildDir, {recursive: true});
  await execa('cmake', ['..'], {cwd: buildDir});
}
```

**监督检查点**:
- [ ] 是否创建了 `build/` 目录？
- [ ] 是否运行了 `cmake ..`？
- [ ] 是否有错误处理？

**验证标准**:
- [ ] 控制台输出: "✓ [Stack] dependencies installed"
- [ ] Python: `.venv/` 存在
- [ ] TypeScript: `node_modules/` 存在
- [ ] C++: `build/` 存在且有 CMake 文件

**常见错误警示**:
- ❌ 使用全局 Python 而非虚拟环境
- ❌ 超时时间设置过短
- ❌ 未处理依赖安装失败

**状态**: ⏸️ 待执行和监督

---

### 阶段 7: 构建测试（新增）🔍

**预期行为**（参考实施计划第304-345行）:

**监督检查点**:
- [ ] TypeScript: 是否运行 `npm run build`？
- [ ] TypeScript: 是否验证 `dist/` 目录？
- [ ] C++: 是否运行 `cmake --build .`？
- [ ] Python: 是否运行语法检查？
- [ ] 是否有构建成功的输出？

**验证标准**:
- [ ] 控制台输出: "✓ [Stack] compiled/built successfully"
- [ ] 无编译错误
- [ ] 产物目录存在

**状态**: ⏸️ 待执行和监督

---

### 阶段 8: 测试执行（新增）🔍

**预期行为**（参考实施计划第351-396行）:

**监督检查点**:
- [ ] Python: 是否运行 `pytest -v`？
- [ ] TypeScript: 是否运行 `npm test`？
- [ ] C++: 是否运行 `ctest`？
- [ ] 是否设置 `reject: false` 允许测试失败？
- [ ] 是否记录了退出代码？
- [ ] 是否输出了测试结果？

**验证标准**:
- [ ] 控制台输出: "✓ All [Stack] tests passed" 或 "⚠ Some tests failed"
- [ ] 测试命令成功执行
- [ ] 有可读的测试输出

**状态**: ⏸️ 待执行和监督

---

### 阶段 9: 应用运行（新增）🔍

**预期行为**（参考实施计划第402-446行）:

**监督检查点**:
- [ ] Python: 是否运行 `python -m todo_cli --help`？
- [ ] TypeScript: 是否运行 `node dist/index.js --help`？
- [ ] C++: 是否运行可执行文件 `--help`？
- [ ] 是否验证了输出包含 "usage"？
- [ ] 是否打印了输出预览？

**验证标准**:
- [ ] 控制台输出: "✓ [Stack] app runs successfully"
- [ ] 应用无崩溃
- [ ] 有帮助信息输出

**状态**: ⏸️ 待执行和监督

---

### 阶段 10: 产物验证与报告（新增）🔍

**预期行为**（参考实施计划第452-510行）:

#### 10.1 BMAD 产物验证
```typescript
const expectedArtifacts = ['analysis.json'];
// 检查并验证 JSON 格式和关键字段
```

**监督检查点**:
- [ ] 是否检查 `.bmad/artifacts/` 目录？
- [ ] 是否验证 `analysis.json` 存在？
- [ ] 是否解析和验证 JSON 格式？
- [ ] 是否验证关键字段（workflow, summary）？

#### 10.2 生成测试报告
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

**监督检查点**:
- [ ] 是否创建了完整的报告对象？
- [ ] 报告是否包含所有阶段状态？
- [ ] 是否记录了产物列表？
- [ ] 是否保存为 JSON 文件？
- [ ] 是否打印了报告位置？

#### 10.3 测试摘要
**监督检查点**:
- [ ] 是否打印了成功标题？
- [ ] 是否显示了用户需求？
- [ ] 是否显示了项目统计信息？
- [ ] 是否显示了产物统计？

**验证标准**:
- [ ] 控制台输出: "✓ analysis.json exists and valid"
- [ ] 控制台输出: "✓ Test report saved to: ..."
- [ ] 控制台输出: "✅ All Phases Completed!"
- [ ] `test-report.json` 存在

**状态**: ⏸️ 待执行和监督

---

## 📊 监督评分标准

### 必需项（P0）- 必须全部完成

1. **阶段 1**: Mock LLM + Analyst 代理执行
2. **阶段 2**: 动态配置生成（非硬编码）
3. **阶段 3**: 骨架生成（优先 CLI，回退 API）
4. **阶段 4**: 文件验证（至少 Python + 1种其他技术栈）
5. **阶段 6**: 依赖安装（至少 Python）
6. **阶段 8**: 测试执行
7. **阶段 9**: 应用运行
8. **阶段 10**: 报告生成

### 推荐项（P1）- 强烈建议完成

9. **阶段 5**: 内容质量验证
10. **阶段 7**: 构建测试
11. **多技术栈**: TypeScript 和 C++ 支持

### 可选项（P2）- 加分项

12. 性能监控
13. 错误注入测试
14. 详细的错误处理

---

## ✅ 监督通过标准

测试实施必须满足以下所有条件才能通过监督：

### 代码质量
- [ ] 代码结构清晰，有合理的注释
- [ ] 错误处理完善
- [ ] 日志输出详细且有色彩区分
- [ ] 无硬编码配置（阶段2后）

### 功能完整性
- [ ] 所有 P0 阶段完成
- [ ] 至少 70% 的 P1 阶段完成
- [ ] 每个阶段都有验证输出

### 验证有效性
- [ ] 所有验证标准都被检查
- [ ] 测试能够检测到错误
- [ ] 失败时有明确的错误信息

### 可执行性
- [ ] 测试可以完整运行
- [ ] 生成的项目可以构建和运行
- [ ] 测试报告完整生成

---

## 🚨 监督警示

### 立即叫停的情况

以下情况发现立即叫停测试实施：

1. ❌ **跳过 Mock LLM 初始化**，直接硬编码配置
2. ❌ **未从 analysisResult 提取配置**，仍使用旧逻辑
3. ❌ **仅测试 Python**，完全忽略其他技术栈
4. ❌ **未添加依赖安装和测试执行**，只做文件检查
5. ❌ **未生成测试报告**
6. ❌ **未添加任何新阶段**，只是微调现有代码

### 需要改进的情况

以下情况需要要求改进：

1. ⚠️ 日志输出不够详细
2. ⚠️ 错误处理不完善
3. ⚠️ 验证标准未完全检查
4. ⚠️ 代码注释不足
5. ⚠️ 超时设置不合理

---

## 📝 监督记录模板

```markdown
### 监督时间: YYYY-MM-DD HH:mm

#### 阶段 X: [阶段名称]

**实施情况**: ✅ 通过 / ⚠️ 需改进 / ❌ 未通过

**检查结果**:
- [检查点1]: ✅/❌
- [检查点2]: ✅/❌
- ...

**发现问题**:
1. [问题描述]
2. ...

**改进建议**:
1. [建议内容]
2. ...

**最终评价**: [评价内容]
```

---

## 🎯 监督总结

测试实施完成后，需要提供：

1. **覆盖度报告**: 完成了哪些阶段（P0/P1/P2）
2. **质量评估**: 代码质量、验证有效性
3. **问题清单**: 发现的所有问题和解决方案
4. **改进建议**: 后续优化方向
5. **通过/不通过决定**: 是否符合设计文档要求

---

**监督者准备就绪！等待测试执行开始...**

📍 请另一个 agent 开始按照实施计划执行测试，我会逐阶段进行监督和验证。

