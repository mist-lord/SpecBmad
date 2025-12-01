#!/bin/bash

# Vision 0→1 测试 - 使用真实 OpenAI API
# 
# 使用方法:
# 1. 设置 API Key: export OPENAI_API_KEY="your-api-key"
# 2. 运行此脚本: ./run-real-api-test.sh

set -e

echo "========================================"
echo "  Vision 0→1 真实 API 端到端测试"
echo "========================================"
echo ""

# 检查 API Key
if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ 错误：未找到 API Key！"
    echo ""
    echo "请先设置 API Key："
    echo "  export OPENAI_API_KEY='your-openai-key'"
    echo "或"
    echo "  export ANTHROPIC_API_KEY='your-anthropic-key'"
    echo ""
    exit 1
fi

if [ -n "$OPENAI_API_KEY" ]; then
    echo "✅ 检测到 OPENAI_API_KEY"
    echo "   Provider: OpenAI"
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "✅ 检测到 ANTHROPIC_API_KEY"
    echo "   Provider: Anthropic"
fi

echo ""
echo "⚠️  注意：此测试将调用真实的 LLM API，会产生费用！"
echo "预估费用：约 $0.01 - $0.05"
echo ""
read -p "是否继续？(y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消测试"
    exit 0
fi

echo ""
echo "🚀 开始测试..."
echo ""

# 设置使用真实 LLM
export USE_REAL_LLM=1

# 运行测试
cd "$(dirname "$0")"
npx ts-node tests/manual/test-vision-0-to-1.ts

echo ""
echo "========================================"
echo "  测试完成！"
echo "========================================"

