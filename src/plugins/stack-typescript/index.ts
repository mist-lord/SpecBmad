import { BaseStackPlugin } from '../base-stack';
import { GeneratorOptions } from '@/generator';
import path from 'path';
import fs from 'fs';

export class TypeScriptStackPlugin extends BaseStackPlugin {
  name = 'typescript';
  aliases = ['ts', 'js', 'javascript', 'node'];

  detect(cwd: string): boolean {
    const packageJsonPath = path.join(cwd, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) {
          return true;
        }
        if (pkg.devDependencies?.['@types/node'] || pkg.dependencies?.['@types/node']) {
          return true;
        }
        // 也可以作为 JS 项目的基础
        return true;
      } catch {
        // 忽略
      }
    }
    // 检查 tsconfig.json
    if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
      return true;
    }
    return false;
  }

  async generateSkeleton(opts: GeneratorOptions): Promise<void> {
    const pkg = {
      name: opts.projectName,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: { build: 'echo "build"', start: 'node dist/index.js', test: 'echo "test"' }
    };
    this.writeFile(path.join(opts.projectDir, 'package.json'), JSON.stringify(pkg, null, 2), opts.dryRun);
    this.writeFile(path.join(opts.projectDir, 'src', 'index.js'), `function main(){ console.log('hello') }\nif (typeof require !== 'undefined' && require.main === module){ main() }\n`, opts.dryRun);
    this.writeFile(path.join(opts.projectDir, 'tests', 'example.test.ts'), `describe('basic', () => { it('works', () => { expect(1).toBe(1) }) })\n`, opts.dryRun);
  }

  getRunCommand(cwd: string, script?: string): string {
    return script ? `npm run ${script}` : 'npm start';
  }

  getTestCommand(_cwd: string): string {
    return 'npm test';
  }
}

