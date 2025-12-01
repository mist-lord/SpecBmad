import { log } from '@/utils/logger';
import { config } from '@/utils/config';
import { llmManager } from '@/core/llm';
import { AgentFactory } from '@/agents/factory';
import { registerScrumMasterAgent } from '@/agents/scrum-master';
import { AgentContext } from '@/types';
import fs from 'fs';
import path from 'path';
import { PerfTracer } from '@/utils/perf';
import { handleError } from '@/utils/error';

interface TasksOptions {
  goal?: string;
  agent?: string;
  format?: string;
  output?: string;
  reportDir?: string;
}

export async function tasksCommand(options: TasksOptions): Promise<void> {
  try {
    const tracer = new PerfTracer();
    tracer.start('tasks');
    log.info('开始执行任务规划...');

    // 加载项目配置
    config.load();

    // 注册内置 ScrumMaster 代理
    registerScrumMasterAgent();

    const agentType = options.agent || 'ScrumMaster';
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
          currentStep: 'planning',
          completedSteps: []
        }
      },
      workingDirectory: process.cwd(),
      inputData: {
        goal: options.goal || '基于当前项目需求进行迭代规划',
        format: fmt
      }
    };

    const result = await agent.execute(context);
    if (!result.success) {
      log.error('任务规划失败');
      return;
    }

    const output = String(result.output || '');

    // 写入文件支持：--output 或 --report-dir
    let outPath: string | undefined = undefined;
    if (options.output) {
      outPath = path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output);
    } else if (options.reportDir) {
      const dir = path.isAbsolute(options.reportDir) ? options.reportDir : path.join(process.cwd(), options.reportDir);
      const filename = fmt === 'json' ? 'tasks.json' : 'tasks.md';
      outPath = path.join(dir, filename);
    }

    if (outPath) {
      // 确保目录存在
      const dir = path.dirname(outPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outPath, output);
      log.success(`任务规划结果已写入: ${outPath}`);
    } else {
      log.info('任务规划结果（摘要）：');
      for (const line of output.split('\n').slice(0, 30)) {
        log.info(line);
      }
      if (output.split('\n').length > 30) {
        log.info('... (输出已截断，使用 --output 或 --report-dir 写入完整结果)');
      }
    }

    if (result.nextSteps && result.nextSteps.length > 0) {
      log.info('下一步建议：');
      result.nextSteps.forEach((step, idx) => log.info(`${idx + 1}. ${step}`));
    }

    const sample = tracer.end('tasks');
    log.info(`任务规划性能: ${Math.round(sample.durationMs)}ms, RSS=${sample.memory.rss}`);
    log.success('任务规划完成！');
  } catch (error) {
    handleError(error, { command: 'tasks' });
    throw error;
  }
}