import { log } from '@/utils/logger';
import fs from 'fs';
import path from 'path';
import { validateSpecifyArgs } from '@/utils/args-validator';
import { PerfTracer } from '@/utils/perf';
import { handleError } from '@/utils/error';
import { specKit } from '@/core/spec/spec-kit';
import { PhaseController } from '@/core/phase/controller';
import { EventStore } from '@/core/events/store';
import { registerDefaultGates } from '@/core/phase/gates';
import { getSpecPath } from '@/utils/paths';

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
    
    // V2 架构：使用 Spec-Kit (Phase 0)
    // 注册默认 Gate 检查器
    registerDefaultGates();

    const input = options.input || '请提供需求描述';
    const outputPath = options.output 
      ? (path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output))
      : getSpecPath('intent.yaml');

    if (!options.dryRun) {
      // 调用 Spec-Kit
      const specKitResult = await specKit.execute({
        input,
        outputPath
      });

      if (!specKitResult.success) {
        throw new Error(`Spec-Kit 执行失败: ${specKitResult.error}`);
      }

      log.success(`Intent Spec 已生成: ${specKitResult.outputPath}`);

      // 触发 Phase 0→1 迁移（如果当前在 Phase 0）
      try {
        const controller = new PhaseController();
        const eventStore = new EventStore();
        const currentPhase = controller.getCurrentPhase();

        if (currentPhase === 0) {
          log.info('触发 Phase 0→1 迁移...');
          const transitionResult = await controller.transitionTo(1, {
            projectRoot: process.cwd(),
            currentPhase: 0,
            metadata: { triggeredBy: 'specify-command' }
          });

          // 记录事件
          eventStore.appendEvent({
            type: 'phase_transition',
            phase: 1,
            status: transitionResult.success ? 'passed' : 'failed',
            timestamp: transitionResult.timestamp,
            actor: 'specify-command',
            inputs: { fromPhase: 0, toPhase: 1 },
            outputs: { gateResults: transitionResult.gateResults },
            notes: transitionResult.error
          });

          if (transitionResult.success) {
            log.success('Phase 迁移成功: 0 → 1');
          } else {
            log.warn(`Phase 迁移失败: ${transitionResult.error}`);
          }
        }
      } catch (error) {
        log.warn(`Phase 迁移失败（不影响 Spec 生成）: ${error instanceof Error ? error.message : String(error)}`);
      }
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
