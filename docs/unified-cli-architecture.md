# SpecKit-BMAD 统一CLI架构设计

## 概述

本文档定义了 SpecKit-BMAD 整合项目的统一命令行接口架构，旨在将 Spec-Kit 的规范驱动开发和 BMAD-Method 的敏捷AI驱动方法论整合到一个统一的CLI工具中。

## 设计原则

1. **统一性**: 提供一致的命令接口和用户体验
2. **模块化**: 支持插件式的功能扩展
3. **兼容性**: 保持与原有工具的兼容性
4. **可扩展性**: 支持未来功能的添加和修改
5. **用户友好**: 提供清晰的帮助信息和错误提示

## 架构概览

```
speckit-bmad CLI
├── 核心命令 (Core Commands)
│   ├── init        - 项目初始化
│   ├── config      - 配置管理
│   ├── status      - 状态查看
│   └── agents      - AI代理管理
├── 规范驱动命令 (Spec-Driven Commands)
│   ├── specify     - 需求规格定义
│   ├── plan        - 技术方案设计
│   ├── tasks       - 任务分解
│   └── implement   - 代码实现
├── 敏捷工作流命令 (Agile Workflow Commands)
│   ├── analyze     - 项目分析
│   ├── sprint      - Sprint管理
│   ├── review      - 代码审查
│   └── deploy      - 部署管理
├── 质量保证命令 (Quality Assurance Commands)
│   ├── qa          - 质量检查
│   ├── test        - 测试执行
│   └── security    - 安全扫描
└── 工具命令 (Utility Commands)
    ├── bridge      - Python桥接
    ├── export      - 导出功能
    └── import      - 导入功能
```

## 命令详细设计

### 1. 核心命令 (Core Commands)

#### `speckit-bmad init <project-name>`
初始化新的SpecKit-BMAD项目

**选项**:
- `-t, --template <name>`: 项目模板 (web, mobile, game, enterprise)
- `-l, --language <lang>`: 主要编程语言
- `-f, --framework <fw>`: 开发框架
- `-s, --scale <level>`: 项目规模级别 (0-4)
- `-a, --agents <list>`: 启用的AI代理
- `--llm-provider <name>`: LLM提供商
- `-i, --interactive`: 交互式配置
- `--spec-first`: 规范优先模式
- `--bmad-first`: BMAD优先模式

#### `speckit-bmad config`
配置管理

**子命令**:
- `set <key=value>`: 设置配置项
- `get <key>`: 获取配置项
- `list`: 列出所有配置
- `reset`: 重置配置

**选项**:
- `--global`: 全局配置
- `--project`: 项目配置

#### `speckit-bmad agents`
AI代理管理

**子命令**:
- `list`: 列出所有代理
- `status`: 查看代理状态
- `enable <name>`: 启用代理
- `disable <name>`: 禁用代理
- `configure <name>`: 配置代理

### 2. 规范驱动命令 (Spec-Driven Commands)

#### `speckit-bmad specify`
需求规格定义 (基于Spec-Kit)

**选项**:
- `-i, --input <file>`: 输入需求文件
- `-o, --output <file>`: 输出规格文件
- `-a, --agent <name>`: 执行代理
- `-t, --template <name>`: 规格模板
- `--interactive`: 交互式收集
- `--constitution`: 生成项目治理原则

#### `speckit-bmad plan`
技术方案设计

**选项**:
- `-i, --input <file>`: 输入规格文件
- `-o, --output <file>`: 输出方案文件
- `-a, --agent <name>`: 执行代理
- `--architecture`: 架构设计模式
- `--interactive`: 交互式设计

#### `speckit-bmad tasks`
任务分解

**选项**:
- `-i, --input <file>`: 输入方案文件
- `-o, --output <file>`: 输出任务文件
- `-a, --agent <name>`: 执行代理
- `--priority`: 按优先级排序
- `--estimate`: 包含工作量估算

### 3. 敏捷工作流命令 (Agile Workflow Commands)

#### `speckit-bmad analyze`
项目分析 (基于BMAD-Method)

**选项**:
- `--brainstorm`: 头脑风暴模式
- `--research`: 研究分析模式
- `--brief`: 生成项目简报
- `-a, --agent <name>`: 分析代理 (PM, Analyst)

#### `speckit-bmad sprint`
Sprint管理

**子命令**:
- `create`: 创建新Sprint
- `plan`: Sprint规划
- `review`: Sprint回顾
- `retrospective`: Sprint复盘

#### `speckit-bmad review`
代码审查

**选项**:
- `-f, --file <path>`: 审查文件
- `-a, --agent <name>`: 审查代理
- `--type <type>`: 审查类型 (code, architecture, security)

### 4. 质量保证命令 (Quality Assurance Commands)

#### `speckit-bmad qa`
质量检查

**选项**:
- `-t, --type <type>`: 检查类型
- `-f, --file <path>`: 检查文件
- `-a, --agent <name>`: QA代理
- `--fix`: 自动修复

#### `speckit-bmad test`
测试执行

**子命令**:
- `unit`: 单元测试
- `integration`: 集成测试
- `e2e`: 端到端测试
- `performance`: 性能测试

### 5. 工具命令 (Utility Commands)

#### `speckit-bmad bridge`
Python桥接管理

**子命令**:
- `setup`: 设置Python环境
- `install`: 安装Python依赖
- `test`: 测试桥接连接
- `status`: 桥接状态

## 配置系统设计

### 配置文件层次

1. **全局配置**: `~/.speckit-bmad/config.yaml`
2. **项目配置**: `<project>/.speckit-bmad/config.yaml`
3. **环境变量**: `SPECKIT_BMAD_*`

### 配置结构

```yaml
# SpecKit-BMAD 配置文件
project:
  name: "项目名称"
  type: "web|mobile|game|enterprise"
  scale_level: 0-4
  language: "typescript"
  framework: "react"

# Spec-Kit 配置
spec_kit:
  enabled: true
  ai_agent: "claude|copilot|cursor"
  templates_path: "./templates"
  constitution_file: "./constitution.md"

# BMAD-Method 配置
bmad_method:
  enabled: true
  active_modules: ["bmm", "bmb", "cis"]
  agents_config: "./bmad/_cfg/agents"
  workflow_mode: "standard|accelerated"

# AI 代理配置
agents:
  pm:
    enabled: true
    model: "gpt-4"
    config: {}
  analyst:
    enabled: true
    model: "claude-3"
    config: {}
  architect:
    enabled: true
    model: "gpt-4"
    config: {}

# 集成配置
integration:
  workflow_mode: "hybrid|spec_first|bmad_first"
  output_format: "markdown|yaml|json"
  bridge_mode: "subprocess|api|direct"

# LLM 提供商配置
llm_providers:
  openai:
    api_key: "${OPENAI_API_KEY}"
    model: "gpt-4"
  anthropic:
    api_key: "${ANTHROPIC_API_KEY}"
    model: "claude-3-sonnet"
```

## 插件系统设计

### 插件接口

```typescript
interface SpecKitBmadPlugin {
  name: string;
  version: string;
  description: string;
  
  // 命令扩展
  commands?: CommandDefinition[];
  
  // 代理扩展
  agents?: AgentDefinition[];
  
  // 模板扩展
  templates?: TemplateDefinition[];
  
  // 生命周期钩子
  hooks?: {
    beforeInit?: () => Promise<void>;
    afterInit?: () => Promise<void>;
    beforeCommand?: (command: string) => Promise<void>;
    afterCommand?: (command: string, result: any) => Promise<void>;
  };
}
```

### 插件加载机制

1. **内置插件**: 核心功能插件
2. **本地插件**: 项目特定插件
3. **全局插件**: 用户安装的插件
4. **远程插件**: 从注册表安装的插件

## 错误处理和日志

### 错误处理策略

1. **优雅降级**: 部分功能失败时继续执行
2. **详细错误信息**: 提供可操作的错误提示
3. **错误恢复**: 自动重试和恢复机制
4. **用户友好**: 避免技术术语，提供解决建议

### 日志系统

```typescript
// 日志级别
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

// 日志配置
interface LogConfig {
  level: LogLevel;
  file?: string;
  console: boolean;
  format: 'json' | 'text';
}
```

## 性能优化

### 启动优化

1. **延迟加载**: 按需加载命令模块
2. **缓存机制**: 缓存配置和元数据
3. **并行初始化**: 并行加载插件和代理

### 执行优化

1. **异步处理**: 非阻塞的命令执行
2. **进度显示**: 长时间操作的进度反馈
3. **资源管理**: 合理的内存和CPU使用

## 测试策略

### 测试类型

1. **单元测试**: 命令和工具函数测试
2. **集成测试**: 命令组合和工作流测试
3. **端到端测试**: 完整用户场景测试
4. **性能测试**: 启动时间和执行效率测试

### 测试工具

- **Jest**: 单元测试框架
- **Supertest**: CLI测试工具
- **Playwright**: 端到端测试
- **Benchmark.js**: 性能测试

## 部署和分发

### 分发方式

1. **NPM包**: 主要分发方式
2. **二进制文件**: 独立可执行文件
3. **Docker镜像**: 容器化部署
4. **Homebrew**: macOS包管理器

### 版本管理

- **语义化版本**: 遵循SemVer规范
- **发布渠道**: stable, beta, alpha
- **向后兼容**: 保持API稳定性

## 文档和帮助

### 帮助系统

1. **内置帮助**: `--help` 选项
2. **交互式帮助**: 引导式操作
3. **在线文档**: 详细使用指南
4. **示例项目**: 最佳实践示例

### 文档结构

- **快速开始**: 5分钟上手指南
- **用户指南**: 详细功能说明
- **开发者指南**: 插件开发文档
- **API参考**: 完整API文档

---

**文档版本**: 1.0  
**最后更新**: 2025年1月27日  
**状态**: 设计阶段

## 统一 CLI 与桥接（更新）
- 解释器检测：优先使用 `python`，不可用时自动回退 `python3`
- 桥接调用：Node CLI 构造参数并调用 `python/bmad_bridge.py`
- 产物位置：`.bmad/artifacts/analysis.json|planning.json|solution.json|bmm.json`

### 参数规范（对齐 Python 端）
- analyze：`--mode brainstorm|research|brief|comprehensive`，`--agent`
- plan：`--type architecture|business|technical|resource|timeline`，`--agent`，`--scale 0-4`
- solution：`--type implementation|optimization|migration|integration|deployment`，`--depth 1|2|3|4|5`，`--agent`
- bmm：`--operation analyze|optimize|validate|evolve|compare`，`--output json|yaml|text`，`--agent`

### 配置一致性
- 运行前需调用 `config.load()` 获取项目配置，再进行启用检查 `projectConfig.bmad_method?.enabled`
- 当前 Python 端提示缺少 `/.specbmad/config.json`，仓库存在 `/.specbmad.json`；建议统一路径与格式并在文档中注明