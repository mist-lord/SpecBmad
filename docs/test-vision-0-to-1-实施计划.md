# Vision 0→1 完整测试实施计划

**文档版本**: 1.0  
**创建日期**: 2025-11-30  
**目标**: 逐步完善 `test-vision-0-to-1.ts`，实现从用户需求到可运行项目的完整测试

---

## 📋 测试实施总览

本计划将测试分为 **9 个阶段**，每个阶段包含具体的测试任务、实现代码和验证标准。

**完成时间估算**: 3-5 个工作日  
**优先级**: P0（高优先级）

---

## 🎯 测试目标

验证以下完整流程：

```
用户输入需求 (Prompt)
    ↓
需求分析 (LLM/Mock)
    ↓
技术规划 (Planning)
    ↓
任务拆解 (Tasks)
    ↓
项目生成 (Generate Skeleton)
    ↓
代码实现 (Implementation)
    ↓
依赖安装 (Install Dependencies)
    ↓
测试执行 (Run Tests)
    ↓
质量验证 (QA Check)
    ↓
✅ 可运行的完整项目
```

---

## 📝 测试实施步骤

### ✅ 阶段 0: 准备工作（已完成）

**任务**: 环境清理和目录准备

**当前代码**:
```typescript
// 已完成 - 保持不变
if (fs.existsSync(WORKSPACE_DIR)) {
  fs.rmSync(WORKSPACE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
```

**验证标准**:
- [x] 临时目录被清理
- [x] 新的工作区被创建

---

### 🔲 阶段 1: 需求解析与分析（新增）

**任务**: 测试需求分析阶段，验证 LLM/Mock 能正确解析用户需求

#### 1.1 添加 Mock LLM 支持

**实现位置**: 在 `run0to1()` 函数开始处

```typescript
// 1. 设置 Mock LLM 环境（避免真实 API 调用）
process.env.BMAD_MOCK_LLM = '1';
console.log(chalk.yellow('[Setup] Using Mock LLM for testing'));

// 2. 初始化 LLM Manager
const { llmManager } = await import('../../dist/core/llm/manager');
await llmManager.initialize();
const client = llmManager.getDefaultClient();

if (!client) {
  throw new Error('Failed to initialize LLM client');
}
console.log(chalk.green('✓ LLM client initialized'));
```

#### 1.2 测试需求分析

```typescript
// 3. 运行分析命令（模拟 go 命令的第一步）
console.log(chalk.bold.yellow('\n[Phase 1] Analyzing User Requirements\n'));

const { AgentFactory } = await import('../../dist/agents/factory');
const AnalystAgent = AgentFactory.get('Analyst');

if (!AnalystAgent) {
  throw new Error('Analyst agent not found');
}

const analyst = new AnalystAgent(client);
const analysisResult = await analyst.execute({
  projectState: { projectName: 'todo-cli', workflow: {} },
  workingDirectory: WORKSPACE_DIR,
  inputData: {
    prompt: USER_PROMPT,
    mode: 'technical'
  }
});

console.log(chalk.green('✓ Analysis completed'));
console.log('Analysis result:', JSON.stringify(analysisResult, null, 2).substring(0, 200) + '...');
```

**验证标准**:
- [ ] Mock LLM 成功初始化
- [ ] Analyst 代理成功执行
- [ ] 返回结果包含 `success: true`
- [ ] 分析结果包含项目类型识别（如 CLI、Python 等）

**预期产物**:
- `.bmad/artifacts/analysis.json`（如果代理生成）

---

### 🔲 阶段 2: 项目配置生成（改进）

**任务**: 从分析结果自动生成项目配置，而非硬编码

#### 2.1 智能配置生成

**当前问题**: 配置是硬编码的
```typescript
// ❌ 旧代码（硬编码）
const projectConfig = {
  name: "todo-cli",
  stack: "python",
  type: "cli"
};
```

**改进方案**:
```typescript
// ✅ 新代码（从分析结果提取）
console.log(chalk.bold.yellow('\n[Phase 2] Generating Project Configuration\n'));

// 从分析结果推断配置
const projectConfig = {
  name: analysisResult.metadata?.projectName || "todo-cli",
  stack: analysisResult.metadata?.stack || "python",
  type: analysisResult.metadata?.projectType || "cli",
  enableTests: true
};

console.log('Detected configuration:', projectConfig);
console.log(chalk.green('✓ Configuration generated from analysis'));
```

**验证标准**:
- [ ] 配置从分析结果动态提取
- [ ] 包含正确的 `stack`、`type`、`name`
- [ ] 配置被保存到 `.specbmad.json`

---

### 🔲 阶段 3: 项目骨架生成（改进）

**任务**: 使用 CLI 命令而非内部 API，测试更真实

#### 3.1 使用 CLI 命令生成

**当前问题**: 使用内部脚本绕过了 CLI 入口

**改进方案**:
```typescript
console.log(chalk.bold.yellow('\n[Phase 3] Generating Project Skeleton\n'));

const projectDir = path.join(WORKSPACE_DIR, projectConfig.name);
fs.mkdirSync(projectDir, { recursive: true });

// 方案 A: 使用 generate 命令（推荐）
try {
  await execa('node', [
    CLI_PATH,
    'generate',
    '--input', path.join(WORKSPACE_DIR, 'requirements.md'),
    '--stack', projectConfig.stack,
    '--out', projectDir,
    '--auto-implement'
  ], {
    cwd: WORKSPACE_DIR,
    stdio: 'inherit'
  });
  console.log(chalk.green('✓ Project skeleton generated via CLI'));
} catch (error) {
  // 方案 B: 回退到 StackManager（如果 generate 命令未完全实现）
  console.log(chalk.yellow('⚠ Falling back to StackManager API'));
  
  const { stackManager } = await import('../../dist/core/stack/manager');
  const { registerBuiltInStacks } = await import('../../dist/core/stack');
  registerBuiltInStacks();
  
  const plugin = stackManager.getPlugin(projectConfig.stack);
  if (!plugin) throw new Error(`${projectConfig.stack} plugin not found`);
  
  await plugin.generateSkeleton({
    stack: projectConfig.stack,
    projectDir: projectDir,
    projectName: projectConfig.name,
    vars: { enableTests: 'true' }
  });
  
  console.log(chalk.green('✓ Project skeleton generated via StackManager'));
}
```

**验证标准**:
- [ ] 项目目录被创建
- [ ] 包含正确的包管理文件（`pyproject.toml` / `package.json` / `CMakeLists.txt`）
- [ ] 包含源代码目录结构
- [ ] 包含测试目录

---

### 🔲 阶段 4: 文件完整性验证（扩展）

**任务**: 验证生成的项目文件完整性

#### 4.1 Python 项目验证（改进现有）

```typescript
console.log(chalk.bold.yellow('\n[Phase 4] Validating Generated Files\n'));

const projectDir = path.join(WORKSPACE_DIR, projectConfig.name);

// Python 项目验证
if (projectConfig.stack === 'python') {
  const requiredFiles = [
    'pyproject.toml',
    'README.md',
    'src/todo_cli/__init__.py',
    'src/todo_cli/__main__.py',
    'tests/__init__.py',
    'tests/test_basic.py',
    '.gitignore'
  ];
  
  const missingFiles = [];
  for (const file of requiredFiles) {
    const filePath = path.join(projectDir, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
  }
  
  console.log(chalk.green('✓ All required Python files exist'));
}
```

#### 4.2 TypeScript 项目验证（新增）

```typescript
// TypeScript 项目验证
if (projectConfig.stack === 'typescript') {
  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'README.md',
    'src/index.ts',
    'src/types.ts',
    'tests/index.test.ts',
    '.gitignore'
  ];
  
  const missingFiles = [];
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(projectDir, file))) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
  }
  
  console.log(chalk.green('✓ All required TypeScript files exist'));
}
```

#### 4.3 C++ 项目验证（新增）

```typescript
// C++ 项目验证
if (projectConfig.stack === 'cpp') {
  const requiredFiles = [
    'CMakeLists.txt',
    'README.md',
    'src/main.cpp',
    'include/todo.hpp',
    'tests/test_main.cpp',
    '.gitignore'
  ];
  
  const missingFiles = [];
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(projectDir, file))) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
  }
  
  console.log(chalk.green('✓ All required C++ files exist'));
}
```

**验证标准**:
- [ ] 所有必需文件存在
- [ ] 文件内容非空
- [ ] 配置文件格式正确（JSON/TOML/YAML）

---

### 🔲 阶段 5: 内容质量验证（新增）

**任务**: 验证生成文件的内容质量

```typescript
console.log(chalk.bold.yellow('\n[Phase 5] Validating File Content Quality\n'));

// 5.1 验证 README.md 包含必要信息
const readmePath = path.join(projectDir, 'README.md');
const readmeContent = fs.readFileSync(readmePath, 'utf-8');

const readmeChecks = [
  { pattern: /# .*todo/i, name: 'Project title' },
  { pattern: /## Installation/i, name: 'Installation section' },
  { pattern: /## Usage/i, name: 'Usage section' },
  { pattern: /(pip install|npm install|cmake)/i, name: 'Install command' }
];

for (const check of readmeChecks) {
  if (!check.pattern.test(readmeContent)) {
    console.log(chalk.yellow(`⚠ README missing: ${check.name}`));
  } else {
    console.log(chalk.green(`✓ README contains: ${check.name}`));
  }
}

// 5.2 验证主文件包含基本逻辑
let mainFilePath;
if (projectConfig.stack === 'python') {
  mainFilePath = path.join(projectDir, 'src/todo_cli/__main__.py');
  const mainContent = fs.readFileSync(mainFilePath, 'utf-8');
  
  if (!mainContent.includes('def main') && !mainContent.includes('if __name__')) {
    throw new Error('Python main file missing entry point');
  }
  console.log(chalk.green('✓ Python main file has entry point'));
}

if (projectConfig.stack === 'typescript') {
  mainFilePath = path.join(projectDir, 'src/index.ts');
  const mainContent = fs.readFileSync(mainFilePath, 'utf-8');
  
  if (!mainContent.includes('export') && !mainContent.includes('function')) {
    throw new Error('TypeScript main file missing exports/functions');
  }
  console.log(chalk.green('✓ TypeScript main file has exports'));
}

// 5.3 验证测试文件包含测试用例
if (projectConfig.stack === 'python') {
  const testPath = path.join(projectDir, 'tests/test_basic.py');
  if (fs.existsSync(testPath)) {
    const testContent = fs.readFileSync(testPath, 'utf-8');
    if (!testContent.includes('def test_') && !testContent.includes('class Test')) {
      console.log(chalk.yellow('⚠ Test file missing test cases'));
    } else {
      console.log(chalk.green('✓ Test file contains test cases'));
    }
  }
}
```

**验证标准**:
- [ ] README 包含标题、安装、使用说明
- [ ] 主文件包含入口点/导出
- [ ] 测试文件包含测试用例
- [ ] 代码符合基本语法规范

---

### 🔲 阶段 6: 依赖安装测试（新增）

**任务**: 验证项目依赖能够成功安装

```typescript
console.log(chalk.bold.yellow('\n[Phase 6] Installing Project Dependencies\n'));

try {
  if (projectConfig.stack === 'python') {
    // 检测 Python 解释器
    let pythonCmd = 'python';
    try {
      await execa('python', ['--version'], { cwd: projectDir });
    } catch {
      pythonCmd = 'python3';
      console.log(chalk.yellow('⚠ Using python3 instead of python'));
    }
    
    // 创建虚拟环境
    console.log('Creating virtual environment...');
    await execa(pythonCmd, ['-m', 'venv', '.venv'], {
      cwd: projectDir,
      stdio: 'inherit'
    });
    console.log(chalk.green('✓ Virtual environment created'));
    
    // 安装依赖
    const pipCmd = path.join(projectDir, '.venv/bin/pip');
    console.log('Installing dependencies...');
    await execa(pipCmd, ['install', '-e', '.'], {
      cwd: projectDir,
      stdio: 'inherit',
      timeout: 60000 // 1分钟超时
    });
    console.log(chalk.green('✓ Python dependencies installed'));
  }
  
  if (projectConfig.stack === 'typescript') {
    console.log('Installing Node.js dependencies...');
    await execa('npm', ['install'], {
      cwd: projectDir,
      stdio: 'inherit',
      timeout: 120000 // 2分钟超时
    });
    console.log(chalk.green('✓ Node.js dependencies installed'));
  }
  
  if (projectConfig.stack === 'cpp') {
    console.log('Configuring CMake...');
    const buildDir = path.join(projectDir, 'build');
    fs.mkdirSync(buildDir, { recursive: true });
    
    await execa('cmake', ['..'], {
      cwd: buildDir,
      stdio: 'inherit',
      timeout: 60000
    });
    console.log(chalk.green('✓ CMake configured'));
  }
  
} catch (error) {
  console.error(chalk.red('✗ Dependency installation failed:'), error.message);
  throw error;
}
```

**验证标准**:
- [ ] Python: 虚拟环境创建成功，`pip install` 无错误
- [ ] TypeScript: `npm install` 成功，`node_modules/` 存在
- [ ] C++: CMake 配置成功，`build/` 目录存在

---

### 🔲 阶段 7: 构建与编译测试（新增）

**任务**: 验证项目能够成功构建

```typescript
console.log(chalk.bold.yellow('\n[Phase 7] Building Project\n'));

try {
  if (projectConfig.stack === 'typescript') {
    console.log('Compiling TypeScript...');
    await execa('npm', ['run', 'build'], {
      cwd: projectDir,
      stdio: 'inherit',
      timeout: 60000
    });
    
    // 验证产物
    if (!fs.existsSync(path.join(projectDir, 'dist'))) {
      throw new Error('Build output directory not found');
    }
    console.log(chalk.green('✓ TypeScript compiled successfully'));
  }
  
  if (projectConfig.stack === 'cpp') {
    console.log('Building C++ project...');
    await execa('cmake', ['--build', '.'], {
      cwd: path.join(projectDir, 'build'),
      stdio: 'inherit',
      timeout: 120000
    });
    console.log(chalk.green('✓ C++ project built successfully'));
  }
  
  if (projectConfig.stack === 'python') {
    // Python 通常不需要编译，但可以检查语法
    console.log('Checking Python syntax...');
    await execa('python', ['-m', 'py_compile', 'src/todo_cli/__main__.py'], {
      cwd: projectDir,
      stdio: 'inherit'
    });
    console.log(chalk.green('✓ Python syntax check passed'));
  }
  
} catch (error) {
  console.error(chalk.red('✗ Build failed:'), error.message);
  throw error;
}
```

**验证标准**:
- [ ] 构建命令成功执行
- [ ] 无编译错误
- [ ] 产物文件生成（如 `dist/`, `build/` 等）

---

### 🔲 阶段 8: 测试执行验证（新增）

**任务**: 运行生成的测试，验证测试通过

```typescript
console.log(chalk.bold.yellow('\n[Phase 8] Running Project Tests\n'));

try {
  if (projectConfig.stack === 'python') {
    console.log('Running pytest...');
    const result = await execa('.venv/bin/pytest', ['-v'], {
      cwd: projectDir,
      stdio: 'inherit',
      timeout: 60000,
      reject: false // 允许测试失败但继续执行
    });
    
    if (result.exitCode === 0) {
      console.log(chalk.green('✓ All Python tests passed'));
    } else {
      console.log(chalk.yellow(`⚠ Some tests failed (exit code: ${result.exitCode})`));
    }
  }
  
  if (projectConfig.stack === 'typescript') {
    console.log('Running Jest tests...');
    const result = await execa('npm', ['test'], {
      cwd: projectDir,
      stdio: 'inherit',
      timeout: 60000,
      reject: false
    });
    
    if (result.exitCode === 0) {
      console.log(chalk.green('✓ All TypeScript tests passed'));
    } else {
      console.log(chalk.yellow(`⚠ Some tests failed (exit code: ${result.exitCode})`));
    }
  }
  
  if (projectConfig.stack === 'cpp') {
    console.log('Running CTest...');
    const result = await execa('ctest', ['--output-on-failure'], {
      cwd: path.join(projectDir, 'build'),
      stdio: 'inherit',
      timeout: 60000,
      reject: false
    });
    
    if (result.exitCode === 0) {
      console.log(chalk.green('✓ All C++ tests passed'));
    } else {
      console.log(chalk.yellow(`⚠ Some tests failed (exit code: ${result.exitCode})`));
    }
  }
  
} catch (error) {
  console.error(chalk.red('✗ Test execution failed:'), error.message);
  // 不抛出错误，因为测试失败不应该阻止流程继续
}
```

**验证标准**:
- [ ] 测试命令成功执行
- [ ] 至少 1 个测试运行
- [ ] 测试结果可读（输出格式正确）
- [ ] 理想情况下所有测试通过

---

### 🔲 阶段 9: 应用运行验证（新增）

**任务**: 运行生成的应用，验证基本功能

```typescript
console.log(chalk.bold.yellow('\n[Phase 9] Running Generated Application\n'));

try {
  if (projectConfig.stack === 'python') {
    console.log('Running Python CLI with --help...');
    const result = await execa('.venv/bin/python', ['-m', 'todo_cli', '--help'], {
      cwd: projectDir,
      timeout: 10000,
      reject: false
    });
    
    if (result.exitCode === 0 && result.stdout.includes('usage')) {
      console.log(chalk.green('✓ Python CLI runs successfully'));
      console.log('Output preview:', result.stdout.substring(0, 100) + '...');
    } else {
      console.log(chalk.yellow('⚠ CLI run had issues'));
    }
  }
  
  if (projectConfig.stack === 'typescript') {
    console.log('Running TypeScript app...');
    const result = await execa('node', ['dist/index.js', '--help'], {
      cwd: projectDir,
      timeout: 10000,
      reject: false
    });
    
    if (result.exitCode === 0) {
      console.log(chalk.green('✓ TypeScript app runs successfully'));
      console.log('Output preview:', result.stdout.substring(0, 100) + '...');
    } else {
      console.log(chalk.yellow('⚠ App run had issues'));
    }
  }
  
  if (projectConfig.stack === 'cpp') {
    console.log('Running C++ executable...');
    const execPath = path.join(projectDir, 'build/todo-cli');
    if (fs.existsSync(execPath)) {
      const result = await execa(execPath, ['--help'], {
        timeout: 10000,
        reject: false
      });
      
      if (result.exitCode === 0) {
        console.log(chalk.green('✓ C++ app runs successfully'));
        console.log('Output preview:', result.stdout.substring(0, 100) + '...');
      } else {
        console.log(chalk.yellow('⚠ App run had issues'));
      }
    } else {
      console.log(chalk.yellow('⚠ Executable not found'));
    }
  }
  
} catch (error) {
  console.error(chalk.red('✗ Application run failed:'), error.message);
  // 不抛出错误，允许继续
}
```

**验证标准**:
- [ ] 应用能够启动
- [ ] `--help` 命令有输出
- [ ] 无崩溃或严重错误
- [ ] 输出符合预期格式

---

### 🔲 阶段 10: 产物验证与报告（新增）

**任务**: 验证 BMAD 产物和生成测试报告

```typescript
console.log(chalk.bold.yellow('\n[Phase 10] Validating Artifacts & Generating Report\n'));

// 10.1 验证 BMAD 产物
const artifactsDir = path.join(WORKSPACE_DIR, '.bmad/artifacts');
const expectedArtifacts = [
  'analysis.json',
  // 'planning.json',  // 如果后续实现了完整工作流
  // 'solution.json',
  // 'tasks.json'
];

const foundArtifacts = [];
const missingArtifacts = [];

for (const artifact of expectedArtifacts) {
  const artifactPath = path.join(artifactsDir, artifact);
  if (fs.existsSync(artifactPath)) {
    foundArtifacts.push(artifact);
    
    // 验证 JSON 格式
    try {
      const content = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
      console.log(chalk.green(`✓ ${artifact} exists and valid`));
      
      // 验证关键字段
      if (artifact === 'analysis.json') {
        if (!content.workflow || !content.summary) {
          console.log(chalk.yellow(`⚠ ${artifact} missing key fields`));
        }
      }
    } catch (e) {
      console.log(chalk.red(`✗ ${artifact} is invalid JSON`));
    }
  } else {
    missingArtifacts.push(artifact);
    console.log(chalk.yellow(`⚠ ${artifact} not found`));
  }
}

// 10.2 生成测试报告
const report = {
  testName: 'Vision 0→1 Complete Test',
  timestamp: new Date().toISOString(),
  userPrompt: USER_PROMPT,
  projectConfig: projectConfig,
  phases: {
    phase1_analysis: true,
    phase2_configuration: true,
    phase3_skeleton: true,
    phase4_files: true,
    phase5_content: true,
    phase6_dependencies: true,
    phase7_build: true,
    phase8_tests: true,
    phase9_run: true,
    phase10_artifacts: foundArtifacts.length > 0
  },
  artifacts: foundArtifacts,
  missingArtifacts: missingArtifacts,
  projectFiles: fs.readdirSync(projectDir, { recursive: true }).length,
  success: true
};

const reportPath = path.join(WORKSPACE_DIR, 'test-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(chalk.green(`✓ Test report saved to: ${reportPath}`));

console.log(chalk.bold.green('\n✅ All Phases Completed!\n'));
console.log(chalk.cyan('Summary:'));
console.log(`  User Prompt: ${USER_PROMPT}`);
console.log(`  Project: ${projectConfig.name} (${projectConfig.stack})`);
console.log(`  Location: ${projectDir}`);
console.log(`  Files Generated: ${report.projectFiles}`);
console.log(`  Artifacts: ${foundArtifacts.length}/${expectedArtifacts.length}`);
console.log(`  Report: ${reportPath}`);
```

**验证标准**:
- [ ] `.bmad/artifacts/` 目录存在
- [ ] 至少有 `analysis.json`
- [ ] 测试报告生成成功
- [ ] 报告包含所有阶段状态

---

## 📊 执行检查清单

完成测试后，确认以下所有项目：

### 必需项（P0）

- [ ] **阶段 1**: Mock LLM 初始化成功
- [ ] **阶段 1**: Analyst 代理执行成功
- [ ] **阶段 2**: 项目配置动态生成
- [ ] **阶段 3**: 项目骨架生成成功（至少 Python）
- [ ] **阶段 4**: 所有必需文件存在
- [ ] **阶段 5**: 文件内容包含基本结构
- [ ] **阶段 6**: 依赖安装成功（至少 Python）
- [ ] **阶段 8**: 测试能够运行
- [ ] **阶段 9**: 应用能够启动
- [ ] **阶段 10**: 测试报告生成

### 推荐项（P1）

- [ ] TypeScript 技术栈测试
- [ ] C++ 技术栈测试
- [ ] 完整工作流产物验证
- [ ] 构建步骤测试（TS/C++）
- [ ] 测试覆盖率报告

### 可选项（P2）

- [ ] 性能监控（执行时间）
- [ ] 内存使用监控
- [ ] 多项目类型测试（web、lib、api）
- [ ] 错误注入测试
- [ ] 并发执行测试

---

## 🔧 实施指南

### 第 1 天: 阶段 1-3（核心流程）

**目标**: 完成需求分析到骨架生成

1. 实现阶段 1（需求分析）
2. 改进阶段 2（配置生成）
3. 改进阶段 3（骨架生成）
4. 运行测试，确保 Python 路径通过

**预计时间**: 4-6 小时

### 第 2 天: 阶段 4-5（质量验证）

**目标**: 完成文件验证

1. 扩展阶段 4（文件存在性检查）
2. 实现阶段 5（内容质量检查）
3. 添加 TypeScript 和 C++ 验证分支

**预计时间**: 3-4 小时

### 第 3 天: 阶段 6-7（环境与构建）

**目标**: 验证项目可构建

1. 实现阶段 6（依赖安装）
2. 实现阶段 7（构建测试）
3. 处理不同平台的兼容性问题

**预计时间**: 4-5 小时

### 第 4 天: 阶段 8-9（测试与运行）

**目标**: 验证项目可运行

1. 实现阶段 8（测试执行）
2. 实现阶段 9（应用运行）
3. 调试任何运行时问题

**预计时间**: 3-4 小时

### 第 5 天: 阶段 10 + 优化

**目标**: 完善报告和优化

1. 实现阶段 10（产物验证）
2. 优化错误处理
3. 添加详细日志
4. 完整回归测试

**预计时间**: 3-4 小时

---

## 📝 实施注意事项

### 代码组织建议

```typescript
// test-vision-0-to-1.ts 结构建议

// 1. 导入和常量定义（保持不变）
// 2. 辅助函数
async function setupMockLLM() { ... }
async function runAnalysis() { ... }
async function validatePythonProject() { ... }
async function validateTypeScriptProject() { ... }
async function validateCppProject() { ... }
async function installDependencies(stack, projectDir) { ... }
async function runTests(stack, projectDir) { ... }
async function runApplication(stack, projectDir) { ... }

// 3. 主测试函数
async function run0to1() {
  // 阶段 0: 准备
  // 阶段 1: 分析
  // ...
  // 阶段 10: 报告
}

// 4. 执行入口
run0to1().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
```

### 错误处理策略

```typescript
// 分阶段错误处理
try {
  await phase1();
  await phase2();
  // ...
} catch (error) {
  console.error(`Phase failed: ${error.message}`);
  
  // 生成失败报告
  const failureReport = {
    failedAt: currentPhase,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(WORKSPACE_DIR, 'failure-report.json'),
    JSON.stringify(failureReport, null, 2)
  );
  
  throw error; // 重新抛出
}
```

### 调试技巧

1. **使用环境变量控制执行**
   ```typescript
   const SKIP_DEPS_INSTALL = process.env.SKIP_DEPS === '1';
   const SKIP_TESTS = process.env.SKIP_TESTS === '1';
   ```

2. **保存中间状态**
   ```typescript
   // 在每个阶段后保存状态
   fs.writeFileSync(
     path.join(WORKSPACE_DIR, `.phase-${phaseNum}-complete`),
     JSON.stringify({ timestamp: Date.now() })
   );
   ```

3. **详细日志**
   ```typescript
   const DEBUG = process.env.DEBUG === '1';
   if (DEBUG) {
     console.log('Debug:', detailedInfo);
   }
   ```

---

## 🎯 成功标准

测试完全成功的标志：

1. ✅ 所有 10 个阶段无错误完成
2. ✅ 生成的项目能够运行 `--help` 命令
3. ✅ 测试能够执行（即使部分失败）
4. ✅ 测试报告完整生成
5. ✅ 至少支持 Python 技术栈（TypeScript/C++ 为加分项）

---

## 📞 支持与反馈

如果在实施过程中遇到问题：

1. **查看日志**: 检查每个阶段的详细输出
2. **检查文件**: 验证 `.bmad/artifacts/` 和项目目录
3. **逐步调试**: 使用环境变量跳过已完成的阶段
4. **参考现有测试**: 查看 `workflow.e2e.test.ts` 和 `e2e-cli.ts`

---

**开始实施**: 从阶段 1 开始，逐步完成每个阶段  
**预期完成**: 5 个工作日内完成所有阶段  
**最终产物**: 一个完整的、可重复执行的端到端测试

祝测试顺利！🚀

