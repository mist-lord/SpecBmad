import winston from 'winston';
import chalk from 'chalk';

// 自定义日志格式
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    const colorMap: Record<string, (text: string) => string> = {
      error: chalk.red,
      warn: chalk.yellow,
      info: chalk.blue,
      debug: chalk.gray,
    };

    const colorFn = colorMap[level] || chalk.white;
    const prefix = colorFn(`[${level.toUpperCase()}]`);
    const time = chalk.gray(`${timestamp}`);
    
    if (stack) {
      return `${time} ${prefix} ${message}\n${stack}`;
    }
    
    return `${time} ${prefix} ${message}`;
  })
);

// 创建logger实例
export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: customFormat,
  transports: [
    // 控制台输出
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
    // 文件输出（错误日志）
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
    // 文件输出（所有日志）
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
  exitOnError: false,
});

// 开发环境下的额外配置
if (process.env['NODE_ENV'] !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// 导出便捷方法
export const log = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  success: (message: string, meta?: any) => logger.info(chalk.green(`✓ ${message}`), meta),
  fail: (message: string, meta?: any) => logger.error(chalk.red(`✗ ${message}`), meta),
  progress: (message: string, meta?: any) => logger.info(chalk.blue(`⏳ ${message}`), meta),
};

export default logger;