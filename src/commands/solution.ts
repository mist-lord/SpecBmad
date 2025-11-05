import { Command } from 'commander';
import { log } from '@/utils/logger';
import { getProjectConfig } from '@/utils/config';
import { spawn, spawnSync } from 'child_process';
import path from 'path';

export const solutionCommand = new Command('solution')
  .description('运行BMAD-Method解决方案工作流')
  .option('-t, --type <type>', '解决方案类型 (implementation|optimization|migration|integration|deployment)', 'implementation')
  .option('-a, --agent <agent>', '指定解决方案代理', 'Architect')
  .option('-d, --depth <level>', '分析深度等级 (1|2|3|4|5)', '3')
  .option('-o, --output <path>', '输出路径')
  .option('-v, --verbose', '详细输出')
  .action(async (options) => {
    try {
      log.info('开始BMAD-Method解决方案设计...');
      
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
        'solution',
        '--type', options.type,
        '--agent', options.agent,
        '--depth', options.depth
      ];
      
      if (options.output) {
        args.push('--output', options.output);
      }
      
      if (options.verbose) {
        args.push('--verbose');
      }
      
      log.info(`执行解决方案命令: python ${args.join(' ')}`);
      
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
          log.info('解决方案设计完成');
        } else {
          log.error(`解决方案设计失败，退出码: ${code}`);
        }
      });
      
      pythonProcess.on('error', (error) => {
        log.error('执行解决方案设计时出错:', error.message);
      });
      
    } catch (error) {
      log.error('解决方案命令执行失败:', error);
    }
  });