import { BaseAgent } from '@/agents/base/agent';
import { AgentContext, AgentResult, LLMClient, LLMOptions } from '@/types';
import { AgentFactory } from '@/agents/factory';
import { log } from '@/utils/logger';

export class ArchitectAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super(
      'Architect',
      'Technical Architect',
      ['system-design', 'technology-selection', 'architecture-diagram', 'api-design', 'scalability'],
      llmClient
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const type = context.inputData?.type || 'technical';
    const scale = context.inputData?.scale ?? '1';

    const prompt = this.buildPlanPrompt(context, type, scale);
    const options: LLMOptions = {
      model: undefined,
      temperature: 0.2,
      maxTokens: 1600,
      context: []
    };

    const output = await this.generateResponse(prompt, context, options);

    return {
      success: true,
      output,
      artifacts: [],
      nextSteps: this.extractNextSteps(output),
      metadata: {
        agent: this.name,
        type,
        scale,
        metrics: this.getLastMetrics()
      }
    };
  }

  private buildPlanPrompt(context: AgentContext, type: string, scale: string): string {
    const projectName = context.projectState?.projectName || 'Unnamed Project';
    const scaleNote = `Project scale level: ${scale} (0-4)`;

    const base = `You are a senior Technical Architect.
Plan for project "${projectName}" with focus: ${type}.
${scaleNote}
Follow BMAD-Method planning best practices and return markdown.`;

    const sections = {
      technical: `
Include:
- System context and key components
- Technology stack selection (justify choices)
- API design (high-level endpoints)
- Data storage and schema considerations
- Scalability, performance, security notes
- Deployment and observability
- Risks and mitigations
- Phased implementation plan`,
      architecture: `
Include:
- Logical architecture and component responsibilities
- Integration points and external services
- Data flow and message patterns
- Deployment topology and environments
- Reliability, resilience and security considerations
- Evolution strategy and technical debt management`,
      business: `
Include:
- Business objectives and KPIs
- Stakeholder needs and constraints
- Feature roadmap (phased)
- Success criteria and risks
- Resource planning and timeline summary`,
      resource: `
Include:
- Roles and responsibilities
- Team composition and capacity
- Skill gaps and mitigations
- Tooling and environment needs
- Budget notes and procurement`,
      timeline: `
Include:
- Milestones and deliverables
- Sprint/cycle planning overview
- Dependencies and critical path
- Risk buffer and contingency plan`
    } as Record<string, string>;

    return `${base}\n${sections[type] || sections['technical']}`;
  }

  protected extractNextSteps(output: string): string[] {
    const lines = output.split('\n').map((l) => l.trim());
    const steps: string[] = [];
    for (const line of lines) {
      if (/^(?:-\s|\d+\)\s)/.test(line) && /(next step|plan|任务|步骤|里程碑)/i.test(line)) {
        steps.push(line.replace(/^\d+\)\s|^-\s/, ''));
      }
    }
    return steps.slice(0, 10);
  }
}

export function registerArchitectAgent(): void {
  if (!AgentFactory.has('Architect')) {
    AgentFactory.register('Architect', ArchitectAgent as any);
    log.info('已注册内置代理: Architect');
  }
}