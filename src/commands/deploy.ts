import { log } from '@/utils/logger';
import { config } from '@/utils/config';
import { PATHS, getProjectPath } from '@/utils/paths';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { PerfTracer } from '@/utils/perf';
import { handleError } from '@/utils/error';

interface DeployOptions {
  env?: 'dev' | 'staging' | 'prod';
  strategy?: 'rolling' | 'canary' | 'blue-green';
  dryRun?: boolean;
  rollback?: boolean;
  build?: boolean;
  skipTests?: boolean;
  tag?: string;
  format?: 'json' | 'markdown';
  output?: string;
  reportDir?: string;
}

function ensureDir(p: string): void {
  try { fs.mkdirSync(p, { recursive: true }); } catch (e) { void e; }
}

function defaultArtifactsDir(): string {
  return getProjectPath(PATHS.ARTIFACTS_DIR);
}

function renderMarkdown(plan: any): string {
  const lines: string[] = [];
  lines.push(`# 部署计划`);
  lines.push('');
  lines.push(`- 环境: ${plan.env}`);
  lines.push(`- 策略: ${plan.strategy}`);
  lines.push(`- 模式: ${plan.rollback ? '回滚' : (plan.dryRun ? '干跑' : '正式部署')}`);
  if (plan.tag) lines.push(`- 版本标签: ${plan.tag}`);
  lines.push(`- 时间: ${plan.timestamp}`);
  lines.push('');
  lines.push('## 步骤');
  for (const s of plan.steps) {
    lines.push(`- ${s.id}: ${s.name}`);
  }
  lines.push('');
  lines.push('## 验证');
  lines.push(`- 健康检查: ${plan.verification?.healthCheck ?? 'N/A'}`);
  lines.push(`- 回滚策略: ${plan.verification?.rollbackStrategy ?? 'N/A'}`);
  return lines.join('\n');
}

export async function deployCommand(options: DeployOptions): Promise<void> {
  try {
    const tracer = new PerfTracer();
    tracer.start('deploy');
    log.info('开始执行部署命令...');

    // 加载项目配置
    const projectConfig = config.load();

    const env = (options.env as any) || 'dev';
    const strategy = (options.strategy as any) || 'rolling';
    const dryRun = !!options.dryRun;
    const rollback = !!options.rollback;
    const format: 'json' | 'markdown' = options.format === 'markdown' ? 'markdown' : 'json';

    const planSteps: Array<{ id: string; name: string }> = [];
    if (rollback) {
      planSteps.push(
        { id: 'rollback-check', name: '校验可回滚版本' },
        { id: 'rollback-deploy', name: '回滚到上一个稳定版本' },
        { id: 'rollback-verify', name: '验证回滚后的稳定性' }
      );
    } else {
      if (options.build) planSteps.push({ id: 'build', name: '构建产物' });
      if (!options.skipTests) planSteps.push({ id: 'test', name: '运行基础验证测试' });
      planSteps.push(
        { id: 'package', name: '打包部署包' },
        { id: 'release', name: `按${strategy}策略发布到 ${env}` },
        { id: 'verify', name: '部署后健康检查与回滚策略确认' }
      );
    }

  const plan = {
    env,
    strategy,
    dryRun,
    rollback,
    tag: options.tag || '',
    timestamp: new Date().toISOString(),
    version: (projectConfig as any)?.projectVersion || '0.1.0',
    steps: planSteps,
    verification: {
      healthCheck: 'HTTP 200 / 健康端点可用',
      rollbackStrategy: strategy === 'blue-green' ? '切换流量到旧版本' : '回滚到上一个发布版本'
    }
  };

    // 可选执行：构建和基础测试（仅非干跑且非回滚时）
    if (!dryRun && !rollback) {
      if (options.build) {
        log.info('执行构建: npm run build');
        const res = spawnSync('npm', ['run', 'build'], { cwd: process.cwd(), stdio: 'inherit' });
        if (res.status !== 0) {
          log.error('构建失败，终止部署');
          return;
        }
      }
      if (!options.skipTests) {
        log.info('执行基础测试: npm test -- -i');
        const res = spawnSync('npm', ['test', '--', '-i'], { cwd: process.cwd(), stdio: 'inherit' });
        if (res.status !== 0) {
          log.warn('测试未全部通过，建议在 --skip-tests 情况下谨慎部署');
        }
      }
    }

    // 输出结果
    const artifactsDir = options.reportDir
      ? (path.isAbsolute(options.reportDir) ? options.reportDir : path.join(process.cwd(), options.reportDir))
      : defaultArtifactsDir();
    ensureDir(artifactsDir);

    const filename = rollback
      ? (format === 'json' ? 'deploy-rollback.json' : 'deploy-rollback.md')
      : (format === 'json' ? 'deploy.json' : 'deploy.md');

    let outPath: string | undefined = undefined;
    if (options.output) {
      outPath = path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output);
    } else {
      outPath = path.join(artifactsDir, filename);
    }

    const content = format === 'json' ? JSON.stringify({ success: true, plan }, null, 2) : renderMarkdown(plan);
    fs.writeFileSync(outPath, content, 'utf-8');
    log.success(`部署计划已写入: ${outPath}`);

    // 控制台摘要
    const preview = (format === 'json') ? content.split('\n').slice(0, 20).join('\n') : content.split('\n').slice(0, 30).join('\n');
    for (const line of preview.split('\n')) {
      log.info(line);
    }
    const totalLines = content.split('\n').length;
    if ((format === 'json' && totalLines > 20) || (format === 'markdown' && totalLines > 30)) {
      log.info('... (输出已截断，使用 --output 或 --report-dir 查看完整内容)');
    }

    const sample = tracer.end('deploy');
    log.info(`部署性能: ${Math.round(sample.durationMs)}ms, RSS=${sample.memory.rss}`);

    // 记录部署状态到 .specbmad/workflow.state.json（便于工作流或回滚参考）
    try {
      const stateDir = getProjectPath(PATHS.CONFIG_DIR);
      ensureDir(stateDir);
      const stateFile = getProjectPath(PATHS.WORKFLOW_STATE_FILE);
      let existing: any = {};
      if (fs.existsSync(stateFile)) {
        try { existing = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); } catch (e) { void e; }
      }
      const payload = {
        ...(existing || {}),
        lastDeployment: {
          env,
          strategy,
          rollback,
          tag: options.tag || '',
          status: 'completed',
          artifact: outPath,
          ts: new Date().toISOString()
        }
      };
      fs.writeFileSync(stateFile, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e) {
      log.warn(`写入工作流状态失败: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const releasesDir = getProjectPath(PATHS.RELEASES_DIR);
      ensureDir(releasesDir);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const relFile = path.join(releasesDir, `${options.tag || stamp}.json`);
      fs.writeFileSync(relFile, JSON.stringify({ env, strategy, tag: options.tag || '', artifact: outPath, ts: new Date().toISOString() }, null, 2), 'utf-8');
      log.info(`发布工件已生成: ${relFile}`);
    } catch {}
  } catch (error) {
    handleError(error, { command: 'deploy' });
    throw error;
  }
}
