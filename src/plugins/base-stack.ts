import { StackPlugin } from '@/core/stack/interface';
import { GeneratorOptions } from '@/generator';
import fs from 'fs';
import path from 'path';

export abstract class BaseStackPlugin implements StackPlugin {
  abstract name: string;
  abstract aliases?: string[];

  abstract detect(cwd: string): boolean;
  abstract generateSkeleton(options: GeneratorOptions): Promise<void>;
  abstract getRunCommand(cwd: string, script?: string): string;

  protected ensureDir(p: string) {
    fs.mkdirSync(p, { recursive: true });
  }

  protected writeFile(p: string, content: string, dryRun?: boolean) {
    this.ensureDir(path.dirname(p));
    if (!dryRun) fs.writeFileSync(p, content, 'utf-8');
  }
  
  protected toPkgName(name: string) {
    return name.replace(/[^a-zA-Z0-9_\-]/g, '').replace(/\-+/g, '_');
  }
}

