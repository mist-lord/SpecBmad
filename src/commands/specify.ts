import { log } from '@/utils/logger';
import fs from 'fs';
import path from 'path';
import { validateSpecifyArgs } from '@/utils/args-validator';
import { PerfTracer } from '@/utils/perf';
import { handleError } from '@/utils/error';
import { llmManager } from '@/core/llm';

interface SpecifyOptions {
  input?: string;
  output?: string;
  agent?: string;
  model?: string;
  template?: string;
  interactive?: boolean;
  dryRun?: boolean;
}

export async function specifyCommand(options: SpecifyOptions): Promise<void> {
  const perf = new PerfTracer();
  try {
    perf.start('specify');
    log.info('开始生成需求规格文档...');
    
    if (options.dryRun) {
      log.info('预览模式 - 不会生成实际文件');
    }
    
    if (options.interactive) {
      log.info('启动交互式需求收集...');
      const { default: inquirer } = await import('inquirer');
      const answers = await inquirer.prompt([
        { type: 'input', name: 'title', message: '需求标题', default: '新功能需求' },
        { type: 'input', name: 'summary', message: '需求概要', default: '请简述业务目标与范围' },
        { type: 'checkbox', name: 'modules', message: '涉及模块', choices: ['UI', 'API', 'DB', 'Auth'], default: ['UI', 'API'] },
        { type: 'list', name: 'template', message: '规格模板', choices: ['standard', 'api', 'webapp'], default: options.template || 'standard' },
        { type: 'list', name: 'agent', message: '分析代理', choices: ['Analyst', 'Architect'], default: options.agent || 'Analyst' }
      ]);
      const { PATHS, getProjectPath } = await import('@/utils/paths');
      const defaultDir = getProjectPath(PATHS.SPECIFICATIONS_DIR);
      fs.mkdirSync(defaultDir, { recursive: true });
      const outPath = options.output ? (path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output)) : path.join(defaultDir, 'requirements.md');
      const md = `# ${answers.title}\n\n## 概要\n${answers.summary}\n\n## 涉及模块\n- ${answers.modules.join('\n- ')}\n\n## 模板\n${answers.template}\n\n## 代理\n${answers.agent}\n`;
      if (!options.dryRun) {
        fs.writeFileSync(outPath, md, 'utf-8');
        log.success(`交互式规格已写入: ${outPath}`);
      } else {
        log.info('交互模式为干跑，未写入文件');
      }
      const sample = perf.end('specify');
      log.info(`规格生成完成 (用时 ${sample.durationMs.toFixed(0)}ms)`);
      return;
    }
    
    // 参数验证
    const v = validateSpecifyArgs(options);
    if (!v.valid) {
      for (const e of v.errors) log.error(e);
      return;
    }
    for (const w of v.warnings) log.warn(w);
    
    // 非交互逻辑：使用 LLM 生成规格内容
    const defaultDir = path.join(process.cwd(), '.specbmad', 'specifications');
    const outPath = options.output ? (path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output)) : path.join(defaultDir, 'requirements.md');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await llmManager.initialize();
    const client = llmManager.getDefaultClient();
    let md = `# 需求规格\n\n输入文件: ${options.input || '无'}\n`;
    if (client) {
      const prompt = `Create a clear requirement specification in Markdown. Include Title, Summary, Scope, Non-functional Requirements, Risks, Acceptance Criteria, and Milestones. Use concise Chinese headings.`;
      const text = await client.generateText(prompt, { temperature: 0.2, maxTokens: 1200 });
      md = text || md;
    }
    if (!options.dryRun) {
      fs.writeFileSync(outPath, md, 'utf-8');
      log.success(`需求规格文档生成完成，输出: ${outPath}`);
    } else {
      log.info('干跑模式，未写入文件');
    }
    const sample = perf.end('specify');
    log.info(`规格生成完成 (用时 ${sample.durationMs.toFixed(0)}ms)`);
  } catch (error) {
    handleError(error, { command: 'specify' });
    throw error;
  }
}
