/**
 * Spec 只读保护机制
 * 
 * Execution Domain（Node.js）禁止修改 /spec/*
 * 文件系统级别的保护检查
 * 违反时抛出 Architecture Violation
 */

import fs from 'fs';
import path from 'path';
import { log } from '@/utils/logger';
import { getSpecPath } from '@/utils/paths';

export class ArchitectureViolation extends Error {
  constructor(message: string) {
    super(`Architecture Violation: ${message}`);
    this.name = 'ArchitectureViolation';
  }
}

export class SpecProtection {
  private specDir: string;

  constructor(_projectRoot: string = process.cwd()) {
    this.specDir = getSpecPath();
  }

  /**
   * 检查文件路径是否在 Spec 目录下
   */
  private isSpecPath(filePath: string): boolean {
    const normalizedPath = path.resolve(filePath);
    const normalizedSpecDir = path.resolve(this.specDir);
    return normalizedPath.startsWith(normalizedSpecDir + path.sep) || normalizedPath === normalizedSpecDir;
  }

  /**
   * 检查是否可以写入 Spec 文件
   * Execution Domain（Node.js）禁止修改 Spec
   */
  checkWritePermission(filePath: string, caller?: string): void {
    if (this.isSpecPath(filePath)) {
      const callerInfo = caller ? ` (调用者: ${caller})` : '';
      const error = `Execution Domain 禁止修改 Spec 文件: ${filePath}${callerInfo}`;
      log.error(error);
      throw new ArchitectureViolation(error);
    }
  }

  /**
   * 检查是否可以删除 Spec 文件
   */
  checkDeletePermission(filePath: string, caller?: string): void {
    if (this.isSpecPath(filePath)) {
      const callerInfo = caller ? ` (调用者: ${caller})` : '';
      const error = `Execution Domain 禁止删除 Spec 文件: ${filePath}${callerInfo}`;
      log.error(error);
      throw new ArchitectureViolation(error);
    }
  }

  /**
   * 包装文件写入操作，自动检查权限
   */
  protectedWriteFileSync(filePath: string, data: string | Buffer, caller?: string): void {
    this.checkWritePermission(filePath, caller);
    fs.writeFileSync(filePath, data, 'utf-8');
  }

  /**
   * 包装文件删除操作，自动检查权限
   */
  protectedUnlinkSync(filePath: string, caller?: string): void {
    this.checkDeletePermission(filePath, caller);
    fs.unlinkSync(filePath);
  }

  /**
   * 检查是否可以读取 Spec 文件（允许）
   */
  canRead(filePath: string): boolean {
    return this.isSpecPath(filePath);
  }
}

export const specProtection = new SpecProtection();

