# CLI 使用说明

本文档汇总 SpecKit-BMAD 统一 CLI 的主要命令、参数与示例，覆盖 Node→Python 桥接的当前实现状态。

## 通用说明
- 解释器检测：优先 `python`，不可用时回退 `python3`
- 产物目录：`.bmad/artifacts/`，包含 `analysis.json`、`planning.json`、`solution.json`、`bmm.json`
- 配置提示：当前日志提示缺少 `/.specbmad/config.json`；可通过 `config --interactive` 初始化，后续建议统一配置路径与格式

## analyze
- 参数
  - `--mode`：`brainstorm|research|brief|comprehensive`（默认：`brief`）
  - `--agent`：分析代理（默认：`Analyst`）
  - `--output`：输出路径（可选）
  - `--verbose`：详细输出（可选）
- 示例
  - `node dist/index.js analyze --mode brief --agent Analyst --verbose`

## plan
- 参数
  - `--type`：`architecture|business|technical|resource|timeline`（默认：`technical`）
  - `--agent`：规划代理（默认：`PM`）
  - `--scale`：规模级别 `0-4`（默认：`1`）
  - `--output`：输出路径（可选）
  - `--verbose`：详细输出（可选）
- 示例
  - `node dist/index.js plan --type technical --agent PM --scale 2 --verbose`

## solution
- 参数
  - `--type`：`implementation|optimization|migration|integration|deployment`（默认：`implementation`）
  - `--agent`：解决方案代理（默认：`Architect`）
  - `--depth`：`1|2|3|4|5`（默认：`3`）
  - `--output`：输出路径（可选）
  - `--verbose`：详细输出（可选）
- 示例
  - `node dist/index.js solution --type implementation --agent Architect --depth 3 --verbose`

## bmm
- 参数
  - `--operation`：`analyze|optimize|validate|evolve|compare`（默认：`analyze`）
  - `--agent`：BMM 代理（默认：`BusinessAnalyst`）
  - `--output`：`json|yaml|text`（默认：`json`）
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

## config
- 参数
  - `--interactive`：交互式配置
  - 其他：`--get`、`--set`、`--value`、`--list`、`--validate`、`--migrate`、`--reset`、`--global`
- 示例
  - `node dist/index.js config --interactive`