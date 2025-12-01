# Agent 配置文件说明

本文档说明项目级配置（`.specbmad/config.json`）中与 Agent、LLM 相关的关键字段与示例，帮助你自定义代理与模型行为。

## 配置文件位置
- 项目级：`<repo>/.specbmad/config.json`
- （可选）全局级：`~/.speckit-bmad/config.json`（当前实现以项目级为主）

## 顶层结构示例
```json
{
  "project": {
    "name": "Demo Project",
    "language": "typescript"
  },
  "llm": {
    "default": "Mock",
    "providers": {
      "Claude": {
        "model": "claude-3-sonnet-20240229",
        "apiKeyEnv": "ANTHROPIC_API_KEY"
      },
      "Mock": {
        "model": "mock-1",
        "notes": "用于离线/快速演示，结合 BMAD_MOCK_LLM=1"
      }
    }
  },
  "agents": {
    "Developer": {
      "type": "built-in",
      "model": "default",
      "capabilities": ["code-implementation", "tdd", "refactoring", "unit-testing", "code-review"],
      "systemPrompt": "You are a senior Software Developer."
    },
    "ScrumMaster": {
      "type": "built-in",
      "model": "default",
      "capabilities": ["sprint-planning", "story-refinement"],
      "systemPrompt": "You are a Scrum Master."
    },
    "QA": {
      "type": "built-in",
      "model": "default",
      "capabilities": ["quality-assurance", "testing", "security", "performance"],
      "systemPrompt": "You ensure quality."
    },
    "aliases": {
      "Implementation": "Developer"
    }
  },
  "workflows": {
    "full-development": {
      "description": "端到端开发流（计划→实施→QA）",
      "steps": [
        { "id": "sprint-plan", "name": "Sprint Planning", "agent": "ScrumMaster", "input": { "mode": "plan" } },
        { "id": "story-refine", "name": "Story Refinement", "agent": "ScrumMaster", "input": { "mode": "refine" }, "dependencies": ["sprint-plan"] },
        { "id": "implementation", "name": "Implementation", "agent": "Implementation", "dependencies": ["story-refine"] },
        { "id": "qa-validation", "name": "QA Validation", "agent": "QA", "dependencies": ["implementation"] }
      ]
    }
  }
}
```

## 关键说明
- `llm.default`：默认 LLM 客户端。设置为 `Mock` 时，可配合环境变量 `BMAD_MOCK_LLM=1` 进行离线运行。
- `agents.aliases`：命令别名与工作流步骤均支持。`Implementation` 等价于 `Developer`。
- `workflows.steps[].agent`：可以使用别名，最终由 AgentFactory 解析到具体实现类。

## 使用示例
- CLI 指定代理：`node dist/index.js implement --agent Implementation`
- 工作流使用别名：见上述 `workflows.full-development` 示例中 `implementation` 步骤。