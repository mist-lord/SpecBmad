import { HealthCheck, HealthCheckResult } from './interface';
import { NodeCheck } from './checks/node';
import { GitCheck } from './checks/git';
import { StackEnvCheck } from './checks/stack';
import { log } from '@/utils/logger';
import chalk from 'chalk';

export * from './interface';

export class Doctor {
  private checks: HealthCheck[] = [];

  constructor() {
    // 注册内置检查
    this.checks.push(new NodeCheck());
    this.checks.push(new GitCheck());
    this.checks.push(new StackEnvCheck());
  }

  public async diagnose(): Promise<void> {
    log.info('Running environment diagnosis...');
    console.log('');

    let hasFailure = false;

    for (const check of this.checks) {
      const result = await check.run();
      this.printResult(result);
      if (result.status === 'fail') {
        hasFailure = true;
      }
    }

    console.log('');
    if (hasFailure) {
      log.warn('Diagnosis found some issues. Please check the suggestions above.');
    } else {
      log.success('Environment is healthy! You are ready to build.');
    }
  }

  private printResult(result: HealthCheckResult): void {
    let icon = '';
    switch (result.status) {
      case 'pass': icon = chalk.green('✓'); break;
      case 'fail': icon = chalk.red('✗'); break;
      case 'warn': icon = chalk.yellow('!'); break;
      case 'skip': icon = chalk.gray('-'); break;
    }

    console.log(`${icon} ${chalk.bold(result.name)}: ${result.message}`);
    if (result.suggestion) {
      console.log(`  ${chalk.cyan('➜ Suggestion:')} ${result.suggestion}`);
    }
  }
}

