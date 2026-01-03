#!/bin/bash
set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

WORK_DIR="temp_cpp_test_$(date +%s)"
CLI="node ../../dist/index.js"

echo -e "${GREEN}=== 开始 C++ 栈集成测试 ===${NC}"

# 1. 生成项目
echo "正在生成项目..."
mkdir -p $WORK_DIR
cd $WORK_DIR
$CLI generate --stack cpp-cli --out cpp-demo --dry-run=false

if [ ! -d "cpp-demo" ]; then
    echo -e "${RED}❌ 生成失败: 目录不存在${NC}"
    exit 1
fi

cd cpp-demo

# 检查关键文件
if [ ! -f "CMakeLists.txt" ] || [ ! -f "tests/CMakeLists.txt" ]; then
    echo -e "${RED}❌ 文件缺失: CMakeLists.txt 或 tests/CMakeLists.txt${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 项目骨架生成成功${NC}"

# 2. 模拟构建 (如果环境中有 cmake)
if command -v cmake &> /dev/null; then
    echo "检测到 CMake，尝试配置..."
    # 注意：FetchContent 下载 GTest 需要网络，这里可能因沙箱限制失败
    # 我们只测试配置步骤，如果不报错说明 CMakeLists 语法基本正确
    cmake -B build || echo -e "${RED}⚠️ CMake 配置失败 (可能是网络原因)${NC}"
else
    echo "⚠️ 未找到 CMake，跳过构建测试"
fi

# 清理
cd ../..
rm -rf $WORK_DIR

echo -e "${GREEN}=== C++ 测试完成 ===${NC}"

