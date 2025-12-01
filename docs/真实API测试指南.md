# Vision 0→1 真实 API 端到端测试指南

**目的**: 使用真实的 OpenAI/Anthropic API 进行完整的端到端功能测试

**预计费用**: $0.01 - $0.05 (取决于 API 调用次数和模型选择)

---

## 🎯 测试内容

此测试将完整验证从用户需求到可运行项目的全流程：

```
用户输入需求 (Prompt)
    ↓
真实 LLM 分析需求
    ↓
动态提取项目配置
    ↓
生成项目骨架
    ↓
安装依赖
    ↓
运行测试
    ↓
验证应用可运行
    ↓
生成测试报告
```

---

## 📋 前置准备

### 1. 获取 API Key

选择以下任一提供商：

#### 选项 A: OpenAI
1. 访问 https://platform.openai.com/api-keys
2. 创建新的 API Key
3. 复制 Key（格式：`sk-...`）

#### 选项 B: Anthropic
1. 访问 https://console.anthropic.com/settings/keys
2. 创建新的 API Key
3. 复制 Key

### 2. 设置环境变量

**macOS/Linux**:
```bash
# OpenAI
export OPENAI_API_KEY="sk-your-openai-key-here"

# 或 Anthropic
export ANTHROPIC_API_KEY="sk-ant-your-anthropic-key-here"
```

**Windows PowerShell**:
```powershell
# OpenAI
$env:OPENAI_API_KEY="sk-your-openai-key-here"

# 或 Anthropic
$env:ANTHROPIC_API_KEY="sk-ant-your-anthropic-key-here"
```

### 3. 验证环境

```bash
cd /Users/baijinde/code/SpecBmad

# 检查 API Key
echo $OPENAI_API_KEY

# 或
echo $ANTHROPIC_API_KEY
```

---

## 🚀 运行测试

### 方法 1: 使用便捷脚本（推荐）

```bash
cd /Users/baijinde/code/SpecBmad
./run-real-api-test.sh
```

脚本会：
1. ✅ 自动检查 API Key
2. ✅ 提示确认（避免意外产生费用）
3. ✅ 设置正确的环境变量
4. ✅ 运行完整测试

### 方法 2: 手动运行

```bash
cd /Users/baijinde/code/SpecBmad

# 设置使用真实 LLM
export USE_REAL_LLM=1

# 确保已设置 API Key
export OPENAI_API_KEY="your-key"

# 运行测试
npx ts-node tests/manual/test-vision-0-to-1.ts
```

### 方法 3: 直接用 Node 运行（如果已编译）

```bash
cd /Users/baijinde/code/SpecBmad

# 编译 TypeScript
npm run build

# 运行测试
USE_REAL_LLM=1 OPENAI_API_KEY="your-key" node tests/manual/test-vision-0-to-1.ts
```

---

## 📊 预期输出

### 阶段 1: LLM 分析

```
[Phase 1] Requirement Analysis
🌐 Using Real OpenAI API for testing
✓ LLM client initialized: openai
✓ Analysis completed
Analysis metadata: {
  "projectName": "todo-cli",
  "stack": "python",
  "projectType": "cli"
}
```

### 阶段 2: 配置生成

```
[Phase 2] Generating Project Configuration
Configuration extracted from analysis:
{
  "name": "todo-cli",
  "stack": "python",
  "type": "cli",
  "enableTests": true
}
✓ Configuration generated from analysis result
```

### 阶段 3-9: 项目生成与验证

```
[Phase 3] Generating Project Skeleton
✓ Project skeleton generated

[Phase 4] Validating Generated Files
✓ All required Python files exist

[Phase 5] Validating File Content Quality
✓ README contains: Project title
✓ README contains: Installation section
✓ Test file contains test cases

[Phase 6] Installing Project Dependencies
Creating virtual environment...
✓ Virtual environment created
Installing dependencies...
✓ Python dependencies installed

[Phase 7] Building Project
✓ Python syntax check passed

[Phase 8] Running Project Tests
Running pytest...
✓ All Python tests passed

[Phase 9] Running Generated Application
Running Python CLI with --help...
✓ Python CLI runs successfully
```

### 阶段 10: 测试报告

```
[Phase 10] Reporting
✓ analysis.json exists and valid
✓ Test report saved to: temp-vision-test/test-report.json

✅ All Phases Completed!

Summary:
  User Prompt: Create a simple Python Todo CLI tool...
  Project: todo-cli (python)
  Location: temp-vision-test/todo-cli
  Files Generated: 15
  Artifacts: 1/1
  Report: temp-vision-test/test-report.json
```

---

## 🔍 验证结果

测试完成后，检查以下内容：

### 1. 生成的项目

```bash
cd temp-vision-test/todo-cli

# 查看项目结构
ls -la

# 应该包含：
# - pyproject.toml
# - README.md
# - src/todo_cli/
# - tests/
# - .venv/
```

### 2. 真实 LLM 分析结果

```bash
# 查看分析产物
cat temp-vision-test/.bmad/artifacts/analysis.json

# 应该包含真实的 LLM 响应，而非 Mock 数据
```

### 3. 测试报告

```bash
# 查看测试报告
cat temp-vision-test/test-report.json
```

### 4. 运行生成的项目

```bash
cd temp-vision-test/todo-cli

# 激活虚拟环境
source .venv/bin/activate

# 运行应用
python -m todo_cli --help

# 运行测试
pytest -v
```

---

## ⚠️ 注意事项

### API 费用

- **OpenAI GPT-4**: ~$0.03/1K tokens
- **OpenAI GPT-3.5**: ~$0.002/1K tokens
- **Anthropic Claude**: ~$0.015/1K tokens

预计单次测试费用：**$0.01 - $0.05**

### Mock vs Real 对比

| 项目 | Mock LLM | Real LLM |
|------|----------|----------|
| **速度** | 快 (~1秒) | 慢 (~5-10秒) |
| **费用** | 免费 | $0.01-$0.05 |
| **准确性** | 固定响应 | 真实分析 |
| **网络** | 不需要 | 需要 |
| **适用场景** | CI/CD, 本地开发 | 真实验证, 演示 |

### 故障排查

#### 问题 1: API Key 未生效

```bash
# 检查环境变量
env | grep API_KEY

# 重新设置
export OPENAI_API_KEY="your-key"
```

#### 问题 2: 网络连接失败

```bash
# 测试 OpenAI 连接
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

#### 问题 3: API 限流

如果遇到 `Rate limit exceeded` 错误：
1. 等待 1 分钟后重试
2. 检查 API 配额: https://platform.openai.com/usage
3. 升级 API 计划

#### 问题 4: 仍然使用 Mock

确保设置了 `USE_REAL_LLM=1`：
```bash
# 检查
echo $USE_REAL_LLM

# 应该输出: 1
```

---

## 📝 测试检查清单

运行前：
- [ ] 已获取 API Key
- [ ] 已设置环境变量（OPENAI_API_KEY 或 ANTHROPIC_API_KEY）
- [ ] 已设置 USE_REAL_LLM=1
- [ ] 网络连接正常
- [ ] 有足够的 API 配额

运行中：
- [ ] 看到 "🌐 Using Real OpenAI API" 消息
- [ ] LLM 响应时间 5-10 秒（不是瞬间）
- [ ] 分析结果包含有意义的内容（非固定 Mock 数据）

运行后：
- [ ] 项目成功生成
- [ ] 依赖安装成功
- [ ] 测试通过
- [ ] 应用可运行
- [ ] 测试报告生成

---

## 🎯 成功标准

测试成功的标志：

1. ✅ **所有 10 个阶段**无错误完成
2. ✅ **真实 LLM 调用**生效（从日志和响应内容判断）
3. ✅ **项目配置**从 LLM 分析动态提取
4. ✅ **生成的项目**可以构建和运行
5. ✅ **测试报告**包含完整信息

---

## 🔄 切换回 Mock 模式

测试完成后，如果要继续开发：

```bash
# 取消 USE_REAL_LLM 环境变量
unset USE_REAL_LLM

# 或明确设置为 Mock 模式
export USE_REAL_LLM=0

# 再次运行测试（不会产生费用）
npx ts-node tests/manual/test-vision-0-to-1.ts
```

---

## 📞 获取帮助

如果遇到问题：

1. 查看测试日志：`temp-vision-test/failure-report.json`
2. 检查 API 状态：https://status.openai.com
3. 参考监督报告：`docs/test-vision-0-to-1-监督检查结果.md`

---

**开始测试！祝顺利！🚀**

