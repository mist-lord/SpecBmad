import chalk from 'chalk';
import { log } from './logger';

export class CliError extends Error {
  code: string;
  hint?: string;
  constructor(code: string, message: string, hint?: string) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.hint = hint;
  }
}

export function handleError(err: unknown, context?: { command?: string; phase?: string }): void {
  if (err instanceof CliError) {
    log.error(`(${err.code}) ${err.message}`);
    if (err.hint) {
      log.warn(chalk.yellow(`提示: ${err.hint}`));
    }
    return;
  }
  if (err instanceof Error) {
    const prefix = context?.command ? `[${context.command}] ` : '';
    log.error(`${prefix}${err.message}`);
    return;
  }
  log.error(`未知错误: ${String(err)}`);
}