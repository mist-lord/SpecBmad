import fs from 'fs';
import path from 'path';
import { builtInTemplates, TemplateVariant } from './templates';
import { log } from '@/utils/logger';
import { config as projectConfig } from '@/utils/config';

export interface RenderOptions {
  variant?: TemplateVariant; // A/B 测试变体
  fallbackToBuiltIn?: boolean;
}

export class PromptEngine {
  private config = projectConfig;

  constructor() {
    try { this.config.load(); } catch {}
  }

  /**
   * 渲染模板：优先从 templatesDir 读取同名文件，失败回退至内置模板
   * 模板语法：{{var}}
   */
  public render(templateName: string, data: Record<string, any>, options?: RenderOptions): string {
    const variant: TemplateVariant = options?.variant || (Math.random() < 0.5 ? 'A' : 'B');
    const templatesDir = this.config.get('templatesDir') || './templates';

    // 1) 尝试从磁盘读取变体模板：templates/<name>.<variant>.txt
    const diskContent = this.readDiskTemplate(templatesDir, templateName, variant);
    const source = diskContent || this.getBuiltInTemplate(templateName, variant, options?.fallbackToBuiltIn !== false);

    if (!source) {
      throw new Error(`未找到模板: ${templateName} (变体 ${variant})`);
    }

    const rendered = this.interpolate(source, data);
    // 简单记录用于 A/B 评估
    log.debug(`模板渲染: name=${templateName} variant=${variant} length=${rendered.length}`);
    return rendered;
  }

  private readDiskTemplate(templatesDir: string, name: string, variant: TemplateVariant): string | null {
    try {
      const fileBase = path.join(process.cwd(), templatesDir);
      const candidate = path.join(fileBase, `${name}.${variant}.txt`);
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, 'utf-8');
      }
      const generic = path.join(fileBase, `${name}.txt`);
      if (fs.existsSync(generic)) {
        return fs.readFileSync(generic, 'utf-8');
      }
    } catch (e) {
      log.debug(`读取磁盘模板失败: ${e instanceof Error ? e.message : String(e)}`);
    }
    return null;
  }

  private getBuiltInTemplate(name: string, variant: TemplateVariant, allow: boolean): string | null {
    if (!allow) return null;
    const def = builtInTemplates[name];
    if (!def) return null;
    return def.variants[variant] || null;
  }

  private interpolate(tpl: string, data: Record<string, any>): string {
    return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const v = data[key];
      if (v === undefined || v === null) return '';
      return String(v);
    });
  }
}

export const promptEngine = new PromptEngine();