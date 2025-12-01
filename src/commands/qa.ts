import { log } from '@/utils/logger';
import { config } from '@/utils/config';
import { llmManager } from '@/core/llm';
import { AgentFactory } from '@/agents/factory';
import { registerQAAgent } from '@/agents/qa';
import { AgentContext } from '@/types';
import { PerfTracer } from '@/utils/perf';
import { handleError } from '@/utils/error';
import { PATHS, getProjectPath } from '@/utils/paths';
import fs from 'fs';
import path from 'path';

function ensureDir(p: string): void {
  try { fs.mkdirSync(p, { recursive: true }); } catch (e) { void e; }
}

function defaultArtifactsDir(): string {
  return getProjectPath(PATHS.ARTIFACTS_DIR);
}

interface QaOptions {
  type?: string;
  file?: string;
  agent?: string;
  fix?: boolean;
  format?: string;
  output?: string;
  reportDir?: string;
}

export async function qaCommand(options: QaOptions): Promise<void> {
  try {
    const tracer = new PerfTracer();
    tracer.start('qa');
    log.info('开始执行质量保证检查...');

    // 加载项目配置，确保默认代理与客户端可用
    config.load();

    // 注册内置 QA 代理（若未注册）
    registerQAAgent();

    const agentType = options.agent || 'QA';
    if (!AgentFactory.has(agentType)) {
      log.error(`未找到代理类型: ${agentType}`);
      return;
    }

    // 初始化 LLM 管理器，支持 BMAD_MOCK_LLM 等环境变量下的离线客户端
    await llmManager.initialize();
    const llmClient = llmManager.getDefaultClient();
    if (!llmClient) {
      log.error('无可用的 LLM 客户端，请确保已设置默认客户端或 API Key');
      return;
    }

    const agent = AgentFactory.create(agentType, llmClient);
    const projectConfig = config.getAll();

    const format: 'json' | 'markdown' = options.format === 'json' ? 'json' : 'markdown';

    const context: AgentContext = {
      projectState: {
        projectName: projectConfig.projectName || 'SpecKit-BMAD项目',
        workflow: {
          currentStep: 'testing',
          completedSteps: []
        }
      },
      workingDirectory: process.cwd(),
      inputData: {
        type: options.type || 'unit',
        file: options.file,
        fix: !!options.fix,
        format
      }
    };

    const result = await agent.execute(context);
    if (!result.success) {
      log.error('质量保证检查失败');
      return;
    }

    const output = String(result.output || '');

    // 统一输出：默认写入 .bmad/artifacts，支持 --output 与 --report-dir 覆盖
    const artifactsDir = options.reportDir
      ? (path.isAbsolute(options.reportDir) ? options.reportDir : path.join(process.cwd(), options.reportDir))
      : defaultArtifactsDir();
    ensureDir(artifactsDir);

    const filename = format === 'json' ? 'qa.json' : 'qa.md';
    let outPath: string;
    if (options.output) {
      outPath = path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output);
    } else {
      outPath = path.join(artifactsDir, filename);
    }

    const content = format === 'json'
      ? JSON.stringify({
          success: true,
          meta: {
            type: options.type || 'unit',
            file: options.file || '',
            fix: !!options.fix,
            agent: agentType,
            timestamp: new Date().toISOString(),
          },
          result: {
            preview: output.split('\n').slice(0, 50),
          },
          raw: output,
        }, null, 2)
      : output;

    fs.writeFileSync(outPath, content, 'utf-8');
    log.success(`检查结果已写入: ${outPath}`);

    // 控制台摘要输出（与 deploy 命令一致的截断规则）
    const totalLines = content.split('\n').length;
    const previewLines = format === 'json' ? 20 : 30;
    log.info('检查结果（摘要）：');
    for (const line of content.split('\n').slice(0, previewLines)) {
      log.info(line);
    }
    if (totalLines > previewLines) {
      log.info('... (输出已截断，使用 --output 或 --report-dir 查看完整内容)');
    }

    if (result.nextSteps && result.nextSteps.length > 0) {
      log.info('下一步建议：');
      result.nextSteps.forEach((step, idx) => log.info(`${idx + 1}. ${step}`));
    }

    const sample = tracer.end('qa');
    log.info(`QA性能: ${Math.round(sample.durationMs)}ms, RSS=${sample.memory.rss}`);
    log.success('质量保证检查完成！');
  } catch (error) {
    handleError(error, { command: 'qa' });
    throw error;
  }
}