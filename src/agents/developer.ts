import { BaseAgent } from '@/agents/base/agent';
import { AgentContext, AgentResult, LLMClient, LLMOptions } from '@/types';
import { AgentFactory } from '@/agents/factory';
import { log } from '@/utils/logger';

export class DeveloperAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super(
      'Developer',
      'Software Developer',
      ['code-implementation', 'tdd', 'refactoring', 'unit-testing', 'code-review'],
      llmClient
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const taskId: string | undefined = context.inputData?.task || undefined;
    const file: string | undefined = context.inputData?.file || undefined;
    const review: boolean = !!context.inputData?.review;
    const specialist: string | undefined = context.inputData?.specialist; // e.g., 'web', 'backend', 'algorithm'

    const prompt = this.buildImplementationPrompt(context, taskId, file, review, specialist);
    const options: LLMOptions = {
      model: undefined,
      temperature: review ? 0.3 : 0.2,
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
        taskId,
        file,
        review,
        metrics: this.getLastMetrics()
      }
    };
  }

  private buildImplementationPrompt(context: AgentContext, taskId?: string, file?: string, review?: boolean, specialist?: string): string {
    const projectName = context.projectState?.projectName || 'Unnamed Project';
    const base = `You are a senior Software Developer${specialist ? ` specialized in ${specialist}` : ''}.\nProject: ${projectName}\nTask: ${taskId || 'N/A'}\nTarget file: ${file || 'TBD'}\nMode: ${review ? 'review + implement' : 'implement'}\nFollow BMAD-Method implementation and TDD best practices. Return markdown with clear steps.`;

    let specializedGuidance = '';
    if (specialist === 'web') {
      specializedGuidance = '\nFocus on: UI/UX responsiveness, modern frontend frameworks, accessibility, and component modularity.';
    } else if (specialist === 'backend') {
      specializedGuidance = '\nFocus on: API scalability, security, database optimization, and error resilience.';
    } else if (specialist === 'algorithm') {
      specializedGuidance = '\nFocus on: Mathematical correctness, algorithmic efficiency (Big O), and numerical stability. Refer to the Paper2Code methodology.';
    }

    const sections = `
Include:
- Brief restatement of the task and acceptance criteria${specializedGuidance}
- Design notes and key decisions
- Step-by-step implementation plan (small commits mindset)
- TDD cycle: write test -> implement -> refactor
- Edge cases and error handling
- If review enabled: code review checklist and suggestions
- Post-implementation validation steps and metrics
Provide code blocks only for critical snippets, not full files.`;

    return `${base}\n${sections}`;
  }

  protected extractNextSteps(output: string): string[] {
    const lines = output.split('\n').map((l) => l.trim());
    const steps: string[] = [];
    for (const line of lines) {
      if (/^(?:-\s|\d+\)\s)/.test(line) && /(implement|test|refactor|review|下一步|步骤)/i.test(line)) {
        steps.push(line.replace(/^\d+\)\s|^-\s/, ''));
      }
    }
    return steps.slice(0, 10);
  }
}

export function registerDeveloperAgent(): void {
  if (!AgentFactory.has('Developer')) {
    AgentFactory.register('Developer', DeveloperAgent as any);
    log.info('已注册内置代理: Developer');
  } else {
    log.debug('Developer 代理已存在，无需重复注册');
  }

  // 别名注册：Implementation -> Developer
  if (!AgentFactory.has('Implementation')) {
    AgentFactory.register('Implementation', DeveloperAgent as any);
    log.info('已注册代理别名: Implementation -> Developer');
  }
}