# BMAD-Method Python 实现

BMAD-Method (Business Model Analysis and Design Method) 是一个综合性的项目分析、规划和业务模型管理工具。

## 🚀 快速开始

### 安装依赖

```bash
# 确保您有Python 3.8+
python --version

# 安装项目（如果有requirements.txt）
pip install -r requirements.txt
```

### 基本使用

#### 1. 项目分析 (Analysis)

```bash
# 综合分析
python bmad_bridge.py analyze --mode comprehensive --agent Claude --output json

# 业务分析
python bmad_bridge.py analyze --mode business --agent Claude --output json

# 技术分析
python bmad_bridge.py analyze --mode technical --agent Claude --output json
```

#### 2. 项目规划 (Planning)

```bash
# 架构规划
python bmad_bridge.py plan --type architecture --agent Claude --scale 3 --output json

# 业务规划
python bmad_bridge.py plan --type business --agent Claude --scale 2 --output json

# 技术规划
python bmad_bridge.py plan --type technical --agent Claude --scale 1 --output json
```

#### 3. 解决方案设计 (Solution)

```bash
# 实施解决方案
python bmad_bridge.py solution --type implementation --agent Claude --depth 2 --output json

# 优化解决方案
python bmad_bridge.py solution --type optimization --agent Claude --depth 1 --output json

# 迁移解决方案
python bmad_bridge.py solution --type migration --agent Claude --depth 3 --output json
```

#### 4. 业务模型管理 (BMM)

```bash
# 业务模型分析
python bmad_bridge.py bmm --operation analyze --agent Claude --output json

# 业务模型优化
python bmad_bridge.py bmm --operation optimize --agent Claude --output json

# 业务模型验证
python bmad_bridge.py bmm --operation validate --agent Claude --output json
```

## 🎯 完整工作流程演示

运行概念验证原型，体验完整的BMAD工作流程：

```bash
# 运行完整演示
python demo_workflow.py

# 查看独立命令示例
python demo_workflow.py --commands
```

## 📁 项目结构

```
python/
├── bmad_method/           # BMAD核心引擎
│   ├── __init__.py       # 包初始化
│   ├── core.py           # 核心引擎
│   ├── analysis.py       # 分析引擎
│   ├── planning.py       # 规划引擎
│   ├── solution.py       # 解决方案引擎
│   └── bmm.py           # 业务模型管理引擎
├── bmad_bridge.py        # Python桥接器
├── demo_workflow.py      # 概念验证演示
├── test_bridge.py        # 测试脚本
└── .bmad/               # 产物存储目录
    └── artifacts/       # 工作流产物
        ├── analysis.json
        ├── planning.json
        ├── solution.json
        └── bmm.json
```

## 🔧 配置

BMAD-Method 会在项目根目录查找 `.specbmad/config.json` 配置文件。如果不存在，将使用默认配置。

示例配置文件：

```json
{
  "project": {
    "name": "My Project",
    "version": "1.0.0",
    "description": "Project description"
  },
  "bmad": {
    "default_agent": "Claude",
    "output_format": "json",
    "verbose": false
  }
}
```

## 📊 输出格式

支持多种输出格式：

- `json`: JSON格式输出（默认）
- `markdown`: Markdown格式报告
- `detailed`: 详细格式输出

## 🎨 核心功能

### 分析引擎 (AnalysisEngine)
- 综合项目分析
- 业务模式分析
- 技术架构分析
- 利益相关者分析
- 风险评估

### 规划引擎 (PlanningEngine)
- 架构规划
- 业务规划
- 技术规划
- 资源规划
- 时间线规划

### 解决方案引擎 (SolutionEngine)
- 实施方案设计
- 优化方案设计
- 迁移方案设计
- 集成方案设计
- 部署方案设计

### 业务模型管理引擎 (BMMEngine)
- 业务模型分析
- 业务模型优化
- 业务模型验证
- 业务模型演进
- 业务模型比较

## 🧪 测试

运行测试脚本验证功能：

```bash
python test_bridge.py
```

## 📈 工作流程

BMAD-Method 遵循以下工作流程：

1. **分析阶段**: 理解项目现状和需求
2. **规划阶段**: 制定实施计划和架构设计
3. **解决方案阶段**: 设计具体的实施方案
4. **业务模型管理**: 分析和优化业务模型

每个阶段都会生成相应的产物文件，存储在 `.bmad/artifacts/` 目录中。

## 🔍 故障排除

### 常见问题

1. **模块导入错误**: 确保所有Python文件都在正确的目录中
2. **配置文件缺失**: 这是正常的，系统会使用默认配置
3. **产物目录不存在**: 系统会自动创建 `.bmad/artifacts/` 目录

### 日志

系统会输出详细的日志信息，帮助您了解执行过程和调试问题。

## 🤝 贡献

欢迎贡献代码和建议！请确保：

1. 遵循现有的代码风格
2. 添加适当的测试
3. 更新相关文档

## 📄 许可证

本项目采用 MIT 许可证。