import { log } from '@/utils/logger';
import { config } from '@/utils/config';
import { llmManager } from '@/core/llm';
import { AgentFactory } from '@/agents/factory';
import { registerDeveloperAgent } from '@/agents/developer';
import { AgentContext } from '@/types';
import fs from 'fs';
import path from 'path';
import { PerfTracer } from '@/utils/perf';
import { handleError } from '@/utils/error';
import { readTasksMarkdown, planFromTasks, writeSkeleton, updatePackageJson, buildTraceability, writeConsistencyReport, strengthenPlanning } from '@/utils/tasks-driven';

interface ImplementOptions {
  task?: string;
  file?: string;
  agent?: string;
  review?: boolean;
  format?: string;
  output?: string;
  reportDir?: string;
}

export async function implementCommand(options: ImplementOptions): Promise<void> {
  try {
    const tracer = new PerfTracer();
    tracer.start('implement');
    log.info('开始执行代码实现...');

    // 加载项目配置，确保默认代理与客户端可用
    config.load();

    // 注册内置 Developer 代理（若未注册）
    registerDeveloperAgent();

    const agentType = options.agent || 'Developer';
    if (!AgentFactory.has(agentType)) {
      log.error(`未找到代理类型: ${agentType}`);
      return;
    }

    await llmManager.initialize();
    const llmClient = llmManager.getDefaultClient();
    if (!llmClient) {
      log.error('无可用的 LLM 客户端，请确保已设置默认客户端或 API Key');
      return;
    }

    const agent = AgentFactory.create(agentType, llmClient);
    const projectConfig = config.getAll();

    const fmt = (options.format as string) || 'markdown';

    const context: AgentContext = {
      projectState: {
        projectName: projectConfig.projectName || 'SpecKit-BMAD项目',
        workflow: {
          currentStep: 'implementation',
          completedSteps: []
        }
      },
      workingDirectory: process.cwd(),
      inputData: {
        task: options.task,
        file: options.file,
        review: !!options.review,
        format: fmt
      }
    };

    const result = await agent.execute(context);
    if (!result.success) {
      log.error('代码实现失败');
      return;
    }

    const output = String(result.output || '');

    // 写入文件支持：--output 或 --report-dir
    let outPath: string | undefined = undefined;
    if (options.output) {
      outPath = path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output);
    } else if (options.reportDir) {
      const dir = path.isAbsolute(options.reportDir) ? options.reportDir : path.join(process.cwd(), options.reportDir);
      const filename = fmt === 'json' ? 'implement.json' : 'implement.md';
      outPath = path.join(dir, filename);
    }

    const projectDir = path.join(process.cwd(), 'generated', 'project');
    const { getArtifactsPath } = await import('@/utils/paths');
    const tasksPath = getArtifactsPath('tasks.md');
    const tasksMd = readTasksMarkdown(tasksPath);
    let files: string[] = [];
    let tests: string[] = [];
    if (tasksMd) {
      const plans = planFromTasks(tasksMd);
      const written = writeSkeleton(projectDir, plans);
      files = written.files;
      tests = written.tests;
      updatePackageJson(projectDir);
      strengthenPlanning(process.cwd(), plans.map(p => p.name));
      try {
        const extra: string[] = [];
        for (const f of files) {
          if (f.endsWith('.js') && f.includes(path.join(projectDir, 'src'))) {
            const cjs = f.replace(/\.js$/, '.cjs');
            const content = fs.readFileSync(f, 'utf-8');
            fs.writeFileSync(cjs, content, 'utf-8');
            extra.push(cjs);
          }
        }
        files.push(...extra);
      } catch (_e) { /* Ignore CJS conversion errors */ }
      try {
        const pkg = path.join(projectDir, 'package.json');
        if (fs.existsSync(pkg)) {
          const raw = fs.readFileSync(pkg, 'utf-8');
          const obj = JSON.parse(raw);
          obj.scripts = obj.scripts || {};
          obj.scripts.test = 'node tests/run-tests.js';
          fs.writeFileSync(pkg, JSON.stringify(obj, null, 2), 'utf-8');
        }
      } catch (_e) { /* Ignore package.json update errors */ }
      writeConsistencyReport(process.cwd(), {
        files,
        tests,
        tasks: (tasksMd.match(/^-\s+/gm) || []).length,
        stories: (tasksMd.match(/\*\*用户故事/g) || []).length
      });
      const trace = buildTraceability(tasksMd, files, tests);
      if (output && !output.includes('## Traceability')) {
        const combined = `${output}\n\n${trace}\n`;
        result.output = combined;
      }
    }

    if (outPath) {
      // 确保目录存在
      const dir = path.dirname(outPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outPath, String(result.output || output));
      log.success(`实现结果已写入: ${outPath}`);
    } else {
      log.info('实现结果（摘要）：');
      for (const line of String(result.output || output).split('\n').slice(0, 30)) {
        log.info(line);
      }
      if (String(result.output || output).split('\n').length > 30) {
        log.info('... (输出已截断，使用 --output 或 --report-dir 写入完整结果)');
      }
    }

    if (result.nextSteps && result.nextSteps.length > 0) {
      log.info('下一步建议：');
      result.nextSteps.forEach((step, idx) => log.info(`${idx + 1}. ${step}`));
    }

    const sample = tracer.end('implement');
    log.info(`实现性能: ${Math.round(sample.durationMs)}ms, RSS=${sample.memory.rss}`);
    log.success('代码实现完成！');
  } catch (error) {
    handleError(error, { command: 'implement' });
    throw error;
  }
}
