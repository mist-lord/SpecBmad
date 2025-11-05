import { Command } from 'commander';
import { log } from '@/utils/logger';
import { getProjectConfig } from '@/utils/config';
import { spawn, spawnSync } from 'child_process';
import path from 'path';

// 导出命令配置
export const analyzeCommand = new Command('analyze')
  .description('运行BMAD-Method分析工作流')
  .option('-m, --mode <mode>', '分析模式 (brainstorm|research|brief|comprehensive)', 'brief')
  .option('-a, --agent <agent>', '指定分析代理', 'Analyst')
  .option('-o, --output <path>', '输出路径')
  .option('-v, --verbose', '详细输出')
  .action(async (options) => {
    try {
      log.info('开始BMAD-Method分析...');
      
      // 加载配置
      const { config } = await import('@/utils/config');
      const projectConfig = config.load();
      
      // 检查BMAD-Method是否启用
      if (!projectConfig.bmad_method?.enabled) {
        log.warn('BMAD-Method未启用，请先配置启用');
        return;
      }
      
      // 构建Python脚本路径
      const pythonScriptPath = path.join(process.cwd(), 'python', 'bmad_bridge.py');
      
      // 准备参数
      const args = [
        pythonScriptPath,
        'analyze',
        '--mode', options.mode,
        '--agent', options.agent
      ];
      
      if (options.output) {
        args.push('--output', options.output);
      }
      
      if (options.verbose) {
        args.push('--verbose');
      }
      
      log.info(`执行分析命令: python ${args.join(' ')}`);
      
      // 检测可用的 Python 解释器
      let pythonCmd = 'python';
      const pythonCheck = spawnSync(pythonCmd, ['--version']);
      if (pythonCheck.status !== 0 || pythonCheck.error) {
        pythonCmd = 'python3';
      }

      // 执行Python桥接脚本
      const pythonProcess = spawn(pythonCmd, args, {
        stdio: 'inherit',
        cwd: process.cwd()
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