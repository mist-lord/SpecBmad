import { BaseAgent } from '@/agents/base/agent';
import { AgentContext, AgentResult, LLMClient, LLMOptions } from '@/types';
import { AgentFactory } from '@/agents/factory';
import { log } from '@/utils/logger';

export class QAAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super(
      'QA',
      'Quality Assurance',
      ['static-analysis', 'unit-testing', 'integration-testing', 'e2e-testing', 'security-scanning', 'performance-profiling'],
      llmClient
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const type: string = (context.inputData?.type as string) || 'unit';
    const file: string | undefined = context.inputData?.file || undefined;
    const fix: boolean = !!context.inputData?.fix;

    const prompt = this.buildQAPrompt(context, type, file, fix);
    const options: LLMOptions = {
      model: undefined,
      temperature: 0.2,
      maxTokens: 1400,
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
        file,
        fix,
        metrics: this.getLastMetrics()
      }
    };
  }

  private buildQAPrompt(context: AgentContext, type: string, file?: string, fix?: boolean): string {
    const projectName = context.projectState?.projectName || 'Unnamed Project';
    const base = `You are a senior QA engineer.\nProject: ${projectName}\nFile: ${file || 'ALL'}\nAuto-fix: ${fix ? 'enabled' : 'disabled'}\nFollow BMAD-Method testing and quality practices. Return markdown with clear headings and checklists.`;

    const sections: Record<string, string> = {
      unit: `
Provide a unit testing plan and review including:
- Static analysis checklist (lint, types, common bugs)
- Unit test strategy and examples
- Edge cases to cover
- Mocking/stubbing guidance
- Coverage goals and measurement
- Common pitfalls in the selected file/module
- If auto-fix is enabled, list safe fixes and how to apply them
Return actionable steps and a short summary.`,
      integration: `
Provide an integration testing plan including:
- Interfaces and dependencies
- Test data and environment setup
- Contract tests and boundary cases
- Failure modes and recovery
- Observability hooks (logs/metrics)
- Risk areas and prioritization
Return markdown with steps and checklists.`,
      e2e: `
Provide an end-to-end (E2E) testing plan including:
- Critical user journeys
- Environment and fixture preparation
- Test scenarios with preconditions and expected results
- Non-happy paths and resilience tests
- Reporting and flakiness mitigation
Return markdown sections and bullet lists.`,
      security: `
Provide a security review including:
- Threat model summary for the component
- Input validation and sanitization checklist
- Authn/Authz considerations
- Secrets management and configuration safety
- Common CWE issues relevant here
- Remediation recommendations
Return markdown with findings and prioritized actions.`,
      performance: `
Provide a performance review including:
- Key metrics and targets (latency, throughput, memory)
- Profiling approach and tools
- Bottleneck hypotheses and validation steps
- Load testing plan and scenarios
- Optimization ideas with trade-offs
Return markdown with steps and quick wins.`
    };

    return `${base}\n${sections[type] || sections['unit']}`;
  }

  protected extractNextSteps(output: string): string[] {
    const lines = output.split('\n').map((l) => l.trim());
    const steps: string[] = [];
    for (const line of lines) {
      if (/^(?:-\s|\d+\)\s)/.test(line) && /(fix|test|检查|步骤|行动|next)/i.test(line)) {
        steps.push(line.replace(/^\d+\)\s|^-\s/, ''));
      }
    }
    return steps.slice(0, 10);
  }
}

export function registerQAAgent(): void {
  if (!AgentFactory.has('QA')) {
    AgentFactory.register('QA', QAAgent as any);
    log.info('已注册内置代理: QA');
  } else {
    log.debug('QA 代理已存在，无需重复注册');
  }
}