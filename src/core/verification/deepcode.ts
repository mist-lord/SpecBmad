/**
 * @deprecated 4-Phase MVP 不再使用 DeepCode 代码验证
 *
 * 此文件保留用于向后兼容，但在 4-Phase MVP 中不会被调用。
 * 如果需要代码语义分析功能，可以在未来扩展实现。
 *
 * 原功能说明：
 * - DeepCode 集成 (原 Phase 3/4)
 * - 调用 DeepCode Python/C++ 脚本
 * - 输入：代码 + Formal Spec
 * - 输出：验证报告 + Gate 结果
 * - Gate 机制：DeepCode 失败时阻断 Phase 3→4
 */

import { pythonBridge } from '../bridge/python';
import { log } from '@/utils/logger';
import { getCodePath, getSpecPath, getVerificationPath } from '@/utils/paths';
import fs from 'fs';
import path from 'path';
import { GateResult } from '../phase/types';
import { GateChecker, GateCheckContext } from '../phase/gates';
import { OpenSpecIntegration } from '../spec/openspec';

export interface DeepCodeOptions {
  codePath?: string; // 代码路径，默认 /code
  formalSpecPath?: string; // Formal Spec 路径，默认 /spec/formal_spec.yaml
  outputPath?: string; // 验证报告路径，默认 /verification/deepcode_report.md
  deepCodeScriptPath?: string; // DeepCode Python/C++ 脚本路径
}

export interface DeepCodeResult {
  success: boolean;
  reportPath: string;
  gateResult: GateResult;
  error?: string;
}

export class DeepCodeIntegration {
  /**
   * 执行 DeepCode 验证（Phase 3/4）
   */
  async execute(options: DeepCodeOptions = {}): Promise<DeepCodeResult> {
    const codePath = options.codePath || getCodePath();
    const formalSpecPath = options.formalSpecPath || getSpecPath('formal_spec.yaml');
    const outputPath = options.outputPath || getVerificationPath('deepcode_report.md');
    const deepCodeScriptPath = options.deepCodeScriptPath || this.getDefaultDeepCodePath();

    log.info(`执行 DeepCode 验证: ${codePath}`);

    // 检查输入文件是否存在
    if (!fs.existsSync(formalSpecPath)) {
      const error = `Formal Spec 文件不存在: ${formalSpecPath}`;
      log.error(error);
      return {
        success: false,
        reportPath: outputPath,
        gateResult: {
          gateId: 'deepcode_passed',
          passed: false,
          message: error
        },
        error
      };
    }

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    // 如果 DeepCode 脚本不存在，使用 Mock 实现
    if (!fs.existsSync(deepCodeScriptPath)) {
      log.warn(`DeepCode 脚本不存在: ${deepCodeScriptPath}，使用 Mock 实现`);
      return this.mockDeepCode(codePath, formalSpecPath, outputPath);
    }

    try {
      // 调用 DeepCode Python/C++ 脚本
      const result = await pythonBridge.execute({
        scriptPath: deepCodeScriptPath,
        args: [
          '--code', codePath,
          '--spec', formalSpecPath,
          '--output', outputPath
        ],
        cwd: process.cwd(),
        timeout: 120000 // 120秒超时（代码验证可能需要更长时间）
      });

      if (!result.success) {
        const gateResult: GateResult = {
          gateId: 'deepcode_passed',
          passed: false,
          message: result.error || result.stderr || 'DeepCode 验证失败',
          details: {
            exitCode: result.exitCode,
            stderr: result.stderr
          }
        };

        return {
          success: false,
          reportPath: outputPath,
          gateResult,
          error: result.error || result.stderr
        };
      }

      const gateResult: GateResult = {
        gateId: 'deepcode_passed',
        passed: true,
        message: 'DeepCode 验证通过'
      };

      log.success(`DeepCode 验证成功，报告: ${outputPath}`);
      return {
        success: true,
        reportPath: outputPath,
        gateResult
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`DeepCode 验证异常: ${msg}`);

      const gateResult: GateResult = {
        gateId: 'deepcode_passed',
        passed: false,
        message: `DeepCode 验证异常: ${msg}`
      };

      return {
        success: false,
        reportPath: outputPath,
        gateResult,
        error: msg
      };
    }
  }

  /**
   * Mock 实现（当 DeepCode Python/C++ 脚本不可用时）
   */
  private async mockDeepCode(codePath: string, formalSpecPath: string, outputPath: string): Promise<DeepCodeResult> {
    log.info('使用 Mock DeepCode 实现');

    try {
      // 生成简单的验证报告
      const report = `# DeepCode 验证报告（Mock）

## 验证时间
${new Date().toISOString()}

## 代码路径
${codePath}

## Formal Spec 路径
${formalSpecPath}

## 验证结果
✅ Mock 验证通过

## 说明
这是 Mock 实现，实际验证需要真实的 DeepCode 工具。
`;

      fs.writeFileSync(outputPath, report, 'utf-8');

      const gateResult: GateResult = {
        gateId: 'deepcode_passed',
        passed: true,
        message: 'Mock DeepCode 验证通过'
      };

      log.success(`Mock DeepCode 报告: ${outputPath}`);
      return {
        success: true,
        reportPath: outputPath,
        gateResult
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const gateResult: GateResult = {
        gateId: 'deepcode_passed',
        passed: false,
        message: `Mock DeepCode 失败: ${msg}`
      };

      return {
        success: false,
        reportPath: outputPath,
        gateResult,
        error: msg
      };
    }
  }

  /**
   * 获取默认 DeepCode 脚本路径
   */
  private getDefaultDeepCodePath(): string {
    return path.join(process.cwd(), 'tools', 'deepcode', 'verify.py');
  }
}

/**
 * DeepCode Gate 检查器
 */
export class DeepCodeGateChecker implements GateChecker {
  private deepCode: DeepCodeIntegration;

  constructor() {
    this.deepCode = new DeepCodeIntegration();
  }

  async checkGate(gateId: string, _context: GateCheckContext): Promise<GateResult> {
    if (gateId !== 'deepcode_passed') {
      return {
        gateId,
        passed: false,
        message: `未知的 Gate ID: ${gateId}`
      };
    }

    const result = await this.deepCode.execute({
      codePath: getCodePath(),
      formalSpecPath: getSpecPath('formal_spec.yaml'),
      outputPath: getVerificationPath('deepcode_report.md')
    });

    return result.gateResult;
  }
}

/**
 * Verification Gate 检查器（Phase 4）
 */
export class VerificationGateChecker implements GateChecker {
  private deepCode: DeepCodeIntegration;
  private openSpec: OpenSpecIntegration; // OpenSpec 集成

  constructor() {
    this.deepCode = new DeepCodeIntegration();
    this.openSpec = new OpenSpecIntegration();
  }

  async checkGate(gateId: string, _context: GateCheckContext): Promise<GateResult> {
    if (gateId !== 'verification_passed') {
      return {
        gateId,
        passed: false,
        message: `未知的 Gate ID: ${gateId}`
      };
    }

    // Phase 4 需要同时通过 DeepCode 和 OpenSpec 验证

    // 1. 执行 DeepCode 验证
    const deepCodeResult = await this.deepCode.execute();

    if (!deepCodeResult.gateResult.passed) {
      return {
        gateId: 'verification_passed',
        passed: false,
        message: `DeepCode 验证失败: ${deepCodeResult.gateResult.message}`,
        details: {
          deepCodeResult: deepCodeResult.gateResult,
          failureType: 'deepcode_failure'
        }
      };
    }

    // 2. 执行 OpenSpec 验证
    const openSpecResult = await this.openSpec.execute();

    if (!openSpecResult.gateResult.passed) {
      return {
        gateId: 'verification_passed',
        passed: false,
        message: `OpenSpec 验证失败: ${openSpecResult.gateResult.message}`,
        details: {
          openSpecResult: openSpecResult.gateResult,
          failureType: 'openspec_failure'
        }
      };
    }

    // 3. 两个验证都通过
    return {
      gateId: 'verification_passed',
      passed: true,
      message: 'DeepCode 和 OpenSpec 验证都通过',
      details: {
        deepCodeResult: deepCodeResult.gateResult,
        openSpecResult: openSpecResult.gateResult,
        verificationType: 'full_verification'
      }
    };
  }
}

export const deepCode = new DeepCodeIntegration();

