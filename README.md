# Spec-Kit & BMAD-Method 集成项目

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)

一个集成 Spec-Kit 和 BMAD-Method 的智能需求分析与规格生成工具，通过 AI 驱动的方法论提升软件开发的需求分析效率和质量。

## 🚀 项目概述

本项目旨在将 Spec-Kit 的结构化需求管理能力与 BMAD-Method 的业务建模分析方法相结合，创建一个统一的、AI 增强的需求分析平台。通过集成大语言模型（LLM），我们提供了从业务需求到技术规格的完整转换流程。

### 核心特性

- **🤖 AI 驱动的需求分析**: 集成 Claude、GPT 等大语言模型，智能化需求提取和分析
- **📋 结构化规格生成**: 基于 BMAD-Method 方法论，生成标准化的需求规格文档
- **🔄 迭代式优化**: 支持需求的持续迭代和优化，确保规格质量
- **🛠️ CLI 工具**: 提供命令行界面，方便集成到现有开发流程
- **📚 模板化管理**: 内置多种行业和场景的需求分析模板
- **🔗 可扩展架构**: 支持自定义 Agent 和插件扩展

## 📦 安装

### 前置要求

- Node.js >= 18.0.0
- pnpm (推荐) 或 npm

### 全局安装

```bash
npm install -g spec-bmad-cli
```

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/Spec-Kit/SpecBmad.git
cd SpecBmad

# 安装依赖
pnpm install

# 构建项目
pnpm build

# 运行测试
pnpm test
```

## 🎯 快速开始

### 1. 初始化项目

```bash
# 在你的项目目录中初始化 Spec-BMAD 环境
spec-bmad init

# 这将创建以下结构：
# .bmad-core/          # 核心配置和状态文件
# .specify/            # 规格文档存储目录
# templates/           # 模板文件目录
```

### 2. 生成需求规格

```bash
# 基于现有需求文档生成规格
spec-bmad specify --input requirements.md --output spec.md

# 交互式规格生成
spec-bmad specify --interactive

# 使用特定模板
spec-bmad specify --template web-app --input requirements.md
```

### 3. 配置 LLM 提供商

```bash
# 配置 OpenAI
export OPENAI_API_KEY="your-api-key"

# 配置 Claude (Anthropic)
export ANTHROPIC_API_KEY="your-api-key"

# 或者在配置文件中设置
# .bmad-core/config.json
```

## 📖 使用指南

### 命令行接口

```bash
# 查看所有可用命令
spec-bmad --help

# 查看特定命令的帮助
spec-bmad specify --help

# 查看版本信息
spec-bmad --version
```

### 配置文件

项目配置存储在 `.bmad-core/config.json` 中：

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4",
    "apiKey": "your-api-key"
  },
  "templates": {
    "defaultTemplate": "standard",
    "customTemplatesPath": "./templates"
  },
  "output": {
    "format": "markdown",
    "includeMetadata": true
  }
}
```

## 🏗️ 项目架构

```
src/
├── agents/          # AI Agent 实现
│   ├── base/        # 基础 Agent 类
│   ├── analyst/     # 需求分析 Agent
│   └── generator/   # 规格生成 Agent
├── commands/        # CLI 命令实现
│   ├── init.ts      # 项目初始化
│   └── specify.ts   # 规格生成
├── llm/            # LLM 客户端
│   ├── base.ts     # 抽象基类
│   ├── openai.ts   # OpenAI 集成
│   └── factory.ts  # 工厂模式
└── utils/          # 工具函数
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！请查看我们的[贡献指南](docs/社区参与和贡献指南.md)了解详细信息。

### 开发流程

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'feat: add amazing feature'`
4. 推送到分支: `git push origin feature/amazing-feature`
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript 进行开发
- 遵循 ESLint 和 Prettier 配置
- 编写单元测试
- 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范

## 📚 文档

- [技术规范与架构设计](docs/技术规范与架构设计.md)
- [实施步骤详细指南](docs/实施步骤详细指南.md)
- [测试策略与质量保证](docs/测试策略与质量保证.md)
- [项目时间线与里程碑](docs/项目时间线与里程碑.md)
- [风险评估与缓解策略](docs/风险评估与缓解策略.md)

## 🔗 相关链接

- [Spec-Kit 官方文档](https://spec-kit.org)
- [BMAD-Method 方法论](https://bmad-method.org)
- [项目路线图](docs/项目时间线与里程碑.md)
- [API 文档](docs/api/)

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- Spec-Kit 团队提供的结构化需求管理框架
- BMAD-Method 社区的业务建模方法论
- 所有贡献者和社区成员的支持

## 📞 联系我们

- 项目主页: [https://github.com/Spec-Kit/SpecBmad](https://github.com/Spec-Kit/SpecBmad)
- 问题反馈: [GitHub Issues](https://github.com/Spec-Kit/SpecBmad/issues)
- 社区讨论: [GitHub Discussions](https://github.com/Spec-Kit/SpecBmad/discussions)
- 邮箱: project-contact@example.com

---

⭐ 如果这个项目对你有帮助，请给我们一个 Star！