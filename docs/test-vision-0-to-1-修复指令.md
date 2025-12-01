# Vision 0→1 测试修复指令手册

**目标**: 修复 `tests/manual/test-vision-0-to-1.ts` 中的所有问题  
**执行者**: Agent  
**监督者**: AI 测试监督  
**预计时间**: 1-2 小时

---

## 🎯 修复目标

修复 4 个 P0 级别的严重问题，使测试符合设计文档要求。

---

## 📋 修复清单

- [ ] **修复 1**: 取消注释 BMAD_MOCK_LLM
- [ ] **修复 2**: 添加全局 analysisResult 变量
- [ ] **修复 3**: 修改 Phase 1 保存分析结果
- [ ] **修复 4**: 删除硬编码配置
- [ ] **修复 5**: 修改 Phase 2 动态生成配置
- [ ] **修复 6**: 删除手动注入 metadata 代码
- [ ] **修复 7**: 完善 TypeScript 文件列表
- [ ] **修复 8**: 完善 C++ 文件列表

---

## 🔧 详细修复指令

### 修复 1: 取消注释 BMAD_MOCK_LLM ✅

**位置**: 第 108 行

**当前代码**:
```typescript
  // process.env.BMAD_MOCK_LLM = "1";
```

**修改为**:
```typescript
  process.env.BMAD_MOCK_LLM = "1";
  console.log(chalk.blue('Using Mock LLM for testing'));
```

**执行**:
使用 `search_replace` 工具：
- `old_string`: `  // process.env.BMAD_MOCK_LLM = "1";`
- `new_string`: `  process.env.BMAD_MOCK_LLM = "1";\n  console.log(chalk.blue('Using Mock LLM for testing'));`

---

### 修复 2: 添加全局 analysisResult 变量 ✅

**位置**: 第 33 行之后（在 ProjectConfig 接口定义之后）

**当前代码**: (无)

**添加代码**:
```typescript
// 全局状态：保存分析结果
let analysisResult: any = null;
let projectConfig: ProjectConfig;
```

**执行**:
使用 `search_replace` 工具：
- `old_string`: `// 全局状态\nlet projectConfig: ProjectConfig = {\n  name: 'todo-cli',\n  stack: 'python',\n  type: 'cli',\n  enableTests: true\n};`
- `new_string`: `// 全局状态：保存分析结果和配置\nlet analysisResult: any = null;\nlet projectConfig: ProjectConfig;`

---

### 修复 3: 修改 Phase 1 保存分析结果 ✅

**位置**: 第 129-152 行的 `runPhase1` 函数

**当前代码**:
```typescript
  const analyst = AgentFactory.create('Analyst', client);
  const analysisResult = await analyst.execute({
    projectState: { projectName: 'unknown', workflow: {} },
    workingDirectory: WORKSPACE_DIR,
    inputData: {
      prompt: USER_PROMPT,
      mode: 'technical'
    }
  });

  if (!analysisResult.success) {
    throw new Error('Analyst execution failed');
  }
  
  console.log(chalk.green('✓ Analysis completed'));
  // 将分析结果保存到全局变量，模拟真实流程
  // 由于 Mock LLM 可能会返回假文本，我们需要模拟它返回了正确的 JSON
  // 这里我们手动注入一些 metadata 到 analysisResult 中，以防 Mock Client 返回纯文本
  if (!analysisResult.metadata.projectType) {
    // 模拟 Analyst 的智能识别
    analysisResult.metadata.projectName = 'todo-cli';
    analysisResult.metadata.stack = 'python';
    analysisResult.metadata.projectType = 'cli';
  }
```

**修改为**:
```typescript
  const analyst = AgentFactory.create('Analyst', client);
  analysisResult = await analyst.execute({
    projectState: { projectName: 'unknown', workflow: {} },
    workingDirectory: WORKSPACE_DIR,
    inputData: {
      prompt: USER_PROMPT,
      mode: 'technical'
    }
  });

  if (!analysisResult.success) {
    throw new Error('Analyst execution failed');
  }
  
  console.log(chalk.green('✓ Analysis completed'));
  console.log('Analysis metadata:', JSON.stringify(analysisResult.metadata || {}, null, 2));
  
  // 保存分析结果到全局变量供 Phase 2 使用
  // 注意：如果 Mock LLM 未返回 metadata，Phase 2 会使用默认值
```

**执行**:
使用 `search_replace` 工具替换整个 analyst execute 部分。

---

### 修复 4: 删除硬编码配置 ✅

**位置**: 第 34-39 行

**已在修复 2 中完成** - 删除硬编码，改为声明但不初始化。

---

### 修复 5: 修改 Phase 2 动态生成配置 ✅

**位置**: 第 154-170 行的 `runPhase2` 函数

**当前代码**:
```typescript
async function runPhase2() {
  console.log(chalk.yellow('\n[Phase 2] Generating Project Configuration'));
  
  // 在真实场景中，这部分由 Go 命令从 AnalysisResult 中解析
  // 这里我们使用 Phase 1 中（模拟）得到的数据
  
  // 实际上，Mock LLM 默认返回的是固定文本，不包含动态提取的 metadata。
  // 为了测试能够继续，我们在这里确认配置，并允许从 analysisResult 覆盖（如果存在）
  // 已经在 Phase 1 结尾做了 polyfill
  
  console.log(`Detected configuration: ${projectConfig.name} (${projectConfig.stack})`);
  console.log(chalk.green('✓ Configuration generated'));
  
  // 保存配置到 .specbmad.json (模拟)
  const configPath = path.join(WORKSPACE_DIR, '.specbmad.json');
  fs.writeFileSync(configPath, JSON.stringify(projectConfig, null, 2));
}
```

**修改为**:
```typescript
async function runPhase2() {
  console.log(chalk.yellow('\n[Phase 2] Generating Project Configuration'));
  
  // 从 Phase 1 的分析结果中动态提取配置
  // 如果 Mock LLM 未返回 metadata，使用默认值
  const metadata = analysisResult?.metadata || {};
  
  projectConfig = {
    name: metadata.projectName || 'todo-cli',
    stack: metadata.stack || 'python',
    type: metadata.projectType || 'cli',
    enableTests: true
  };
  
  console.log(chalk.blue('Configuration extracted from analysis:'));
  console.log(JSON.stringify(projectConfig, null, 2));
  console.log(chalk.green('✓ Configuration generated from analysis result'));
  
  // 保存配置到 .specbmad.json
  const configPath = path.join(WORKSPACE_DIR, '.specbmad.json');
  fs.writeFileSync(configPath, JSON.stringify(projectConfig, null, 2));
  console.log(`Configuration saved to: ${configPath}`);
}
```

**执行**:
使用 `search_replace` 工具替换整个 `runPhase2` 函数。

---

### 修复 6: 删除手动注入 metadata 代码 ✅

**已在修复 3 中完成** - 删除了第 146-151 行的 polyfill 代码。

---

### 修复 7: 完善 TypeScript 文件列表 ✅

**位置**: 第 222-223 行

**当前代码**:
```typescript
  } else if (projectConfig.stack === 'typescript') {
    requiredFiles = ['package.json', 'tsconfig.json', 'src/index.ts'];
```

**修改为**:
```typescript
  } else if (projectConfig.stack === 'typescript') {
    requiredFiles = [
      'package.json',
      'tsconfig.json',
      'README.md',
      'src/index.ts',
      'src/types.ts',
      'tests/index.test.ts',
      '.gitignore'
    ];
```

**执行**:
使用 `search_replace` 工具。

---

### 修复 8: 完善 C++ 文件列表 ✅

**位置**: 第 224-225 行

**当前代码**:
```typescript
  } else if (projectConfig.stack === 'cpp') {
    requiredFiles = ['CMakeLists.txt', 'src/main.cpp'];
```

**修改为**:
```typescript
  } else if (projectConfig.stack === 'cpp') {
    requiredFiles = [
      'CMakeLists.txt',
      'README.md',
      'src/main.cpp',
      'include/todo.hpp',
      'tests/test_main.cpp',
      '.gitignore'
    ];
```

**执行**:
使用 `search_replace` 工具。

---

## 🚀 执行顺序

**按照以下顺序执行修复**：

```
1. 修复 2 (添加全局变量) 
   ↓
2. 修复 1 (取消注释 Mock LLM)
   ↓
3. 修复 3 (修改 Phase 1)
   ↓
4. 修复 5 (修改 Phase 2)
   ↓
5. 修复 7 (TypeScript 文件列表)
   ↓
6. 修复 8 (C++ 文件列表)
   ↓
7. 验证修复
```

---

## ✅ 验证标准

修复完成后，代码应该满足：

1. ✅ 第 108 行：`process.env.BMAD_MOCK_LLM = "1";` 未被注释
2. ✅ 全局变量：`let analysisResult: any = null;` 存在
3. ✅ 全局变量：`let projectConfig: ProjectConfig;` 无初始值
4. ✅ Phase 1：`analysisResult = await analyst.execute(...)` (无 const)
5. ✅ Phase 1：无手动注入 metadata 代码
6. ✅ Phase 2：从 `analysisResult.metadata` 提取配置
7. ✅ Phase 4：TypeScript 文件列表有 7 个文件
8. ✅ Phase 4：C++ 文件列表有 6 个文件

---

## 📝 修复后检查清单

- [ ] 运行 `npm run lint` 检查语法错误
- [ ] 使用 `grep "process.env.BMAD_MOCK_LLM"` 确认未被注释
- [ ] 使用 `grep "let projectConfig.*=.*{" ` 确认无硬编码初始化
- [ ] 使用 `grep "analysisResult.metadata" runPhase2` 确认动态提取
- [ ] 读取文件检查 TypeScript/C++ 文件列表完整性
- [ ] 可选：运行测试验证功能

---

## 🎯 预期结果

修复完成后：

- ✅ 配置从分析结果动态生成
- ✅ Mock LLM 正确启用
- ✅ 无手动注入的假数据
- ✅ 文件验证更完整
- ✅ 代码逻辑符合设计文档

---

## 🔄 修复示例

### 完整的修复后 Phase 2 应该是：

```typescript
async function runPhase2() {
  console.log(chalk.yellow('\n[Phase 2] Generating Project Configuration'));
  
  // 从 Phase 1 的分析结果中动态提取配置
  // 如果 Mock LLM 未返回 metadata，使用默认值
  const metadata = analysisResult?.metadata || {};
  
  projectConfig = {
    name: metadata.projectName || 'todo-cli',
    stack: metadata.stack || 'python',
    type: metadata.projectType || 'cli',
    enableTests: true
  };
  
  console.log(chalk.blue('Configuration extracted from analysis:'));
  console.log(JSON.stringify(projectConfig, null, 2));
  console.log(chalk.green('✓ Configuration generated from analysis result'));
  
  // 保存配置到 .specbmad.json
  const configPath = path.join(WORKSPACE_DIR, '.specbmad.json');
  fs.writeFileSync(configPath, JSON.stringify(projectConfig, null, 2));
  console.log(`Configuration saved to: ${configPath}`);
}
```

---

## 📞 遇到问题？

如果修复过程中遇到问题：

1. **语法错误**: 检查括号、引号是否匹配
2. **类型错误**: 确保 TypeScript 类型正确
3. **逻辑错误**: 参考监督报告中的代码示例
4. **不确定**: 询问监督者

---

**开始执行修复！按顺序完成每一项，完成一项打勾一项。** ✅

**监督者会在每一步验证你的修复质量。**

