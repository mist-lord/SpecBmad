import { HealthCheck, HealthCheckResult } from '../interface';
import { execa } from 'execa';

export class GitCheck implements HealthCheck {
  name = 'Git Environment';
  description = 'Checks if Git is installed and configured';

  async run(): Promise<HealthCheckResult> {
    try {
      const { stdout } = await execa('git', ['--version']);
      return {
        name: this.name,
        status: 'pass',
        message: `${stdout.trim()} is installed.`
      };
    } catch (e) {
      return {
        name: this.name,
        status: 'fail',
        message: 'Git is not installed.',
        suggestion: 'Install Git from https://git-scm.com/'
      };
    }
  }
}

