import { log } from '@/utils/logger';

interface StatusOptions {
  detailed?: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  try {
    log.info('项目状态:');
    
    if (options.detailed) {
      log.info('显示详细状态信息...');
      // TODO: 实现详细状态显示
    } else {
      // TODO: 实现基础状态显示
      log.info('项目: SpecKit-BMAD');
      log.info('状态: 开发中');
      log.info('版本: 0.1.0');
    }
  } catch (error) {
    log.error(`状态查看失败: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}