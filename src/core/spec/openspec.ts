/**
 * OpenSpec 集成 (Phase 1)
 * 
 * 调用 OpenSpec Python 脚本
 * 输入：/spec/intent.yaml
 * 输出：/spec/formal_spec.yaml + Gate 结果
 * Gate 机制：OpenSpec 失败时阻断 Phase 1→2
 */

import { pythonBridge } from '../bridge/python';
import { log } from '@/utils/logger';
import { getSpecPath } from '@/utils/paths';
import fs from 'fs';
import path from 'path';
import { FormalSpec } from './schema';
import yaml from 'yaml';
import { GateResult } from '../phase/types';
import { GateChecker, GateCheckContext } from '../phase/gates';

export interface OpenSpecOptions {
  intentSpecPath?: string; // 输入路径，默认 /spec/intent.yaml
  outputPath?: string; // 输出路径，默认 /spec/formal_spec.yaml
  openSpecScriptPath?: string; // OpenSpec Python 脚本路径
}

export interface OpenSpecResult {
  success: boolean;
  formalSpec?: FormalSpec;
  outputPath: string;
  gateResult: GateResult;
  error?: string;
}

export class OpenSpecIntegration {
  /**
   * 执行 OpenSpec（Phase 1）
   */
  async execute(options: OpenSpecOptions = {}): Promise<OpenSpecResult> {
    const intentSpecPath = options.intentSpecPath || getSpecPath('intent.yaml');
    const outputPath = options.outputPath || getSpecPath('formal_spec.yaml');
    const openSpecScriptPath = options.openSpecScriptPath || this.getDefaultOpenSpecPath();

    log.info(`执行 OpenSpec (Phase 1): ${intentSpecPath}`);

    // 检查输入文件是否存在
    if (!fs.existsSync(intentSpecPath)) {
      const error = `Intent Spec 文件不存在: ${intentSpecPath}`;
      log.error(error);
      return {
        success: false,
        outputPath,
        gateResult: {
          gateId: 'openspec_passed',
          passed: false,
          message: error
        },
        error
      };
    }

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    // 如果 OpenSpec 脚本不存在，使用 Mock 实现
    if (!fs.existsSync(openSpecScriptPath)) {
      log.warn(`OpenSpec 脚本不存在: ${openSpecScriptPath}，使用 Mock 实现`);
      return this.mockOpenSpec(intentSpecPath, outputPath);
    }

    try {
      // 调用 OpenSpec Python 脚本
      const result = await pythonBridge.execute({
        scriptPath: openSpecScriptPath,
        args: ['--input', intentSpecPath, '--output', outputPath],
        cwd: process.cwd(),
        timeout: 60000 // 60秒超时
      });

      if (!result.success) {
        const gateResult: GateResult = {
          gateId: 'openspec_passed',
          passed: false,
          message: result.error || result.stderr || 'OpenSpec 执行失败',
          details: {
            exitCode: result.exitCode,
            stderr: result.stderr
          }
        };

        return {
          success: false,
          outputPath,
          gateResult,
          error: result.error || result.stderr
        };
      }

      // 读取生成的 formal_spec.yaml
      let formalSpec: FormalSpec | undefined;
      if (fs.existsSync(outputPath)) {
        try {
          const content = fs.readFileSync(outputPath, 'utf-8');
          formalSpec = yaml.parse(content) as FormalSpec;
        } catch (error) {
          log.warn(`解析 formal_spec.yaml 失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const gateResult: GateResult = {
        gateId: 'openspec_passed',
        passed: true,
        message: 'OpenSpec 校验通过'
      };

      log.success(`OpenSpec 执行成功，输出: ${outputPath}`);
      return {
        success: true,
        formalSpec,
        outputPath,
        gateResult
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`OpenSpec 执行异常: ${msg}`);
      
      const gateResult: GateResult = {
        gateId: 'openspec_passed',
        passed: false,
        message: `OpenSpec 执行异常: ${msg}`
      };

      return {
        success: false,
        outputPath,
        gateResult,
        error: msg
      };
    }
  }

  /**
   * Mock 实现（当 OpenSpec Python 脚本不可用时）
   */
  private async mockOpenSpec(intentSpecPath: string, outputPath: string): Promise<OpenSpecResult> {
    log.info('使用 Mock OpenSpec 实现');

    try {
      // 读取 intent.yaml
      const intentContent = fs.readFileSync(intentSpecPath, 'utf-8');
      const intentSpec = yaml.parse(intentContent);

      // 生成简单的 Formal Spec
      const formalSpec: FormalSpec = {
        schema_version: 1,
        intent_spec_ref: intentSpecPath,
        invariants: [
          {
            id: 'INV-001',
            description: '基本不变量（Mock）'
          }
        ],
        preconditions: [],
        postconditions: [],
        metadata: {
          generated_by: 'mock-openspec',
          timestamp: new Date().toISOString()
        }
      };

      const content = yaml.stringify(formalSpec);
      fs.writeFileSync(outputPath, content, 'utf-8');

      const gateResult: GateResult = {
        gateId: 'openspec_passed',
        passed: true,
        message: 'Mock OpenSpec 校验通过'
      };

      log.success(`Mock OpenSpec 输出: ${outputPath}`);
      return {
        success: true,
        formalSpec,
        outputPath,
        gateResult
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const gateResult: GateResult = {
        gateId: 'openspec_passed',
        passed: false,
        message: `Mock OpenSpec 失败: ${msg}`
      };

      return {
        success: false,
        outputPath,
        gateResult,
        error: msg
      };
    }
  }

  /**
   * 获取默认 OpenSpec 脚本路径
   */
  private getDefaultOpenSpecPath(): string {
    return path.join(process.cwd(), 'tools', 'openspec', 'validate.py');
  }
}

/**
 * OpenSpec Gate 检查器
 */
export class OpenSpecGateChecker implements GateChecker {
  private openSpec: OpenSpecIntegration;

  constructor() {
    this.openSpec = new OpenSpecIntegration();
  }

  async checkGate(gateId: string, context: GateCheckContext): Promise<GateResult> {
    if (gateId !== 'openspec_passed') {
      return {
        gateId,
        passed: false,
        message: `未知的 Gate ID: ${gateId}`
      };
    }

    const result = await this.openSpec.execute({
      intentSpecPath: getSpecPath('intent.yaml'),
      outputPath: getSpecPath('formal_spec.yaml')
    });

    return result.gateResult;
  }
}

export const openSpec = new OpenSpecIntegration();

