# SpecBmad 项目改造规划方案 (基于 Unified Architecture v2)

## 1. 现状分析报告

### 1.1 代码结构分析
当前项目 `SpecBmad` 是一个基于 Node.js/TypeScript 的 AI 工程辅助工具。
- **入口层**：拥有丰富的 CLI 命令 (`src/commands`)。
- **执行层**：具备代理工厂 (`src/agents`) 和多种角色代理。
- **核心引擎**：包含工作流编排器 (`Orchestrator`) 和 LLM 管理器 (`LLMManager`)。

### 1.2 技术栈比对
| 维度 | 当前现状 (SpecBmad) | 目标规范 (v2 Architecture) |
| :--- | :--- | :--- |
| **编程语言** | Node.js (TypeScript) | Node.js + Python + C++ |
| **需求处理** | 基于 Prompt 的 `specify` | **Spec-Kit** (Python) |
| **规范验证** | 无形式化验证 | **OpenSpec** (Python) |

## 2. 改造目标说明
- **Spec First**：强制先有 Spec 再有代码。
- **多语言协同**：引入 Python 负责逻辑推理与规范处理。
- **确定性验证**：引入 OpenSpec 和 DeepCode 确保代码质量。

## 3. 详细实施计划

### 第一阶段：架构重构与状态机建立
- 实现 Phase 0-5 状态切换逻辑。
- 建立基于日志的 Event Store。

### 第二阶段：多语言集成与 Spec-Kit 落地
- 集成 Python 环境。
- 改造 `specify` 命令，输出标准 `intent.yaml`。

### 第三阶段：OpenSpec 与形式化验证
- 集成 Python 版 OpenSpec。
- 实现验证失败时的强制阻断机制。

## 4. 里程碑节点
- **M1**: 核心编排逻辑完成。
- **M2**: Python 桥接与 Spec-Kit 集成。
- **M3**: 完整 V2 工作流闭环。

---
*请手动创建此文件以继续后续工作。*