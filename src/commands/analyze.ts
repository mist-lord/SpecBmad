import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { spawn, spawnSync } from 'child_process';
import { log } from '@/utils/logger';
import { config } from '@/utils/config';
import { llmManager } from '@/core/llm';
import { AgentFactory } from '@/agents/factory';
import { registerAnalystAgent } from '@/agents/analyst';
import { AgentContext } from '@/types';

// 导出命令配置
export const analyzeCommand = new Command('analyze')
  .description('运行BMAD-Method分析工作流')
  .option('-m, --mode <mode>', '分析模式 (comprehensive|business|technical|stakeholder|risk)', 'technical')
  .option('-a, --agent <agent>', '指定分析代理', 'Analyst')
  .option('-o, --output <format>', '输出格式 (json|markdown|detailed)', 'json')
  .option('-P, --proposal <id>', '分析变更提案ID')
  .option('--out-file <path>', '输出文件路径（仅直连模式）')
  .option('-v, --verbose', '详细输出')
  .action(async (options) => {
    try {
      // 自动初始化（如果需要）
      const { ensureProjectInitialized } = await import('@/utils/auto-init');
      await ensureProjectInitialized(true); // 静默模式
      
      log.info('开始BMAD-Method分析...');

      // 加载配置
      const projectConfig = config.load();

      // 检查BMAD-Method是否启用
      if (!projectConfig.bmad_method?.enabled) {
        log.warn('BMAD-Method未启用，请先配置启用');
        return;
      }

      const bridgeMode = projectConfig.integration?.bridge_mode || 'subprocess';

      // 若配置为 direct，则使用 TypeScript Agent 直接执行
      if (bridgeMode === 'direct') {
        await llmManager.initialize();

        // 注册内置 Analyst 代理（如未注册）
        registerAnalystAgent();

        const agentType = options.agent || 'Analyst';

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
                currentStep: 'analysis',
                completedSteps: []
              }
            },
            workingDirectory: process.cwd(),
            inputData: { 
              mode: options.mode,
              proposalId: options.proposal // 传递提案ID
            }
          };

          const result = await agent.execute(context);
          if (!result.success) {
            log.error('分析失败');
            return;
          }

          const outputContent = String(result.output || '');
          if (options.outFile) {
            const outPath = path.isAbsolute(options.outFile)
              ? options.outFile
              : path.join(process.cwd(), options.outFile);
            fs.writeFileSync(outPath, outputContent);
            log.success(`分析结果已写入: ${outPath}`);
          } else {
            // 控制台输出摘要
            log.info('分析结果（摘要）：');
            const preview = outputContent.split('\n').slice(0, 20).join('\n');
            console.log(preview);
            if (outputContent.split('\n').length > 20) {
              log.info('... (输出已截断，使用 --out-file 写入完整结果)');
            }
          }

          log.info('分析完成');
          return;
        }
      }

      // 子进程桥接或 API 桥接模式 (Python)
      const pythonScriptPath = path.join(process.cwd(), 'python', 'bmad_bridge.py');
      
      const args = [
        pythonScriptPath,
        'analyze',
        '--mode', options.mode,
        '--agent', options.agent
      ];

      if (options.output) args.push('--output', options.output);
      if (options.verbose) args.push('--verbose');
      // TODO: Python 桥接器也需要支持 --proposal 参数

      log.info(`执行分析命令: python ${args.join(' ')}`);

      // 检测可用的 Python 解释器
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
          log.info('分析完成');
        } else {
          log.error(`分析失败，退出码: ${code}`);
        }
      });

      pythonProcess.on('error', (error) => {
        log.error('执行分析时出错:', error.message);
      });
    } catch (error) {
      log.error('分析命令执行失败:', error);
    }
  });
