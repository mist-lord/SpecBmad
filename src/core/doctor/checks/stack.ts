import { HealthCheck, HealthCheckResult } from '../interface';
import { stackManager } from '@/core/stack/manager';
import { execa } from 'execa';

export class StackEnvCheck implements HealthCheck {
  name = 'Stack Environment';
  description = 'Checks dependencies for the current project stack';

  async run(): Promise<HealthCheckResult> {
    const cwd = process.cwd();
    const plugin = stackManager.detectStack(cwd);

    if (!plugin) {
      return {
        name: this.name,
        status: 'skip',
        message: 'No specific stack detected in current directory.'
      };
    }

    const stackName = plugin.name;

    if (stackName === 'cpp') {
      return this.checkCpp();
    } else if (stackName === 'python') {
      return this.checkPython();
    }

    return {
      name: this.name,
      status: 'pass',
      message: `Stack '${stackName}' detected, but no specific environment checks required.`
    };
  }

  private async checkCpp(): Promise<HealthCheckResult> {
    try {
      const { stdout } = await execa('cmake', ['--version']);
      const version = stdout.split('\n')[0];
      return {
        name: this.name,
        status: 'pass',
        message: `C++ Environment: ${version} is installed.`
      };
    } catch {
      return {
        name: this.name,
        status: 'fail',
        message: 'CMake not found.',
        suggestion: 'Please install CMake to build C++ projects (e.g., brew install cmake).'
      };
    }
  }
  
  private async checkPython(): Promise<HealthCheckResult> {
    try {
      const { stdout } = await execa('python', ['--version']);
      return {
        name: this.name,
        status: 'pass',
        message: `Python Environment: ${stdout.trim()} is installed.`
      };
    } catch {
      return {
        name: this.name,
        status: 'fail',
        message: 'Python not found.',
        suggestion: 'Please install Python 3.'
      };
    }
  }
}

