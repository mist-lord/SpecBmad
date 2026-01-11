import { log } from '@/utils/logger';
import path from 'path';
import fs from 'fs';
import yaml from 'yaml';
import { Orchestrator } from '@/core/workflow/orchestrator';
import { config } from '@/utils/config';
<<<<<<< HEAD
import { PATHS, getProjectPath, getArtifactsPath } from '@/utils/paths';
=======
import { PATHS, getProjectPath } from '@/utils/paths';
>>>>>>> origin/main
import { AgentContext, AgentResult } from '@/types';
import { renderWorkflowMarkdownSummary } from '../utils/summary';
import { renderLlmUsageDashboard } from '@/utils/dashboard';
import { PerfTracer } from '@/utils/perf';
import { handleError } from '@/utils/error';
import { pluginManager } from '@/core/plugin/manager';
import { specifyCommand } from './specify';
import { tasksCommand } from './tasks';
import { implementCommand } from './implement';
import { qaCommand } from './qa';
import { deployCommand } from './deploy';
import { generateCommand } from './generate';
import { runCommand } from './run';

interface WorkflowOptions {
  name?: string;
  output?: string;
  format?: 'json' | 'markdown' | 'yaml';
  reportDir?: string;
  runDir?: string;
  datePrefix?: boolean;
  dedupe?: boolean;
  resume?: boolean;
  resumeFile?: string;
  autoRun?: boolean;
  phase?: boolean; // V2 架构：使用 Phase 驱动的工作流
  startPhase?: number; // 起始 Phase (0-5)
  endPhase?: number; // 结束 Phase (0-5)
}

export async function workflowCommand(options: WorkflowOptions): Promise<void> {
  try {
    // V2 架构：Phase 驱动的工作流
    if (options.phase) {
      const { ensureProjectInitialized } = await import('@/utils/auto-init');
      await ensureProjectInitialized(true);
      config.load();

      const orchestrator = new Orchestrator();
      const startPhase = (options.startPhase ?? 0) as 0 | 1 | 2 | 3 | 4 | 5;
      const endPhase = (options.endPhase ?? 5) as 0 | 1 | 2 | 3 | 4 | 5;

      const initialContext: AgentContext = {
        workingDirectory: process.cwd(),
        projectState: {
          projectName: config.getAll().projectName || 'default',
          workflow: {
            currentStep: '',
            completedSteps: []
          }
        },
        inputData: {
          requirement: options.name || '请提供需求描述'
        }
      };

      const results = await orchestrator.executePhaseWorkflow(initialContext, startPhase, endPhase);

      // 输出结果
      if (options.output) {
        const outputPath = path.isAbsolute(options.output) 
          ? options.output 
          : path.join(process.cwd(), options.output);
        const format = options.format || 'json';
        
        if (format === 'json') {
          fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
        } else if (format === 'markdown') {
          const markdown = renderWorkflowMarkdownSummary('phase-workflow', results);
          fs.writeFileSync(outputPath, markdown, 'utf-8');
        }
        log.success(`工作流结果已保存: ${outputPath}`);
      }

      return;
    }

    // 自动初始化（如果需要）
    const { ensureProjectInitialized } = await import('@/utils/auto-init');
    await ensureProjectInitialized(true); // 静默模式
    
    // 初始化配置
    config.load();

    // 基于配置确定默认工作流名称
    let selectedName = options.name;
    if (!selectedName) {
      const mode = config.getAll().integration?.workflow_mode || 'hybrid';
      selectedName = mode === 'hybrid' ? 'full-development' : (mode === 'spec_first' ? 'planning-only' : 'core-cli');
      log.info(`未指定名称，按配置 workflow_mode=${mode} 选择: ${selectedName}`);
    }

    const normalizedName = selectedName === 'full' ? 'full-development' : selectedName;

    // 特殊名称：core-cli 链式执行核心 CLI 命令
    if (normalizedName === 'core-cli') {
      const tracer = new PerfTracer();
      config.load();
      const chainStateFile = getProjectPath(PATHS.WORKFLOW_CHAIN_STATE_FILE);
      fs.mkdirSync(path.dirname(chainStateFile), { recursive: true });

      const writeState = (status: string, step: string, error?: string) => {
        const payload = { status, step, updatedAt: new Date().toISOString() };
        if (error) (payload as any).error = error;
        fs.writeFileSync(chainStateFile, JSON.stringify(payload, null, 2), 'utf-8');
      };

      try {
        const runRoot = options.runDir || process.cwd();
        const specsDir = options.runDir ? path.join(runRoot, 'specs') : getProjectPath(PATHS.SPECIFICATIONS_DIR);
        const artifactsDir = options.reportDir || (options.runDir ? path.join(runRoot, 'artifacts') : getProjectPath(PATHS.ARTIFACTS_DIR));
        
        tracer.start('specify');
        await specifyCommand({ 
          interactive: false, 
          template: 'standard', 
          agent: 'Analyst', 
          output: path.join(specsDir, 'requirements.md') 
        });
        tracer.end('specify');
        writeState('running', 'specify');

        tracer.start('tasks');
        await tasksCommand({ 
          goal: '根据需求规格拆解任务', 
          format: 'markdown', 
          reportDir: artifactsDir 
        });
        tracer.end('tasks');
        writeState('running', 'tasks');

        tracer.start('implement');
        await implementCommand({ 
          task: 'core-feature', 
          review: true, 
          format: 'markdown', 
          reportDir: artifactsDir 
        });
        tracer.end('implement');
        writeState('running', 'implement');

        tracer.start('qa');
        await qaCommand({ 
          type: 'unit', 
          format: 'markdown', 
          reportDir: artifactsDir 
        });
        tracer.end('qa');
        writeState('running', 'qa');

        tracer.start('deploy');
        await deployCommand({ 
          env: 'dev', 
          strategy: 'rolling', 
          dryRun: true, 
          format: 'json', 
          reportDir: artifactsDir 
        });
        tracer.end('deploy');
        writeState('completed', 'deploy');

        log.success(`核心命令链式执行完成 (产物目录: ${artifactsDir})`);
        return;
      } catch (e) {
        handleError(e, { command: 'workflow', phase: 'core-cli' });
        writeState('failed', 'core-cli', e instanceof Error ? e.message : String(e));
        return;
      }
    }

    const cfgFmt = config.getAll().integration?.output_format;
    const fmtRaw = options.format || cfgFmt || 'json';
    const format = fmtRaw === 'markdown' ? 'markdown' : (fmtRaw === 'yaml' ? 'yaml' : 'json');

    await pluginManager.initializeAll();
    const orchestrator = new Orchestrator();

    // 读取恢复状态（如启用 --resume）
    const initialCompleted: string[] = [];
    if (options.resume) {
      const defaultStateFile = getProjectPath(PATHS.WORKFLOW_STATE_FILE);
      const stateFile = options.resumeFile
        ? (path.isAbsolute(options.resumeFile) ? options.resumeFile : path.join(process.cwd(), options.resumeFile))
        : defaultStateFile;
      if (fs.existsSync(stateFile)) {
        try {
          const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
          if (Array.isArray(state.completedSteps)) {
            initialCompleted.push(...state.completedSteps);
            log.info(`恢复模式：已读取完成步骤 ${initialCompleted.length} 个`);
          }
          if (state.workflow && options.name && state.workflow !== options.name) {
            log.warn(`恢复状态的工作流为 ${state.workflow}，当前指定为 ${options.name}，将按当前名称继续。`);
          }
        } catch (e) {
          log.warn(`读取恢复状态文件失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        log.warn(`未找到恢复状态文件: ${stateFile}，按正常模式执行。`);
      }
    }

    const projectConfig = config.getAll();
    const runRoot = options.runDir || process.cwd();
    const artifactsDir = options.reportDir || (options.runDir ? path.join(runRoot, 'artifacts') : getProjectPath(PATHS.ARTIFACTS_DIR));
    const codeDir = options.runDir ? path.join(runRoot, 'code') : path.join(process.cwd(), 'generated', 'project');
    const docsDir = options.runDir ? path.join(runRoot, 'docs') : path.join(process.cwd(), 'docs');
<<<<<<< HEAD
    const logsDir = options.runDir ? path.join(runRoot, 'logs') : path.join(process.cwd(), 'docs');
    const logFile = path.join(logsDir, 'run-output.txt');
=======
    // const logsDir = options.runDir ? path.join(runRoot, 'logs') : path.join(process.cwd(), 'docs');
    // const logFile = path.join(logsDir, 'run-output.txt');
>>>>>>> origin/main

    const context: AgentContext = {
      projectState: {
        projectName: projectConfig.projectName || 'SpecKit-BMAD项目',
        workflow: {
          currentStep: '',
          completedSteps: initialCompleted
        }
      },
      workingDirectory: runRoot,
      inputData: {}
    };

    const results: AgentResult[] = await orchestrator.executeWorkflow(normalizedName, context, format);

    if (normalizedName === 'full-development') {
      await generateCommand({ stack: 'ts-app', out: codeDir, docOut: docsDir, reportDir: artifactsDir })
      if (options.autoRun) {
        await runCommand({ dir: codeDir, stack: 'ts-app' })
      }
    }

    // 简要输出
    log.info(`工作流 ${normalizedName} 执行完成，步骤数: ${results.length}`);
    for (const [idx, r] of results.entries()) {
      const meta = r.metadata || {};
      log.info(`步骤 ${idx + 1}: agent=${meta.agent || 'unknown'} mode=${meta.mode || ''}`);
    }

    // 生成输出路径，支持 --date-prefix 与 --dedupe
    let outPath: string | undefined;
    const baseFilename = format === 'json' ? 'workflow.json' : (format === 'yaml' ? 'workflow.yaml' : 'workflow.md');

    const ts = (() => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    })();
    const withPrefix = (name: string) => (options.datePrefix ? `${ts}-${name}` : name);
    const ensureUnique = (dir: string, name: string) => {
      if (!options.dedupe) return path.join(dir, name);
      let candidate = path.join(dir, name);
      if (!fs.existsSync(candidate)) return candidate;
      const ext = path.extname(name);
      const stem = name.slice(0, -ext.length);
      let i = 1;
      while (i < Number.MAX_SAFE_INTEGER) {
        candidate = path.join(dir, `${stem}-${i}${ext}`);
        if (!fs.existsSync(candidate)) return candidate;
        i++;
      }
      return path.join(dir, `${stem}-${Date.now()}${ext}`);
    };

    if (options.output) {
      const out = path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output);
      const dir = path.dirname(out);
      const file = path.basename(out);
      const fname = withPrefix(file);
      outPath = options.dedupe ? ensureUnique(dir, fname) : path.join(dir, fname);
    } else if (options.reportDir) {
      const dir = path.isAbsolute(options.reportDir) ? options.reportDir : path.join(process.cwd(), options.reportDir);
      const fname = withPrefix(baseFilename);
      outPath = ensureUnique(dir, fname);
    }

    if (outPath) {
      const outDir = path.dirname(outPath);
      fs.mkdirSync(outDir, { recursive: true });

      if (format === 'markdown') {
        const md = renderWorkflowMarkdownSummary(normalizedName, results);
        fs.writeFileSync(outPath, md, 'utf-8');
        const dashMd = renderLlmUsageDashboard(results);
        const dashPath = path.join(outDir, 'llm-dashboard.md');
        fs.writeFileSync(dashPath, dashMd, 'utf-8');
      } else if (format === 'yaml') {
        const summary = {
          workflow: normalizedName,
          steps: results.map((r) => ({
            agent: r.metadata?.agent,
            mode: r.metadata?.mode,
            sprint: r.metadata?.sprint,
            prioritize: r.metadata?.prioritize,
            nextSteps: r.nextSteps || []
          }))
        };
        const y = yaml.stringify(summary);
        fs.writeFileSync(outPath, y, 'utf-8');
        const dashMd = renderLlmUsageDashboard(results);
        const dashPath = path.join(path.dirname(outPath), 'llm-dashboard.md');
        fs.writeFileSync(dashPath, dashMd, 'utf-8');
      } else {
        const summary = {
          workflow: normalizedName,
          steps: results.map((r) => ({
            agent: r.metadata?.agent,
            mode: r.metadata?.mode,
            sprint: r.metadata?.sprint,
            prioritize: r.metadata?.prioritize,
            nextSteps: r.nextSteps || []
          }))
        };
        fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf-8');
        const dashMd = renderLlmUsageDashboard(results);
        const dashPath = path.join(path.dirname(outPath), 'llm-dashboard.md');
        fs.writeFileSync(dashPath, dashMd, 'utf-8');
      }
      log.success(`工作流结果摘要已写入: ${outPath}`);
      log.success(`LLM指标仪表板已写入: ${path.join(path.dirname(outPath), 'llm-dashboard.md')}`);
      try {
        const { pluginManager } = await import('@/core/plugin/manager')
        const { ArtifactsIndexerPlugin } = await import('@/plugins/artifacts-indexer')
        const name = 'artifacts-indexer'
        if (!pluginManager.hasPlugin(name)) {
          pluginManager.registerPlugin({ name, version: '0.1.0', enabled: true }, ArtifactsIndexerPlugin as any)
          await pluginManager.initializePlugin(name)
        } else {
          const p: any = pluginManager.getPlugin(name)
          if (p && p.isEnabled()) p.indexArtifacts(process.cwd())
        }
      } catch (_e) { /* Ignore plugin indexing errors */ }
    } else {
      // 摘要输出（截断），提示可用 --output / --report-dir
      const preview =
        (format === 'markdown'
          ? renderWorkflowMarkdownSummary(normalizedName, results)
          : JSON.stringify(
              {
                workflow: normalizedName,
                steps: results.map((r) => ({
                  agent: r.metadata?.agent,
                  mode: r.metadata?.mode,
                  sprint: r.metadata?.sprint,
                  prioritize: r.metadata?.prioritize,
                  nextSteps: r.nextSteps || []
                }))
              },
              null,
              2
            ));
      if (format === 'yaml') {
        const summary = {
          workflow: normalizedName,
          steps: results.map((r) => ({
            agent: r.metadata?.agent,
            mode: r.metadata?.mode,
            sprint: r.metadata?.sprint,
            prioritize: r.metadata?.prioritize,
            nextSteps: r.nextSteps || []
          }))
        };
        const y = yaml.stringify(summary);
        const linesY = y.split('\n');
        for (const line of linesY.slice(0, 30)) {
          log.info(line);
        }
        if (linesY.length > 30) {
          log.info('... (输出已截断，使用 --output 或 --report-dir 写入完整结果)');
        }
      } else {
        const lines = preview.split('\n');
        for (const line of lines.slice(0, 30)) {
          log.info(line);
        }
        if (lines.length > 30) {
          log.info('... (输出已截断，使用 --output 或 --report-dir 写入完整结果)');
        }
      }
      // 默认输出仪表板至 .specbmad/artifacts
      const defaultDir = getProjectPath(PATHS.ARTIFACTS_DIR);
      fs.mkdirSync(defaultDir, { recursive: true });
      const dashMd = renderLlmUsageDashboard(results);
      fs.writeFileSync(path.join(defaultDir, 'llm-dashboard.md'), dashMd, 'utf-8');
      log.success(`LLM指标仪表板已写入: ${path.join(defaultDir, 'llm-dashboard.md')}`);
      try {
        const { pluginManager } = await import('@/core/plugin/manager')
        const { ArtifactsIndexerPlugin } = await import('@/plugins/artifacts-indexer')
        const name = 'artifacts-indexer'
        if (!pluginManager.hasPlugin(name)) {
          pluginManager.registerPlugin({ name, version: '0.1.0', enabled: true }, ArtifactsIndexerPlugin as any)
          await pluginManager.initializePlugin(name)
        } else {
          const p: any = pluginManager.getPlugin(name)
          if (p && p.isEnabled()) p.indexArtifacts(process.cwd())
        }
      } catch (_e) { /* Ignore plugin indexing errors */ }
    }

    log.success(`工作流结果摘要已写入: ${outPath}`);
  } catch (error) {
    log.error(`工作流执行失败: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
