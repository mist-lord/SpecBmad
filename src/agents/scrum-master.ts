import { BaseAgent } from '@/agents/base/agent';
import { AgentContext, AgentResult, LLMClient, LLMOptions } from '@/types';
import { AgentFactory } from '@/agents/factory';
import { log } from '@/utils/logger';

export class ScrumMasterAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super(
      'ScrumMaster',
      'Agile Scrum Master',
      ['sprint-planning', 'story-refinement', 'task-prioritization', 'ceremony-facilitation', 'impediment-tracking'],
      llmClient
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const mode: string = (context.inputData?.mode as string) || 'plan';
    const sprint: string | undefined = context.inputData?.sprint || undefined;
    const prioritize: boolean = !!context.inputData?.priority;
    const format: string = (context.inputData?.format as string) || 'markdown';

    const prompt = this.buildScrumPrompt(context, mode, sprint, prioritize, format);
    const options: LLMOptions = {
      model: undefined,
      temperature: 0.2,
      maxTokens: 1500,
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
        mode,
        sprint,
        prioritize,
        format,
        metrics: this.getLastMetrics()
      }
    };
  }

  private buildScrumPrompt(
    context: AgentContext,
    mode: string,
    sprint?: string,
    prioritize?: boolean,
    format?: string
  ): string {
    const projectName = context.projectState?.projectName || 'Unnamed Project';
    const base = `You are a Scrum Master facilitating sprint planning and refinement.`;
    const goalsSection = `\nProvide sprint goals, story refinements, and prioritized tasks.`;
    const formatNote = format === 'json'
      ? `\nReturn strict JSON with fields: goals[], actions[], stories[{id,title,priority,estimate}]`
      : `\nReturn well-structured Markdown with headings and lists.`;

    return `${base}\nProject: ${projectName}\nMode: ${mode}\nSprint: ${sprint ?? ''}\nPrioritize: ${prioritize}\n${goalsSection}${formatNote}`;
  }
}

export function registerScrumMasterAgent(): void {
  AgentFactory.register('ScrumMaster', ScrumMasterAgent);
  log.info('已注册内置代理: ScrumMaster');
}