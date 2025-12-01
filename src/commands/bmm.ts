import { Command } from 'commander';
import { log } from '@/utils/logger';
import { spawn, spawnSync } from 'child_process';
import path from 'path';

export const bmmCommand = new Command('bmm')
  .description('运行BMAD-Method商业模型管理工作流')
  .option('-o, --operation <operation>', '操作类型 (analyze|optimize|validate|evolve|compare)', 'analyze')
  .option('-a, --agent <agent>', '指定BMM代理', 'BusinessAnalyst')
  .option('--output <format>', '输出格式 (json|markdown|detailed)', 'json')
  .option('-v, --verbose', '详细输出')
  .action(async (options) => {
    try {
      log.info('开始BMAD-Method商业模型管理...');
      
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
        'bmm',
        '--operation', options.operation,
        '--agent', options.agent,
        '--output', options.output
      ];
      
      if (options.verbose) {
        args.push('--verbose');
      }
      
      log.info(`执行BMM命令: python ${args.join(' ')}`);
      
      // 检测可用的 Python 解释器
      let pythonCmd = 'python';
      const pythonCheck = spawnSync(pythonCmd, ['--version']);
      if (pythonCheck.status !== 0 || pythonCheck.error) {
        pythonCmd = 'python3';
      }

      // 执行Python桥接脚本
      const pythonProcess = spawn(pythonCmd, args, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: { ...process.env, PYTHONPATH: path.join(process.cwd(), 'python') }
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          log.info('BMM操作完成');
        } else {
          log.error(`BMM操作失败，退出码: ${code}`);
        }
      });
      
      pythonProcess.on('error', (error) => {
        log.error('执行BMM操作时出错:', error.message);
      });
      
    } catch (error) {
      log.error('BMM命令执行失败:', error);
    }
  });