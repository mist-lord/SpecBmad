/**
 * Spec-Kit 集成 (Phase 0)
 * 
 * 调用 Spec-Kit Python 脚本
 * 输入：自然语言需求
 * 输出：/spec/intent.yaml
 */

import { pythonBridge, PythonBridgeResult } from '../bridge/python';
import { log } from '@/utils/logger';
import { getSpecPath } from '@/utils/paths';
import fs from 'fs';
import path from 'path';
import { IntentSpec } from './schema';
import yaml from 'yaml';

export interface SpecKitOptions {
  input: string; // 自然语言需求
  outputPath?: string; // 输出路径，默认 /spec/intent.yaml
  specKitScriptPath?: string; // Spec-Kit Python 脚本路径
}

export interface SpecKitResult {
  success: boolean;
  intentSpec?: IntentSpec;
  outputPath: string;
  error?: string;
}

export class SpecKitIntegration {
  /**
   * 执行 Spec-Kit（Phase 0）
   */
  async execute(options: SpecKitOptions): Promise<SpecKitResult> {
    const outputPath = options.outputPath || getSpecPath('intent.yaml');
    const specKitScriptPath = options.specKitScriptPath || this.getDefaultSpecKitPath();

    log.info(`执行 Spec-Kit (Phase 0): ${options.input.substring(0, 50)}...`);

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    // 如果 Spec-Kit 脚本不存在，使用 Mock 实现
    if (!fs.existsSync(specKitScriptPath)) {
      log.warn(`Spec-Kit 脚本不存在: ${specKitScriptPath}，使用 Mock 实现`);
      return this.mockSpecKit(options.input, outputPath);
    }

    try {
      // 创建临时输入文件
      const tempInputFile = path.join(outputDir, '.spec-kit-input.txt');
      fs.writeFileSync(tempInputFile, options.input, 'utf-8');

      // 调用 Spec-Kit Python 脚本
      const result = await pythonBridge.execute({
        scriptPath: specKitScriptPath,
        args: ['--input', tempInputFile, '--output', outputPath],
        cwd: process.cwd(),
        timeout: 60000 // 60秒超时
      });

      // 清理临时文件
      if (fs.existsSync(tempInputFile)) {
        fs.unlinkSync(tempInputFile);
      }

      if (!result.success) {
        return {
          success: false,
          outputPath,
          error: result.error || result.stderr || 'Spec-Kit 执行失败'
        };
      }

      // 读取生成的 intent.yaml
      let intentSpec: IntentSpec | undefined;
      if (fs.existsSync(outputPath)) {
        try {
          const content = fs.readFileSync(outputPath, 'utf-8');
          intentSpec = yaml.parse(content) as IntentSpec;
        } catch (error) {
          log.warn(`解析 intent.yaml 失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      log.success(`Spec-Kit 执行成功，输出: ${outputPath}`);
      return {
        success: true,
        intentSpec,
        outputPath
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`Spec-Kit 执行异常: ${msg}`);
      return {
        success: false,
        outputPath,
        error: msg
      };
    }
  }

  /**
   * Mock 实现（当 Spec-Kit Python 脚本不可用时）
   */
  private mockSpecKit(input: string, outputPath: string): SpecKitResult {
    log.info('使用 Mock Spec-Kit 实现');

    const intentSpec: IntentSpec = {
      schema_version: 1,
      title: '需求规格',
      description: input,
      requirements: [
        {
          id: 'REQ-001',
          description: input,
          priority: 'high'
        }
      ],
      metadata: {
        generated_by: 'mock-spec-kit',
        timestamp: new Date().toISOString()
      }
    };

    try {
      const content = yaml.stringify(intentSpec);
      fs.writeFileSync(outputPath, content, 'utf-8');
      log.success(`Mock Spec-Kit 输出: ${outputPath}`);
      return {
        success: true,
        intentSpec,
        outputPath
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        outputPath,
        error: msg
      };
    }
  }

  /**
   * 获取默认 Spec-Kit 脚本路径
   */
  private getDefaultSpecKitPath(): string {
    // 默认路径：项目根目录下的 tools/spec-kit/specify.py
    // 或者可以从环境变量/配置中读取
    return path.join(process.cwd(), 'tools', 'spec-kit', 'specify.py');
  }
}

export const specKit = new SpecKitIntegration();

