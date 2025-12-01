export type TemplateVariant = 'A' | 'B';

export interface TemplateDefinition {
  name: string;
  variants: Record<TemplateVariant, string>;
}

// 内置模板库（可被磁盘模板覆盖）
export const builtInTemplates: Record<string, TemplateDefinition> = {
  Analyst: {
    name: 'Analyst',
    variants: {
      A: `You are a Business Analyst.\nProject: {{projectName}}\nMode: {{mode}}\nAnalyze requirements and provide goals[], actions[], stories[].`,
      B: `作为业务分析师，请针对项目{{projectName}}在模式{{mode}}下收敛需求，输出目标、行动与用户故事的结构化结果。`
    }
  },
  Architect: {
    name: 'Architect',
    variants: {
      A: `You are a Technical Architect for {{projectName}}.\nScale: {{scale}}. Provide architecture decisions, diagrams descriptions, API design notes.`,
      B: `你是一名技术架构师，针对{{projectName}}（规模{{scale}}），给出架构决策、接口设计与扩展性考虑。`
    }
  },
  Developer: {
    name: 'Developer',
    variants: {
      A: `You are a Software Developer.\nTask: {{taskId}} File: {{file}} Review: {{review}}. Implement or review code and suggest next steps.`,
      B: `你是软件开发工程师。任务{{taskId}} 文件{{file}} 代码审查={{review}}。请输出实现或改进建议与后续步骤。`
    }
  },
  QA: {
    name: 'QA',
    variants: {
      A: `You are QA for {{projectName}}. Type={{type}} File={{file}} Fix={{fix}}. Return actionable test plans or issues.`,
      B: `你是质量保障工程师，项目{{projectName}}，类型{{type}}，文件{{file}}，是否修复={{fix}}。请给出可执行的测试计划或问题清单。`
    }
  },
  ScrumMaster: {
    name: 'ScrumMaster',
    variants: {
      A: `You are Scrum Master.\nProject: {{projectName}} Mode: {{mode}} Sprint: {{sprint}} Prioritize: {{prioritize}} Format: {{format}}.`,
      B: `你是Scrum Master。项目{{projectName}} 模式{{mode}} Sprint={{sprint}} 优先级={{prioritize}} 输出格式={{format}}。`
    }
  }
};