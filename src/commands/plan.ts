import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { spawn, spawnSync } from 'child_process';
import { log } from '@/utils/logger';
import { config } from '@/utils/config';
import { llmManager } from '@/core/llm';
import { AgentFactory } from '@/agents/factory';
import { registerArchitectAgent } from '@/agents/architect';
import { AgentContext } from '@/types';

interface PlanOptions {
  type?: string;
  agent?: string;
  scale?: string;
  output?: string;
  outFile?: string;
  verbose?: boolean;
}

export const planCommand = new Command('plan')
  .description('运行BMAD-Method规划工作流')
  .option('-t, --type <type>', '规划类型 (architecture|business|technical|resource|timeline)', 'technical')
  .option('-a, --agent <agent>', '指定规划代理', 'Architect')
  .option('-s, --scale <level>', '项目规模级别 (0-4)', '1')
  .option('-o, --output <format>', '输出格式 (json|markdown|detailed)', 'json')
  .option('--out-file <path>', '输出文件路径（仅直连模式）')
  .option('-v, --verbose', '详细输出')
  .action(async (options: PlanOptions) => {
    try {
      log.info('开始BMAD-Method规划...');

      // 加载配置
      const projectConfig = config.load();

      // 检查BMAD-Method是否启用
      if (!projectConfig.bmad_method?.enabled) {
        log.warn('BMAD-Method未启用，请先配置启用');
        return;
      }

      const bridgeMode = projectConfig.integration?.bridge_mode || 'subprocess';

      // direct 模式：使用 TypeScript ArchitectAgent 直接执行
      if (bridgeMode === 'direct') {
        await llmManager.initialize();
        registerArchitectAgent();

        const agentType = options.agent || 'Architect';
        if (!AgentFactory.has(agentType)) {
          log.warn(`未找到代理类型: ${agentType}，将回退到 Python 子进程模式`);
        } else {
          const llmClient = llmManager.getDefaultClient();
          if (!llmClient) {
            log.error('无可用的 LLM 客户端，请确保已设置 ANTHROPIC_API_KEY 或在配置中启用代理');
            return;
          }

          const agent = AgentFactory.create(agentType, llmClient);
          const context: AgentContext = {
            projectState: {
              projectName: projectConfig.projectName || 'SpecKit-BMAD项目',
              workflow: {
                currentStep: 'planning',
                completedSteps: []
              }
            },
            workingDirectory: process.cwd(),
            inputData: { type: options.type || 'technical', scale: options.scale || '1' }
          };

          const result = await agent.execute(context);
          if (!result.success) {
            log.error('规划失败');
            return;
          }

          const outputContent = String(result.output || '');
          if (options.outFile) {
            const outPath = path.isAbsolute(options.outFile)
              ? options.outFile
              : path.join(process.cwd(), options.outFile);
            fs.writeFileSync(outPath, outputContent);
            log.success(`规划结果已写入: ${outPath}`);
          } else {
            log.info('规划结果（摘要）：');
            const preview = outputContent.split('\n').slice(0, 20).join('\n');
            console.log(preview);
            if (outputContent.split('\n').length > 20) {
              log.info('... (输出已截断，使用 --out-file 写入完整结果)');
            }
          }

          log.info('规划完成');
          return;
        }
      }

      // 子进程桥接或 API 桥接模式
      const pythonScriptPath = path.join(process.cwd(), 'python', 'bmad_bridge.py');
      const args = [
        pythonScriptPath,
        'plan',
        '--type', options.type || 'technical',
        '--agent', options.agent || 'Architect',
        '--scale', options.scale || '1'
      ];

      if (options.output) args.push('--output', options.output);
      if (options.verbose) args.push('--verbose');

      log.info(`执行规划命令: python ${args.join(' ')}`);

      let pythonCmd = 'python';
      const pythonCheck = spawnSync(pythonCmd, ['--version']);
      if (pythonCheck.status !== 0 || pythonCheck.error) {
        pythonCmd = 'python3';
      }

      const pythonProcess = spawn(pythonCmd, args, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: { ...process.env, PYTHONPATH: path.join(process.cwd(), 'python') }
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          log.info('规划完成');
        } else {
          log.error(`规划失败，退出码: ${code}`);
        }
      });

      pythonProcess.on('error', (error) => {
        log.error('执行规划时出错:', error.message);
      });
    } catch (error) {
      log.error('规划命令执行失败:', error);
    }
  });
