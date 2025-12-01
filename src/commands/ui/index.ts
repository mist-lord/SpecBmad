import { Command } from 'commander';
import { createApp } from '@/ui/server/app';
import { log } from '@/utils/logger';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import express from 'express';

export const uiCommand = new Command('ui')
  .description('启动 Web Dashboard')
  .option('-p, --port <port>', '服务端口', '3000')
  .option('--dev', '开发模式 (仅启动 API Server)', false)
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const app = createApp();
    const isDev = options.dev;

    // 静态文件托管逻辑
    if (!isDev) {
      // 尝试定位前端构建产物
      // 假设在 dist/client (相对于 CLI 执行入口或安装位置)
      // 在开发源码中: src/commands/ui/index.ts -> 编译后: dist/commands/ui/index.js
      // 前端构建: client/dist -> 复制到: dist/client
      
      // 我们需要确定 dist 根目录
      const distRoot = path.resolve(__dirname, '../../'); 
      const clientDist = path.join(distRoot, 'client');
      
      log.info(`DEBUG: __dirname = ${__dirname}`);
      log.info(`DEBUG: distRoot = ${distRoot}`);
      log.info(`DEBUG: clientDist = ${clientDist}`);

      if (fs.existsSync(clientDist)) {
        log.info(`托管静态文件: ${clientDist}`);
        
        // 1. 静态资源
        app.use(express.static(clientDist));
        
        // 2. 显式处理根路径 (Debug Mode: Force read)
        app.get('/', (req, res) => {
          const indexPath = path.join(clientDist, 'index.html');
          if (fs.existsSync(indexPath)) {
            res.type('html').send(fs.readFileSync(indexPath, 'utf-8'));
          } else {
            res.status(404).send(`Debug: index.html NOT found at ${indexPath}`);
          }
        });

        // 3. SPA Fallback
        app.use((req, res, next) => {
          if (req.path.startsWith('/api')) return next();
          
          const indexPath = path.join(clientDist, 'index.html');
          if (fs.existsSync(indexPath)) {
            res.type('html').send(fs.readFileSync(indexPath, 'utf-8'));
          } else {
            res.status(404).send('SPA Fallback: index.html missing');
          }
        });
      } else {
        log.warn(`未找到前端构建产物 (${clientDist})。仅提供 API 服务。`);
        log.info(`开发建议: cd client && npm run dev`);
      }
    }

    app.listen(port, '0.0.0.0', () => {
      log.success(`Web Dashboard 已启动`);
      console.log(`\n  ${chalk.green('➜')}  Local:   ${chalk.cyan(`http://localhost:${port}`)}`);
      console.log(`  ${chalk.green('➜')}  Network: ${chalk.cyan(`http://0.0.0.0:${port}`)}`);
      if (isDev) {
        console.log(`  ${chalk.gray('➜')}  API Only Mode (Dev)`);
      }
      console.log(`  ${chalk.gray('➜')}  API:     ${chalk.cyan(`http://localhost:${port}/api/status`)}\n`);
    });
  });
