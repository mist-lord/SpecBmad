import { BaseAgent } from '@/agents/base/agent';
import { AgentContext, AgentResult, LLMClient, LLMOptions } from '@/types';
import { AgentFactory } from '@/agents/factory';
import { log } from '@/utils/logger';

/**
 * 安全专家 Agent
 * 负责安全审计、漏洞评估、安全设计、合规性检查、威胁建模
 */
export class SecurityExpertAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super(
      'SecurityExpert',
      'Security Expert',
      [
        'security-audit',
        'vulnerability-assessment',
        'security-design',
        'compliance-check',
        'threat-modeling',
        'security-best-practices'
      ],
      llmClient
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const mode = context.inputData?.mode || 'standard';
    const prompt = this.buildSecurityPrompt(context, mode);

    const options: LLMOptions = {
      model: undefined,
      temperature: mode === 'comprehensive' ? 0.3 : 0.2,
      maxTokens: 3000,
      context: []
    };

    const output = await this.generateResponse(prompt, context, options);
    const nextSteps = this.extractNextSteps(output);

    // 提取安全建议和风险等级
    const securityAnalysis = this.parseSecurityAnalysis(output);

    return {
      success: true,
      output,
      artifacts: securityAnalysis.artifacts || [],
      nextSteps,
      metadata: {
        agent: this.name,
        mode,
        riskLevel: securityAnalysis.riskLevel,
        metrics: this.getLastMetrics()
      }
    };
  }

  private buildSecurityPrompt(context: AgentContext, mode: string): string {
    const prompt = context.inputData?.prompt as string || '';
    const projectName = context.projectState?.projectName || '';
    const stack = context.projectState?.stack || 'unknown';
    const projectType = context.projectState?.type || 'unknown';

    const basePrompt = `作为安全专家，请对以下项目进行安全分析：

项目名称: ${projectName}
技术栈: ${stack}
项目类型: ${projectType}
需求描述: ${prompt}`;

    switch (mode) {
      case 'comprehensive':
        return `${basePrompt}

请进行全面的安全分析，包括：
1. **威胁识别**: 识别潜在的安全威胁和攻击向量
2. **漏洞评估**: 评估常见漏洞（OWASP Top 10等）
3. **安全设计**: 提供安全架构设计建议
4. **合规性检查**: 检查是否符合安全标准和法规（如 GDPR、HIPAA 等）
5. **威胁建模**: 进行威胁建模分析
6. **最佳实践**: 推荐安全最佳实践和防护措施
7. **风险评估**: 评估整体风险等级（低/中/高/严重）

请提供详细、可操作的安全建议和优先级排序。`;

      case 'quick':
        return `${basePrompt}

请快速识别主要安全风险和关键建议（3-5条）。`;

      case 'compliance':
        return `${basePrompt}

请重点检查合规性要求，包括：
- 数据保护法规（GDPR、CCPA等）
- 行业标准（ISO 27001、SOC 2等）
- 安全框架（NIST、CIS Controls等）

提供合规性检查清单和改进建议。`;

      default:
        return `${basePrompt}

请从以下角度进行分析：
1. 安全威胁识别
2. 漏洞风险评估
3. 安全设计建议
4. 合规性检查
5. 最佳实践推荐

请提供详细、可操作的安全建议。`;
    }
  }

  private parseSecurityAnalysis(output: string): {
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    artifacts?: string[];
  } {
    const result: {
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      artifacts?: string[];
    } = {};

    // 尝试提取风险等级
    const riskMatch = output.match(/风险[等级|级别]?[：:]\s*([低中高严重]|low|medium|high|critical)/i);
    if (riskMatch) {
      const level = riskMatch[1].toLowerCase();
      if (level.includes('低') || level === 'low') result.riskLevel = 'low';
      else if (level.includes('中') || level === 'medium') result.riskLevel = 'medium';
      else if (level.includes('高') || level === 'high') result.riskLevel = 'high';
      else if (level.includes('严重') || level === 'critical') result.riskLevel = 'critical';
    }

    // 提取建议的产物文件
    const artifactMatches = output.match(/生成[文件|产物]?[：:]\s*([^\n]+)/gi);
    if (artifactMatches) {
      result.artifacts = artifactMatches
        .map(m => m.replace(/生成[文件|产物]?[：:]\s*/i, '').trim())
        .filter(Boolean);
    }

    return result;
  }
}

/**
 * 注册 Security Expert Agent
 */
export function registerSecurityExpertAgent(): void {
  if (!AgentFactory.has('SecurityExpert')) {
    AgentFactory.register('SecurityExpert', SecurityExpertAgent);
    log.info('已注册内置代理: SecurityExpert');
  }
}

