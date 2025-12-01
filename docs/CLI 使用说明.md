# CLI 使用说明

本文档汇总 SpecKit-BMAD 统一 CLI 的主要命令、参数与示例，覆盖 Node→Python 桥接的当前实现状态。

## 通用说明
- 解释器检测：优先 `python`，不可用时回退 `python3`
- 产物目录：`.bmad/artifacts/`，包含 `analysis.json`、`planning.json`、`solution.json`、`bmm.json`、`qa.md|qa.json`、`deploy.md|deploy.json`
- 环境变量：`BMAD_MOCK_LLM=1` 用于在 CI 或本地避免外部 API 引入不确定性
- CI 冒烟门：构建后运行 `pnpm run ci:cli-smoke-gate`（自动开启 `BMAD_MOCK_LLM=1`），依次校验四类产物，失败会阻断 CI。

### 公共选项与约定
- `--verbose`：启用详细日志输出
- 输出语义统一（核心命令）：`analyze/plan/solution/bmm` 使用 `--output <format>` 指定输出格式（`json|markdown|detailed`）。
  - Python 桥接模式：结果写入 `.bmad/artifacts/` 对应 JSON 产物。
  - 直连模式（仅 `analyze`、`plan`）：支持 `--out-file <path>` 将完整结果写文件；未指定时控制台打印摘要。
- 报告类命令（`report`、`workflow`）沿用 `--format` 与 `--output <file>`/`--report-dir` 语义。

## analyze
- 参数
  - `--mode`：`comprehensive|business|technical|stakeholder|risk`（默认：`technical`）
  - `--agent`：分析代理（默认：`Analyst`）
  - `--output`：输出格式（`json|markdown|detailed`，默认：`json`）
  - `--out-file <path>`：输出文件（仅直连模式）
  - `--verbose`：详细输出（可选）
- 示例
  - Python桥接产物：`node dist/index.js analyze --mode technical --agent Analyst --output json --verbose`
  - 直连模式写文件：`node dist/index.js analyze --mode technical --output markdown --out-file docs/analysis.md`

## plan
- 参数
  - `--type`：`architecture|business|technical|resource|timeline`（默认：`technical`）
  - `--agent`：规划代理（默认：`Architect`）
  - `--scale`：规模级别 `0-4`（默认：`1`）
  - `--output`：输出格式（`json|markdown|detailed`，默认：`json`）
  - `--out-file <path>`：输出文件（仅直连模式）
  - `--verbose`：详细输出（可选）
- 示例
  - Python桥接产物：`node dist/index.js plan --type technical --agent Architect --scale 2 --output json --verbose`
  - 直连模式写文件：`node dist/index.js plan --type technical --output markdown --out-file docs/planning.md`

## solution
- 参数
  - `--type`：`implementation|optimization|migration|integration|deployment`（默认：`implementation`）
  - `--agent`：解决方案代理（默认：`Architect`）
  - `--depth`：`1|2|3|4|5`（默认：`3`）
  - `--output`：输出格式（`json|markdown|detailed`，默认：`json`）
  - `--verbose`：详细输出（可选）
- 示例
  - `node dist/index.js solution --type implementation --agent Architect --depth 3 --output json --verbose`

## bmm
- 参数
  - `--operation`：`analyze|optimize|validate|evolve|compare`（默认：`analyze`）
  - `--agent`：BMM 代理（默认：`BusinessAnalyst`）
  - `--output`：`json|markdown|detailed`（默认：`json`）
  - `--verbose`：详细输出（可选）
- 示例
  - `node dist/index.js bmm --operation analyze --agent BusinessAnalyst --output json --verbose`

## report（新）
- 功能
  - 汇总 `.bmad/artifacts/` 下的 `analysis.json`、`planning.json`、`solution.json`、`bmm.json`，生成汇总报告
- 参数
  - `--output <file>`：输出报告文件（默认：`docs/最新运行报告.md`）
  - `--format <fmt>`：输出格式（`markdown|json`，默认：`markdown`）
- 示例
  - `node dist/index.js report --output docs/最新运行报告.md`

## workflow（新）
- 功能
  - 执行预定义或配置化工作流，生成摘要产物
- 参数
  - `--name <workflow>`：工作流名称（支持内置与配置自定义）
  - `--format <fmt>`：`markdown|json`（默认：`json`；非法值回退为 `json`）
  - `--report-dir <dir>`：输出目录，自动文件名（`workflow.md|workflow.json`）
  - `--output <file>`：完整输出路径（优先级高于 `--report-dir`）
  - `--resume`：从上次失败处恢复执行（读取 `.bmad/workflow.state.json`）
  - `--resume-file <file>`：指定状态文件路径（默认 `.bmad/workflow.state.json`）
- 示例
  - `node dist/index.js workflow --name planning-only --format markdown --report-dir .bmad/artifacts`
  - `node dist/index.js workflow --name custom-demo --format json --report-dir .bmad/artifacts`
- 说明
  - 当未指定 `--output` 与 `--report-dir` 时，控制台打印摘要（截断版）。
  - 工作流定义可在项目配置的 `workflows` 字段中声明，优先于内置。

## config
- 参数
  - `--interactive`：交互式配置
  - 其他：`--get`、`--set`、`--value`、`--list`、`--validate`、`--migrate`、`--reset`、`--global`
- 示例
  - `node dist/index.js config --interactive`

## qa（更新）
- 功能
  - 执行质量保证检查，支持修复建议，默认写入 `.bmad/artifacts/qa.md|qa.json`
- 参数
  - `--type <string>`：检查类型（示例：`unit`），默认 `unit`
  - `--file <path>`：针对文件的检查（可选）
  - `--agent <name>`：QA 代理（默认：`QA`）
  - `--fix`：尝试生成修复建议（可选）
  - `--format <fmt>`：`markdown|json`（默认：`markdown`）
  - `--output <file>`：写入指定文件（优先级高于 `--report-dir`）
  - `--report-dir <dir>`：输出目录，自动文件名（`qa.md|qa.json`）
- 示例
  - `node dist/index.js qa --type unit --format markdown`
  - `node dist/index.js qa --type unit --format json --report-dir .bmad/artifacts`

## deploy（新）
- 功能
  - 生成部署计划，支持干跑与回滚模式；默认写入 `.bmad/artifacts/deploy*.md|json`
- 参数
  - `--env <dev|staging|prod>`：部署环境（默认：`dev`）
  - `--strategy <rolling|canary|blue-green>`：策略（默认：`rolling`）
  - `--dry-run`：干跑，仅生成计划不执行构建/测试
  - `--rollback`：执行回滚计划
  - `--build`：在非干跑时先构建
  - `--skip-tests`：跳过基础测试
  - `--tag <string>`：版本标签（可选）
  - `--format <fmt>`：`json|markdown`（默认：`json`）
  - `--output <file>`：写入指定文件（优先级高于 `--report-dir`）
  - `--report-dir <dir>`：输出目录，自动文件名（`deploy.md|deploy.json` 或 `deploy-rollback.*`）
- 示例
  - `node dist/index.js deploy --env staging --strategy blue-green --dry-run --format markdown`
  - `node dist/index.js deploy --rollback --format json --report-dir .bmad/artifacts`
- 说明
  - 执行成功后会将最后一次部署信息写入 `.bmad/workflow.state.json`，供工作流参考。