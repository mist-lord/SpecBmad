/**
 * Spec-Kit - 需求捕获 (Phase 0: Capture)
 *
 * 4-Phase MVP 定位：
 * - 输入：自然语言需求
 * - 输出：intent.yaml (结构化需求)
 * - 不依赖 Python，纯 TypeScript 实现
 *
 * 注意：这不是"形式化规范"，而是 LLM 辅助的需求结构化输出
 */

import { log } from '@/utils/logger';
import { getSpecPath } from '@/utils/paths';
import fs from 'fs';
import path from 'path';
import { IntentSpec, Requirement } from './schema';
import yaml from 'yaml';

export interface SpecKitOptions {
  input: string; // 自然语言需求
  outputPath?: string; // 输出路径，默认 /spec/intent.yaml
}

export interface SpecKitResult {
  success: boolean;
  intentSpec?: IntentSpec;
  outputPath: string;
  error?: string;
}

export class SpecKitIntegration {
  /**
   * 执行需求捕获 (Phase 0: Capture)
   *
   * 将自然语言需求转换为结构化的 intent.yaml
   */
  async execute(options: SpecKitOptions): Promise<SpecKitResult> {
    const outputPath = options.outputPath || getSpecPath('intent.yaml');

    log.info(`执行需求捕获 (Phase 0): ${options.input.substring(0, 50)}...`);

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    try {
      // 解析需求为结构化格式
      const intentSpec = this.parseRequirements(options.input);

      // 写入 YAML 文件
      const content = yaml.stringify(intentSpec);
      fs.writeFileSync(outputPath, content, 'utf-8');

      log.success(`需求捕获完成，输出: ${outputPath}`);
      return {
        success: true,
        intentSpec,
        outputPath
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`需求捕获失败: ${msg}`);
      return {
        success: false,
        outputPath,
        error: msg
      };
    }
  }

  /**
   * 解析自然语言需求为结构化格式
   *
   * 简单实现：将输入拆分为多个需求项
   * 未来可以接入 LLM 进行更智能的解析
   */
  private parseRequirements(input: string): IntentSpec {
    const requirements: Requirement[] = [];

    // 简单的需求拆分逻辑
    // 1. 按换行或句号拆分
    // 2. 过滤空行
    // 3. 为每条生成 REQ-ID
    const lines = input
      .split(/[。\n]/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      // 如果没有拆分出多条，整体作为一条需求
      requirements.push({
        id: 'REQ-001',
        description: input.trim(),
        priority: 'high'
      });
    } else {
      lines.forEach((line, index) => {
        requirements.push({
          id: `REQ-${String(index + 1).padStart(3, '0')}`,
          description: line,
          priority: index === 0 ? 'high' : 'medium'
        });
      });
    }

    // 提取标题（第一句话或前 50 字符）
    const title = this.extractTitle(input);

    return {
      schema_version: 1,
      title,
      description: input,
      requirements,
      metadata: {
        generated_by: 'spec-kit',
        timestamp: new Date().toISOString(),
        phase: 0
      }
    };
  }

  /**
   * 从输入中提取标题
   */
  private extractTitle(input: string): string {
    // 取第一行或前 50 字符
    const firstLine = input.split(/[。\n]/)[0]?.trim() || input.trim();
    if (firstLine.length > 50) {
      return firstLine.substring(0, 47) + '...';
    }
    return firstLine || '需求规格';
  }
}

export const specKit = new SpecKitIntegration();
