import { Router, Request, Response } from 'express';
import { ProjectStatusManager } from '@/core/project/status';
import { ConfigManager } from '@/utils/config';

export const statusRouter: Router = Router();

statusRouter.get('/', async (req: Request, res: Response) => {
  try {
    const statusManager = new ProjectStatusManager();
    const configManager = new ConfigManager();
    
    const projectConfig = configManager.load();
    
    // 获取详细状态
    const tasks = await statusManager.getTasksStatus();
    const agents = await statusManager.getAgentsStatus();
    const files = await statusManager.getFilesStatus();
    
    res.json({
      project: {
        name: projectConfig.projectName,
        language: projectConfig.language,
        framework: projectConfig.framework,
        type: projectConfig.type
      },
      status: {
        tasks,
        agents,
        files
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});
