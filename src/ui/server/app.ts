import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import path from 'path';
import { statusRouter } from './routes/status';
import { changesRouter } from './routes/changes';
import { log } from '@/utils/logger';

export function createApp(): Application {
  const app = express();

  // 中间件
  app.use(cors());
  app.use(express.json());

  // API 路由
  app.use('/api/status', statusRouter);
  app.use('/api/changes', changesRouter);

  // 静态文件托管 (生产模式)
  // 假设构建后的前端文件位于 dist/ui
  // 在开发环境中，我们通常会单独运行 Vite Server，不需要这里托管
  const uiDistPath = path.join(__dirname, '../../ui'); // 调整为 dist/ui 或 client/dist
  // 注意：在 TS 编译后，dist/ui/server/app.js -> __dirname 是 dist/ui/server
  // 如果我们将前端构建到 dist/client，那么路径应该是 ../../client
  
  // 这里我们需要一个策略来定位静态资源。
  // 简单起见，我们假设用户在使用 CLI 时，dist/client 已经存在
  
  // 但在开发时，我们可能没有构建前端。
  // 作为一个简单的 fallback，如果找不到文件，我们可以只提供 API。

  // 错误处理
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    log.error(`API Error: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}
