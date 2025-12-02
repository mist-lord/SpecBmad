# Agent 使用示例

## 🎯 快速开始

### 1. 基本使用

```typescript
import { AgentFactory } from '@/agents/factory';
import { registerBuiltInAgents } from '@/agents';
import { llmManager } from '@/core/llm/manager';

// 初始化
await llmManager.initialize();
registerBuiltInAgents();

// 创建 Agent
const client = llmManager.getDefaultClient();
const analyst = AgentFactory.create('Analyst', client!);

// 执行任务
const result = await analyst.execute({
  projectState: {
    projectName: 'my-project',
    workflow: {}
  },
  workingDirectory: process.cwd(),
  inputData: {
    prompt: '创建一个待办事项应用',
    mode: 'technical'
  }
});

console.log(result.output);
console.log(result.nextSteps);
```

### 2. 使用 Security Expert Agent（新增）

```typescript
import { AgentFactory } from '@/agents/factory';
import { registerBuiltInAgents } from '@/agents';
import { llmManager } from '@/core/llm/manager';

// 初始化
await llmManager.initialize();
registerBuiltInAgents();

// 创建 Security Expert Agent
const client = llmManager.getDefaultClient();
const securityExpert = AgentFactory.create('SecurityExpert', client!);

// 执行安全分析
const result = await securityExpert.execute({
  projectState: {
    projectName: 'e-commerce-api',
    stack: 'typescript',
    type: 'api'
  },
  workingDirectory: process.cwd(),
  inputData: {
    prompt: '设计一个电商 API 的安全方案',
    mode: 'comprehensive'  // comprehensive | quick | compliance
  }
});

console.log('安全分析结果:', result.output);
console.log('风险等级:', result.metadata?.riskLevel);
console.log('下一步建议:', result.nextSteps);
```

### 3. 在工作流中使用多个 Agent

```typescript
import { Orchestrator } from '@/workflow/orchestrator';

const workflowSteps = [
  {
    id: 'analysis',
    name: '需求分析',
    agent: 'Analyst',
    inputData: {
      prompt: '创建一个待办事项应用',
      mode: 'technical'
    }
  },
  {
    id: 'architecture',
    name: '架构设计',
    agent: 'Architect',
    inputData: {
      prompt: '设计系统架构',
      mode: 'detailed'
    }
  },
  {
    id: 'security',
    name: '安全审计',
    agent: 'SecurityExpert',  // 使用新的 Security Expert
    inputData: {
      prompt: '进行安全审计',
      mode: 'comprehensive'
    }
  },
  {
    id: 'development',
    name: '代码实现',
    agent: 'Developer',
    inputData: {
      prompt: '实现核心功能',
      mode: 'iterative'
    }
  },
  {
    id: 'qa',
    name: '质量保证',
    agent: 'QA',
    inputData: {
      prompt: '设计测试策略',
      mode: 'comprehensive'
    }
  }
];

const orchestrator = new Orchestrator();
const results = await orchestrator.executeWorkflow({
  name: 'full-development',
  steps: workflowSteps
});
```

## 📋 可用的 Agent 列表

### 查看所有已注册的 Agent

```typescript
import { AgentFactory } from '@/agents/factory';

const agents = AgentFactory.getAvailableAgents();
console.log('Available agents:', agents);
// 输出: ['Analyst', 'Architect', 'Developer', 'QA', 'ScrumMaster', 'SecurityExpert', ...]
```

### 检查 Agent 是否存在

```typescript
if (AgentFactory.has('SecurityExpert')) {
  const agent = AgentFactory.create('SecurityExpert', client);
}
```

## 🎨 不同 Agent 的使用场景

### Analyst - 需求分析

```typescript
const analyst = AgentFactory.create('Analyst', client);

const result = await analyst.execute({
  projectState: { projectName: 'todo-app', workflow: {} },
  workingDirectory: process.cwd(),
  inputData: {
    prompt: '创建一个待办事项应用，支持添加、删除、标记完成',
    mode: 'technical'  // brief | technical | brainstorm
  }
});
```

### Architect - 架构设计

```typescript
const architect = AgentFactory.create('Architect', client);

const result = await architect.execute({
  projectState: {
    projectName: 'todo-app',
    stack: 'typescript',
    workflow: {}
  },
  workingDirectory: process.cwd(),
  inputData: {
    prompt: '设计微服务架构',
    mode: 'detailed'
  }
});
```

### Developer - 代码实现

```typescript
const developer = AgentFactory.create('Developer', client);

const result = await developer.execute({
  projectState: { projectName: 'todo-app', workflow: {} },
  workingDirectory: process.cwd(),
  inputData: {
    prompt: '实现待办事项的 CRUD 操作',
    mode: 'iterative'
  }
});
```

### QA - 质量保证

```typescript
const qa = AgentFactory.create('QA', client);

const result = await qa.execute({
  projectState: { projectName: 'todo-app', workflow: {} },
  workingDirectory: process.cwd(),
  inputData: {
    prompt: '设计测试策略和测试用例',
    mode: 'comprehensive'
  }
});
```

### Security Expert - 安全审计（新增）

```typescript
const securityExpert = AgentFactory.create('SecurityExpert', client);

// 全面安全分析
const comprehensiveResult = await securityExpert.execute({
  projectState: {
    projectName: 'payment-api',
    stack: 'typescript',
    type: 'api'
  },
  workingDirectory: process.cwd(),
  inputData: {
    prompt: '设计支付 API 的安全方案',
    mode: 'comprehensive'
  }
});

// 快速安全检查
const quickResult = await securityExpert.execute({
  projectState: { projectName: 'simple-app', workflow: {} },
  workingDirectory: process.cwd(),
  inputData: {
    prompt: '快速检查主要安全风险',
    mode: 'quick'
  }
});

// 合规性检查
const complianceResult = await securityExpert.execute({
  projectState: { projectName: 'healthcare-app', workflow: {} },
  workingDirectory: process.cwd(),
  inputData: {
    prompt: '检查是否符合 HIPAA 和 GDPR 要求',
    mode: 'compliance'
  }
});
```

## 🔄 Agent 链式调用

```typescript
// 先分析需求
const analysisResult = await analyst.execute({
  projectState: { projectName: 'todo-app', workflow: {} },
  workingDirectory: process.cwd(),
  inputData: { prompt: '创建待办应用', mode: 'technical' }
});

// 基于分析结果设计架构
const architectureResult = await architect.execute({
  projectState: {
    projectName: 'todo-app',
    workflow: { currentStep: 'architecture' }
  },
  workingDirectory: process.cwd(),
  inputData: {
    prompt: analysisResult.output,  // 使用分析结果
    mode: 'detailed'
  }
});

// 进行安全审计
const securityResult = await securityExpert.execute({
  projectState: {
    projectName: 'todo-app',
    workflow: { currentStep: 'security' }
  },
  workingDirectory: process.cwd(),
  inputData: {
    prompt: architectureResult.output,  // 基于架构进行安全分析
    mode: 'comprehensive'
  }
});
```

## 📊 获取 Agent 指标

```typescript
const result = await agent.execute(context);

// 获取 LLM 调用指标
const metrics = result.metadata?.metrics;
console.log('Token 使用:', {
  input: metrics?.inputTokens,
  output: metrics?.outputTokens,
  total: (metrics?.inputTokens || 0) + (metrics?.outputTokens || 0)
});
console.log('延迟:', metrics?.latencyMs, 'ms');
console.log('成本:', '$', metrics?.costUSD);
```

## 🎯 最佳实践

1. **选择合适的 Agent**: 根据任务类型选择对应的 Agent
2. **使用正确的模式**: 不同模式适用于不同场景
   - `brief`: 快速概览
   - `technical`: 技术细节
   - `comprehensive`: 全面分析
3. **链式调用**: 让 Agent 之间协作，传递上下文
4. **监控指标**: 关注 Token 使用和成本
5. **错误处理**: 利用 BaseAgent 的内置重试机制

## 🚀 下一步

- 查看 [如何添加新Agent](./如何添加新Agent.md) 了解如何扩展系统
- 查看 [工作流系统](./系统流程与架构图.md) 了解如何编排多个 Agent
- 查看 [技术规范](./技术规范与架构设计.md) 了解系统架构

---

**开始使用多 Agent 系统，让 AI 协作完成复杂任务！** 🎉

