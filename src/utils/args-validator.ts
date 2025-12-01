import fs from 'fs';
import path from 'path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function makeResult(errors: string[] = [], warnings: string[] = []): ValidationResult {
  return { valid: errors.length === 0, errors, warnings };
}

export function validateInitArgs(projectName: string, options: {
  template?: string;
  language?: string;
  framework?: string;
  agents?: string;
  llmProvider?: string;
  interactive?: boolean;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!projectName || projectName.trim() === '') {
    errors.push('项目名称不能为空');
  }

  const allowedTemplates = ['default', 'web-basic', 'mobile-basic', 'api-service'];
  if (options.template && !allowedTemplates.includes(options.template)) {
    warnings.push(`未知模板: ${options.template}，已接受但建议使用: ${allowedTemplates.join(', ')}`);
  }

  const allowedLangs = ['typescript', 'javascript', 'python', 'go', 'rust', 'cpp', 'c++'];
  if (options.language && !allowedLangs.includes(options.language)) {
    warnings.push(`不常见语言: ${options.language}，建议使用: ${allowedLangs.join(', ')}`);
  }

  const allowedFrameworks = ['react', 'vue', 'svelte', 'nextjs', 'nest', 'express'];
  if (options.framework && !allowedFrameworks.includes(options.framework)) {
    warnings.push(`不常见框架: ${options.framework}，建议使用: ${allowedFrameworks.join(', ')}`);
  }

  if (options.agents) {
    const list = options.agents.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length === 0) {
      warnings.push('AI代理列表为空');
    }
  }

  const allowedProviders = ['openai', 'anthropic', 'claude', 'ollama'];
  if (options.llmProvider && !allowedProviders.includes(options.llmProvider)) {
    warnings.push(`未知LLM提供商: ${options.llmProvider}，建议使用: ${allowedProviders.join(', ')}`);
  }

  return makeResult(errors, warnings);
}

export function validateSpecifyArgs(options: {
  input?: string;
  output?: string;
  agent?: string;
  model?: string;
  template?: string;
  interactive?: boolean;
  dryRun?: boolean;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!options.interactive && !options.input) {
    warnings.push('未提供输入文件，可能使用默认或交互模式');
  }

  if (options.input) {
    const inPath = path.isAbsolute(options.input) ? options.input : path.join(process.cwd(), options.input);
    if (!fs.existsSync(inPath)) {
      warnings.push(`输入文件不存在: ${options.input}`);
    }
  }

  if (options.output) {
    const outDir = path.dirname(path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output));
    try {
      fs.mkdirSync(outDir, { recursive: true });
    } catch (e) {
      errors.push(`无法创建输出目录: ${outDir}`);
    }
  }

  const allowedTemplates = ['standard', 'api', 'webapp'];
  if (options.template && !allowedTemplates.includes(options.template)) {
    warnings.push(`未知规格模板: ${options.template}，建议使用: ${allowedTemplates.join(', ')}`);
  }

  const allowedAgents = ['Analyst', 'Architect'];
  if (options.agent && !allowedAgents.includes(options.agent)) {
    warnings.push(`未知代理: ${options.agent}，建议使用: ${allowedAgents.join(', ')}`);
  }

  return makeResult(errors, warnings);
}