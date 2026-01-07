/**
 * Python 桥接层
 * 
 * 调用 Python 脚本（Spec-Kit, OpenSpec, DeepCode）
 * 处理 Python 输出（YAML/JSON）
 * 错误处理和超时控制
 */

import { execa } from 'execa';
import { log } from '@/utils/logger';
import path from 'path';
import fs from 'fs';

export interface PythonBridgeOptions {
  scriptPath: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface PythonBridgeResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  output?: unknown; // 解析后的输出（YAML/JSON）
  error?: string;
}

export class PythonBridge {
  private defaultTimeout: number = 30000; // 30秒
  private pythonCommand: string = 'python3';

  constructor() {
    // 检查 Python 是否可用
    this.detectPython();
  }

  /**
   * 检测 Python 命令
   */
  private async detectPython(): Promise<void> {
    const commands = ['python3', 'python'];
    
    for (const cmd of commands) {
      try {
        const result = await execa(cmd, ['--version'], { timeout: 5000 });
        if (result.exitCode === 0) {
          this.pythonCommand = cmd;
          log.info(`检测到 Python: ${cmd} ${result.stdout}`);
          return;
        }
      } catch {
        // 继续尝试下一个命令
      }
    }

    log.warn('未检测到 Python，Python 桥接功能可能不可用');
  }

  /**
   * 执行 Python 脚本
   */
  async execute(options: PythonBridgeOptions): Promise<PythonBridgeResult> {
    const {
      scriptPath,
      args = [],
      cwd = process.cwd(),
      timeout = this.defaultTimeout,
      env = {}
    } = options;

    // 检查脚本文件是否存在
    if (!fs.existsSync(scriptPath)) {
      return {
        success: false,
        stdout: '',
        stderr: '',
        exitCode: -1,
        error: `Python 脚本不存在: ${scriptPath}`
      };
    }

    try {
      log.debug(`执行 Python 脚本: ${scriptPath} ${args.join(' ')}`);

      const result = await execa(
        this.pythonCommand,
        [scriptPath, ...args],
        {
          cwd,
          timeout,
          env: {
            ...process.env,
            ...env
          }
        }
      );

      // 尝试解析输出（YAML 或 JSON）
      let output: unknown = undefined;
      if (result.stdout) {
        try {
          // 尝试解析为 JSON
          output = JSON.parse(result.stdout);
        } catch {
          try {
            // 尝试解析为 YAML
            const yaml = await import('yaml');
            output = yaml.parse(result.stdout);
          } catch {
            // 保持原始字符串
            output = result.stdout;
          }
        }
      }

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        output
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`Python 脚本执行失败: ${msg}`);

      // execa 错误可能包含 stdout/stderr
      if (error && typeof error === 'object' && 'stdout' in error) {
        const execaError = error as any; // execa.ExecaError 类型定义可能不可用
        return {
          success: false,
          stdout: execaError.stdout || '',
          stderr: execaError.stderr || '',
          exitCode: execaError.exitCode || -1,
          error: msg
        };
      }

      return {
        success: false,
        stdout: '',
        stderr: msg,
        exitCode: -1,
        error: msg
      };
    }
  }

  /**
   * 检查 Python 是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await execa(this.pythonCommand, ['--version'], { timeout: 5000 });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * 获取 Python 版本
   */
  async getVersion(): Promise<string | null> {
    try {
      const result = await execa(this.pythonCommand, ['--version'], { timeout: 5000 });
      return result.stdout.trim();
    } catch {
      return null;
    }
  }
}

export const pythonBridge = new PythonBridge();

