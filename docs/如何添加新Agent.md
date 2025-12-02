# 如何添加新的 Agent

## 📋 概述

SpecBmad 支持多 Agent 架构，你可以轻松添加新的 Agent 来扩展系统功能。

## 🎯 当前已支持的 Agent

| Agent | 角色 | 能力 |
|-------|------|------|
| **Analyst** | 业务分析师 | 需求分析、利益相关者分析、风险识别、用户故事创建 |
| **Architect** | 架构师 | 系统设计、技术选型、架构决策、技术方案 |
| **Developer** | 开发者 | 代码实现、代码审查、重构、技术债务管理 |
| **QA** | 质量保证 | 测试策略、测试用例设计、质量评估、缺陷分析 |
| **Scrum Master** | Scrum 主管 | 任务分解、排期、风险管理、团队协调 |

## 🚀 添加新 Agent 的步骤

### 步骤 1: 创建 Agent 类文件

在 `src/agents/` 目录下创建新的 Agent 文件，例如 `src/agents/security-expert.ts`:

```typescript
import { BaseAgent } from '@/agents/base/agent';
import { AgentContext, AgentResult, LLMClient, LLMOptions } from '@/types';
import { AgentFactory } from '@/agents/factory';
import { log } from '@/utils/logger';

export class SecurityExpertAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super(
      'SecurityExpert',           // Agent 名称
      'Security Expert',          // 角色描述
      [                           // 能力列表
        'security-audit',
        'vulnerability-assessment',
        'security-design',
        'compliance-check',
        'threat-modeling'
      ],
      llmClient
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    // 1. 构建提示词
    const prompt = this.buildSecurityPrompt(context);
    
    // 2. 配置 LLM 选项
    const options: LLMOptions = {
      model: undefined,           // 使用默认模型
      temperature: 0.2,           // 较低温度，更确定性
      maxTokens: 2000,
      context: []
    };

    // 3. 生成响应
    const output = await this.generateResponse(prompt, context, options);

    // 4. 提取下一步建议
    const nextSteps = this.extractNextSteps(output);

    // 5. 返回结果
    return {
      success: true,
      output,
      artifacts: [],
      nextSteps,
      metadata: {
        agent: this.name,
        mode: context.inputData?.mode || 'standard',
        metrics: this.getLastMetrics()
      }
    };
  }

  private buildSecurityPrompt(context: AgentContext): string {
    const prompt = context.inputData?.prompt as string || '';
    const projectName = context.projectState?.projectName || '';
    
    return `作为安全专家，请分析以下项目并提供安全建议：

项目名称: ${projectName}
需求描述: ${prompt}

请从以下角度进行分析：
1. 安全威胁识别
2. 漏洞风险评估
3. 安全设计建议
4. 合规性检查
5. 最佳实践推荐

请提供详细、可操作的安全建议。`;
  }
}
```

### 步骤 2: 创建注册函数

在同一文件中添加注册函数：

```typescript
/**
 * 注册 Security Expert Agent
 */
export function registerSecurityExpertAgent(): void {
  if (!AgentFactory.has('SecurityExpert')) {
    AgentFactory.register('SecurityExpert', SecurityExpertAgent);
    log.info('已注册内置代理: SecurityExpert');
  }
}
```

### 步骤 3: 在 index.ts 中注册

在 `src/agents/index.ts` 中添加新 Agent 的注册：

```typescript
import { registerSecurityExpertAgent } from '@/agents/security-expert';
import { SecurityExpertAgent } from '@/agents/security-expert';

export function registerBuiltInAgents(): void {
  // ... 现有注册 ...
  
  registerSecurityExpertAgent();
  
  // 可选：添加别名
  if (!AgentFactory.has('Security')) {
    AgentFactory.register('Security', SecurityExpertAgent as any);
  }
  if (!AgentFactory.has('SecOps')) {
    AgentFactory.register('SecOps', SecurityExpertAgent as any);
  }
}
```

### 步骤 4: 在工作流中使用

在 `src/workflow/orchestrator.ts` 或工作流配置中添加新 Agent：

```typescript
const workflowSteps = [
  {
    id: 'security-audit',
    name: 'Security Audit',
    agent: 'SecurityExpert',  // 使用新注册的 Agent
    inputData: {
      prompt: '进行安全审计',
      mode: 'comprehensive'
    }
  }
];
```

## 📝 Agent 基类功能

`BaseAgent` 提供了以下功能，你的 Agent 可以直接使用：

### 核心方法

- `execute(context: AgentContext): Promise<AgentResult>` - **必须实现**
- `generateResponse(prompt, context, options)` - 生成 LLM 响应（带缓存、重试、回退）
- `buildSystemPrompt(context)` - 构建系统提示词
- `extractNextSteps(output)` - 从输出中提取下一步建议
- `updateMemory(key, value)` - 更新 Agent 记忆
- `getLastMetrics()` - 获取最后一次 LLM 调用的指标

### 内置功能

- ✅ **LLM 缓存** - 自动缓存相同请求
- ✅ **重试机制** - 失败自动重试（最多2次）
- ✅ **回退机制** - 失败时回退到 Mock 客户端
- ✅ **并发控制** - 自动管理 LLM 并发
- ✅ **上下文管理** - 自动构建和管理上下文
- ✅ **指标追踪** - 自动追踪 Token 使用、延迟、成本
- ✅ **记忆管理** - 短期和长期记忆

## 🎨 Agent 示例

### 示例 1: DevOps Agent

```typescript
export class DevOpsAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super(
      'DevOps',
      'DevOps Engineer',
      ['ci-cd-design', 'infrastructure-as-code', 'monitoring-setup', 'deployment-strategy'],
      llmClient
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const prompt = `设计 CI/CD 流程和基础设施配置：
项目: ${context.projectState?.projectName}
技术栈: ${context.projectState?.stack || 'unknown'}`;

    const output = await this.generateResponse(prompt, context, {
      temperature: 0.3,
      maxTokens: 3000
    });

    return {
      success: true,
      output,
      artifacts: ['ci-cd-config.yml', 'docker-compose.yml'],
      nextSteps: this.extractNextSteps(output),
      metadata: {
        agent: this.name,
        metrics: this.getLastMetrics()
      }
    };
  }
}
```

### 示例 2: UX Designer Agent

```typescript
export class UXDesignerAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super(
      'UXDesigner',
      'UX Designer',
      ['user-research', 'wireframing', 'prototyping', 'usability-testing', 'design-systems'],
      llmClient
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const mode = context.inputData?.mode || 'wireframe';
    const prompt = this.buildUXPrompt(context, mode);

    const output = await this.generateResponse(prompt, context, {
      temperature: 0.6,  // 更高温度，更创意
      maxTokens: 2500
    });

    return {
      success: true,
      output,
      artifacts: ['user-personas.json', 'wireframes.md'],
      nextSteps: this.extractNextSteps(output),
      metadata: {
        agent: this.name,
        mode,
        metrics: this.getLastMetrics()
      }
    };
  }

  private buildUXPrompt(context: AgentContext, mode: string): string {
    // 根据模式构建不同的提示词
    // ...
  }
}
```

### 示例 3: Data Scientist Agent

```typescript
export class DataScientistAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super(
      'DataScientist',
      'Data Scientist',
      ['data-analysis', 'model-design', 'feature-engineering', 'model-evaluation'],
      llmClient
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const prompt = `设计数据科学解决方案：
需求: ${context.inputData?.prompt}
数据类型: ${context.inputData?.dataType || 'unknown'}`;

    const output = await this.generateResponse(prompt, context, {
      temperature: 0.4,
      maxTokens: 3000
    });

    return {
      success: true,
      output,
      artifacts: ['data-pipeline.py', 'model-training.ipynb'],
      nextSteps: this.extractNextSteps(output),
      metadata: {
        agent: this.name,
        metrics: this.getLastMetrics()
      }
    };
  }
}
```

## 🔧 高级功能

### 自定义系统提示词

重写 `buildSystemPrompt` 方法：

```typescript
protected buildSystemPrompt(context: AgentContext): string {
  return `You are ${this.name}, a specialized ${this.role}.
  
Your expertise includes:
${this.capabilities.map(c => `- ${c}`).join('\n')}

Current project: ${context.projectState?.projectName}
Please provide expert-level guidance.`;
}
```

### 自定义上下文构建

在 `execute` 方法中自定义上下文：

```typescript
const customContext = [
  { role: 'system', content: 'Additional context...' },
  { role: 'user', content: prompt }
];

const output = await this.generateResponse(prompt, context, {
  context: customContext
});
```

### 生成多个产物

```typescript
return {
  success: true,
  output,
  artifacts: [
    { name: 'design.md', content: designContent },
    { name: 'config.json', content: configContent }
  ],
  nextSteps: this.extractNextSteps(output),
  metadata: {
    agent: this.name,
    metrics: this.getLastMetrics()
  }
};
```

## 📊 Agent 使用统计

查看已注册的 Agent：

```typescript
import { AgentFactory } from '@/agents/factory';

const agents = AgentFactory.getAvailableAgents();
console.log('Available agents:', agents);
// 输出: ['Analyst', 'Architect', 'Developer', 'QA', 'ScrumMaster', 'SecurityExpert', ...]
```

## ✅ 检查清单

添加新 Agent 后，确保：

- [ ] Agent 类继承自 `BaseAgent`
- [ ] 实现了 `execute` 方法
- [ ] 创建了注册函数
- [ ] 在 `index.ts` 中调用注册函数
- [ ] 添加了必要的类型定义
- [ ] 编写了单元测试
- [ ] 更新了文档

## 🧪 测试新 Agent

```typescript
import { AgentFactory } from '@/agents/factory';
import { llmManager } from '@/core/llm/manager';
import { registerBuiltInAgents } from '@/agents';

// 初始化
await llmManager.initialize();
registerBuiltInAgents();

// 创建 Agent
const client = llmManager.getDefaultClient();
const agent = AgentFactory.create('SecurityExpert', client!);

// 执行
const result = await agent.execute({
  projectState: { projectName: 'test-project', workflow: {} },
  workingDirectory: process.cwd(),
  inputData: { prompt: '分析安全风险' }
});

console.log(result);
```

## 🎯 最佳实践

1. **命名规范**: 使用 PascalCase，如 `SecurityExpertAgent`
2. **能力定义**: 使用 kebab-case，如 `security-audit`
3. **提示词设计**: 清晰、具体、可操作
4. **错误处理**: 利用 BaseAgent 的重试和回退机制
5. **指标追踪**: 使用 `getLastMetrics()` 监控性能
6. **记忆管理**: 使用 `updateMemory()` 保存重要信息

## 📚 相关文档

- [Agent 架构设计](./技术规范与架构设计.md)
- [工作流系统](./系统流程与架构图.md)
- [LLM 集成](./真实API测试指南.md)

---

**开始添加你的第一个自定义 Agent 吧！** 🚀

