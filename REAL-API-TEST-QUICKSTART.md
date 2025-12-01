# 🚀 真实 API 测试快速开始

## 一步到位运行命令

```bash
cd /Users/baijinde/code/SpecBmad

# 方式 1: 使用脚本（最简单）
export OPENAI_API_KEY="sk-your-key-here"
./run-real-api-test.sh

# 方式 2: 直接运行（快速）
export OPENAI_API_KEY="sk-your-key-here"
export USE_REAL_LLM=1
npx ts-node tests/manual/test-vision-0-to-1.ts

# 方式 3: 使用已编译代码
export OPENAI_API_KEY="sk-your-key-here"
export USE_REAL_LLM=1
node tests/manual/test-vision-0-to-1.ts
```

## 📊 执行后查看结果

```bash
# 1. 查看测试报告
cat temp-vision-test/test-report.json

# 2. 查看真实 LLM 分析结果
cat temp-vision-test/.bmad/artifacts/analysis.json

# 3. 查看生成的项目
cd temp-vision-test/todo-cli
tree -L 2

# 4. 运行生成的应用
source .venv/bin/activate
python -m todo_cli --help
pytest -v
```

## ⚡ 超级快速测试（一行命令）

```bash
cd /Users/baijinde/code/SpecBmad && \
OPENAI_API_KEY="sk-your-key" \
USE_REAL_LLM=1 \
npx ts-node tests/manual/test-vision-0-to-1.ts
```

替换 `sk-your-key` 为你的真实 API Key 即可！

---

**预计执行时间**: 2-5 分钟（取决于网络和 LLM 响应速度）

