import { HealthCheck, HealthCheckResult } from '../interface';
import { execa } from 'execa';
import semver from 'semver';

export class NodeCheck implements HealthCheck {
  name = 'Node.js Environment';
  description = 'Checks Node.js version and npm/pnpm availability';

  async run(): Promise<HealthCheckResult> {
    try {
      const { stdout } = await execa('node', ['--version']);
      const version = stdout.trim(); // e.g., v18.16.0
      
      if (semver.lt(version, '18.0.0')) {
        return {
          name: this.name,
          status: 'fail',
          message: `Node.js version ${version} is too old.`,
          suggestion: 'Please upgrade to Node.js 18.0.0 or later.'
        };
      }

      return {
        name: this.name,
        status: 'pass',
        message: `Node.js ${version} is installed.`
      };
    } catch (e) {
      return {
        name: this.name,
        status: 'fail',
        message: 'Node.js is not installed or not found in PATH.',
        suggestion: 'Install Node.js from https://nodejs.org/'
      };
    }
  }
}

