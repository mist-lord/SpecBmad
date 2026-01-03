import { BaseAgent } from '@/agents/base/agent';
import { AgentContext, AgentResult, LLMClient, LLMOptions } from '@/types';
import { AgentFactory } from '@/agents/factory';
import { log } from '@/utils/logger';
import { changeManager } from '@/core/change/manager';
import { ChangeProposal } from '@/core/change/types';

export class AnalystAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super(
      'Analyst',
      'Business Analyst',
      ['requirement-analysis', 'stakeholder-analysis', 'risk-identification', 'user-story-creation', 'change-impact-analysis'],
      llmClient
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    // 检查是否为变更提案分析模式
    if (context.inputData?.proposalId) {
      return this.analyzeProposal(context, context.inputData.proposalId);
    }

    const mode = context.inputData?.mode || 'brief';

    const prompt = this.buildAnalysisPrompt(context, mode);
    const options: LLMOptions = {
      model: undefined, // 使用客户端默认模型或配置
      temperature: mode === 'brainstorm' ? 0.7 : 0.2,
      maxTokens: 2000,
      context: []
    };

    const output = await this.generateResponse(prompt, context, options);

    // 简单的后处理：提取下一步建议
    const nextSteps = this.extractNextSteps(output);

    return {
      success: true,
      output,
      artifacts: [],
      nextSteps,
      metadata: {
        agent: this.name,
        mode,
        metrics: this.getLastMetrics()
      }
    };
  }

  async analyzeProposal(context: AgentContext, proposalId: string): Promise<AgentResult> {
    log.info(`Analyst Agent 开始分析变更提案: ${proposalId}`);
    
    const proposal = changeManager.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`无法分析：提案 ${proposalId} 不存在`);
    }

    const prompt = this.buildProposalPrompt(proposal, context);
    const options: LLMOptions = {
      temperature: 0.2, // 分析任务需要准确性
      maxTokens: 2500
    };

    const output = await this.generateResponse(prompt, context, options);
    const nextSteps = this.extractNextSteps(output);

    return {
      success: true,
      output,
      artifacts: [],
      nextSteps,
      metadata: {
        agent: this.name,
        mode: 'proposal-analysis',
        proposalId
      }
    };
  }

  private buildAnalysisPrompt(context: AgentContext, mode: string): string {
    const projectName = context.projectState?.projectName || 'Unnamed Project';

    const base = `You are a professional Business Analyst.
Analyze the project "${projectName}" and provide ${mode} insights.
Follow BMAD-Method analysis practices with clear, structured output.`;

    const sections = {
      brief: `
Please produce a concise analysis with the following sections:
1) Problem understanding
2) Stakeholders & users
3) Goals & success criteria
4) Constraints & assumptions
5) Risks & mitigations
6) Suggested next steps (3-5 bullets)
Return the output in markdown with clear headings.`,
      comprehensive: `
Provide a comprehensive analysis including:
- Context overview
- Business goals & KPIs
- Stakeholder map & personas
- Requirements breakdown (functional / non-functional)
- Risks, constraints, and dependencies
- Alternatives & trade-offs
- Recommended plan & phased approach
Return the output in markdown with clear headings and bullet lists.`,
      brainstorm: `
Provide varied ideas and angles to explore the problem space. Include at least 10 bullets for opportunities, risks, and research directions. Use markdown headings.`,
      risk: `
Identify potential technical, business, and operational risks. Provide mitigation strategies for each.`,
      research: `
Analyze the provided technical research papers, complex algorithms, or deep specifications.
1) Extract core logic and mathematical foundations
2) Map algorithms to software architecture
3) Identify implementation challenges (performance, complexity)
4) Suggest verification/testing strategy for accuracy
Return a deep technical analysis in markdown.`
    } as Record<string, string>;

    return `${base}\n${sections[mode] || sections['brief']}`;
  }

  private buildProposalPrompt(proposal: ChangeProposal, context: AgentContext): string {
    const projectName = context.projectState?.projectName || 'Current Project';
    
    return `You are a Senior Business Analyst reviewing a Change Proposal for project "${projectName}".

## Proposal Overview
- **ID**: ${proposal.id}
- **Title**: ${proposal.title}
- **Description**: ${proposal.description}

## Task
Analyze this proposal and generate an "Impact Analysis Report".

## Output Requirements
Please provide a structured markdown response covering:

### 1. Requirement Validation
- Is the proposal clear and complete?
- Are there any ambiguities or missing details?
- Does it align with known project goals?

### 2. Impact Analysis
- **Functional Impact**: Which existing features might be affected?
- **Technical Impact**: Any architectural concerns or major refactoring risks?
- **Data Impact**: Will schema changes be required?

### 3. Implementation Recommendations
- Break down the implementation into high-level tasks.
- Suggest a verification strategy (how to test).

### 4. Risk Assessment
- Identify potential risks (Low/Medium/High).
- Propose mitigation strategies.

Return the output in standard Markdown format.
`;
  }

  protected extractNextSteps(output: string): string[] {
    const lines = output.split('\n').map((l) => l.trim());
    const hints: string[] = [];
    for (const line of lines) {
      if (/^(?:-\s|\d+\)\s)/.test(line) && /next step|建议|行动|计划|步骤/i.test(line)) {
        hints.push(line.replace(/^\d+\)\s|^-\s/, ''));
      }
    }
    // 限制数量，避免过多
    return hints.slice(0, 10);
  }
}

export function registerAnalystAgent(): void {
  if (!AgentFactory.has('Analyst')) {
    AgentFactory.register('Analyst', AnalystAgent as any);
    log.info('已注册内置代理: Analyst');
  }
}
