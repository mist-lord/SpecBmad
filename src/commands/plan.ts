import { Command } from 'commander';
import { log } from '@/utils/logger';
import { getProjectConfig } from '@/utils/config';
import { spawn, spawnSync } from 'child_process';
import path from 'path';

interface PlanOptions {
  type?: string;
  agent?: string;
  scale?: string;
  output?: string;
  verbose?: boolean;
}

export const planCommand = new Command('plan')
  .description('运行BMAD-Method规划工作流')
  .option('-t, --type <type>', '规划类型 (architecture|business|technical|resource|timeline)', 'technical')
  .option('-a, --agent <agent>', '指定规划代理', 'PM')
  .option('-s, --scale <level>', '项目规模级别 (0-4)', '1')
  .option('-o, --output <path>', '输出路径')
  .option('-v, --verbose', '详细输出')
  .action(async (options: PlanOptions) => {
    try {
      log.info('开始BMAD-Method规划...');
      
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
        'plan',
        '--type', options.type || 'sprint',
        '--agent', options.agent || 'PM',
        '--scale', options.scale || '1'
      ];
      
      if (options.output) {
        args.push('--output', options.output);
      }
      
      if (options.verbose) {
        args.push('--verbose');
      }
      
      log.info(`执行规划命令: python ${args.join(' ')}`);
      
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