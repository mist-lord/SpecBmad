# SpecKit-BMAD 🚀

**SpecKit-BMAD** 是一个全自动化的 AI 软件工程助手。只需一句话需求，它就能为你生成完整的项目架构、规格文档、代码实现并自动运行。

---

## 🛠️ 快速开始 (3步起飞)

### 1. 安装依赖
```bash
pnpm install
pnpm run build
```

### 2. 设置 API 密钥
复制模板并填写你的 OpenAI 密钥：
```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 OPENAI_API_KEY
```

### 3. 一键生成并运行
```bash
# 示例：创建一个简单的 Todo CLI 工具
node dist/index.js go "创建一个简单的 Todo CLI 工具，支持增删改查" -r
```

---

## 📖 傻瓜式常用命令

为了降低使用门槛，你只需要记住以下 4 个核心命令：

| 命令 | 简写示例 | 用途 |
| :--- | :--- | :--- |
| **一键生成** | `go "需求" -r` | **核心命令**：从需求到代码自动完成并运行 |
| **需求变更** | `change create` | 当你想要在现有项目上添加新功能时使用 |
| **可视化** | `ui start` | 启动网页版控制面板，查看项目进度和产物 |
| **环境检查** | `doctor` | 检查 API 密钥、Node 环境等是否配置正确 |

---

## 📂 项目产物说明

运行 `go` 命令后，你可以在以下目录查看产物：
- `generated/project/`: **生成的源代码**。
- `.specbmad/specifications/`: AI 生成的**规格说明书**（Markdown 格式）。
- `.specbmad/artifacts/`: 包含分析报告、设计图和执行日志。
- `docs/项目说明书.md`: 自动生成的项目用户文档。

---

## 🤖 进阶：人工审查模式

如果你希望在 AI 写代码之前先看一眼它设计的“规格说明书”，可以使用 `-v` 参数：
```bash
node dist/index.js go "我的复杂需求" -v
```
AI 会在完成设计后暂停，询问你是否满意，确认后才会开始写代码。

---

## 🔗 更多资源
- [架构设计文档](./docs/ARCHITECTURE.md) - 深入了解 Agent 协作机制
- [CLI 参数精简手册](./docs/用户使用手册.md) - 查看所有可用参数
