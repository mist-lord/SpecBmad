# Spec-Kit 真正整合实施计划

## 背景

### 问题总结
1. **当前实现**：SpecBmad 只有简单 YAML 解析器，未对接官方 CLI
2. **官方 Spec-Kit**：提供完整 SDD 工作流（specify CLI + slash commands）
3. **Codex 分析**：指出当前只是"概念借壳"，未实现核心闭环
4. **市场趋势**：2026 年 Spec-Driven Development 成为主流

### 核心理念
> "不要重新发明 Spec-Kit，而是集成它成为 SpecBmad 的工作流引擎"

---

## 短期目标（1-2周）：验证集成

### 阶段 1：官方 CLI 集成

#### 任务 1.1：创建官方 CLI 调用封装
- [ ] 创建 `src/core/spec/spec-kit-official.ts`
  - [ ] 实现 `initializeProject()` 方法（调用 `specify init`）
  - [ ] 实现 `runCommand()` 方法（调用 `/speckit.*`）
  - [ ] 实现 `isInitialized()` 检测方法
  - [ ] 添加错误处理和日志

#### 任务 1.2：修改 init 命令
- [ ] 修改 `src/commands/init.ts`
  - [ ] 添加 `--use-spec-kit` 选项
  - [ ] 添加检测逻辑（是否已有 .specify 目录）
  - [ ] 集成 SpecKitOfficialClient

#### 任务 1.3：配置文件支持
- [ ] 更新 `spec/phase_transitions.yaml`
  - [ ] 添加 Spec-Kit 集成选项
  - [ ] 添加默认 AI agent 选择

#### 任务 1.4：测试验证
- [ ] 测试 `specify init` 调用
- [ ] 验证 `.specify` 目录结构生成
- [ ] 测试 `/speckit.constitution` 等命令可用性

---

## 中期目标（3-8周）：深度集成

### 阶段 2：命令路由兼容层

#### 任务 2.1：创建 Spec-Kit 桥接层
- [ ] 创建 `src/core/spec/spec-kit-bridge.ts`
  - [ ] 实现 SpecBmad 命令到 Spec-Kit 命令的映射
  - [ ] 实现 `detectCommands()` 检测可用命令
  - [ ] 实现 `execute()` 执行映射后的命令

#### 任务 2.2：Phase Controller 改造
- [ ] 修改 `src/core/phase/controller.ts`
  - [ ] 集成 SpecKitBridge
  - [ ] 在每个 phase 调用对应的 Spec-Kit 命令
  - [ ] 添加 Spec-Kit 产物路径检测

#### 任务 2.3：统一 Artifact 管理
- [ ] 更新路径常量 `src/utils/paths.ts`
  - [ ] 添加 `.specify/` 路径支持
  - [ ] 统一 SpecBmad 和 Spec-Kit 的 artifact 管理

---

## 长期目标（9-12周）：生态化

### 阶段 3：MCP Server 实现

#### 任务 3.1：创建 MCP Server 包
- [ ] 创建 `packages/@specbmad/mcp-gate/`
  - [ ] 实现 `verify_spec_compliance` tool
  - [ ] 实现 `check_gate` tool
  - [ ] 实现 `run_phase` tool
  - [ ] 添加 `resources`（spec 文件）

#### 任务 3.2：Claude Desktop 集成
- [ ] 创建配置示例 `~/.claude/claude_desktop_config.json`
  - [ ] 添加 MCP servers 配置
  - [ ] 编写集成文档

#### 任务 3.3：Codex 集成增强
- [ ] 扩展 Codex 集成以支持 Spec-Kit 产物
- [ ] 添加规范完整性检查
- [ ] 添加架构合规性验证

---

## 成功标准

每个阶段完成标准：
- ✅ 代码实现完成
- ✅ TypeScript 类型检查通过
- ✅ ESLint 检查通过
- ✅ 功能测试通过
- ✅ 文档更新完成

---

## 进度跟踪

- **总任务数**: 19
- **已完成**: 0
- **进行中**: 0
- **待开始**: 19

---

*最后更新时间: 2026-02-05*
