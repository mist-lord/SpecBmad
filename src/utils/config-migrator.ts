import fs from 'fs';
import path from 'path';
import { log } from './logger';
import { PATHS, LEGACY_PATHS, getProjectPath } from './paths';

/**
 * 配置路径迁移工具
 * 
 * 用于将旧的 .bmad 目录迁移到新的 .specbmad 目录结构
 */
export class ConfigMigrator {
  /**
   * 检查是否需要迁移
   */
  static needsMigration(): boolean {
    const oldBmadDir = getProjectPath(LEGACY_PATHS.OLD_BMAD_DIR);
    const newSpecbmadDir = getProjectPath(PATHS.CONFIG_DIR);
    
    // 如果旧目录存在且新目录不存在，需要迁移
    return fs.existsSync(oldBmadDir) && !fs.existsSync(newSpecbmadDir);
  }

  /**
   * 执行迁移
   */
  static migrate(dryRun: boolean = false): { migrated: boolean; files: string[] } {
    const oldBmadDir = getProjectPath(LEGACY_PATHS.OLD_BMAD_DIR);
    const newSpecbmadDir = getProjectPath(PATHS.CONFIG_DIR);
    
    if (!fs.existsSync(oldBmadDir)) {
      log.info('未找到旧的 .bmad 目录，无需迁移');
      return { migrated: false, files: [] };
    }

    if (fs.existsSync(newSpecbmadDir)) {
      log.warn('新的 .specbmad 目录已存在，跳过迁移以避免覆盖');
      return { migrated: false, files: [] };
    }

    const migratedFiles: string[] = [];

    try {
      if (dryRun) {
        log.info('🔍 干跑模式：将执行以下迁移操作：');
        this.logMigrationPlan(oldBmadDir, newSpecbmadDir);
        return { migrated: false, files: [] };
      }

      log.info('开始迁移 .bmad 目录到 .specbmad...');

      // 创建新目录
      fs.mkdirSync(newSpecbmadDir, { recursive: true });

      // 迁移文件和子目录
      const items = fs.readdirSync(oldBmadDir);
      for (const item of items) {
        const oldPath = path.join(oldBmadDir, item);
        const newPath = path.join(newSpecbmadDir, item);
        
        const stat = fs.statSync(oldPath);
        if (stat.isDirectory()) {
          // 递归复制目录
          this.copyDirectory(oldPath, newPath);
          migratedFiles.push(`目录: ${item}/`);
        } else {
          // 复制文件
          fs.copyFileSync(oldPath, newPath);
          migratedFiles.push(`文件: ${item}`);
        }
      }

      log.success(`✅ 迁移完成！共迁移 ${migratedFiles.length} 个项目`);
      log.info('建议：迁移完成后可以删除旧的 .bmad 目录');

      return { migrated: true, files: migratedFiles };
    } catch (error) {
      log.error(`迁移失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 记录迁移计划（用于干跑模式）
   */
  private static logMigrationPlan(oldDir: string, newDir: string): void {
    const items = fs.readdirSync(oldDir);
    log.info(`  从: ${oldDir}`);
    log.info(`  到: ${newDir}`);
    log.info(`  项目:`);
    for (const item of items) {
      const itemPath = path.join(oldDir, item);
      const stat = fs.statSync(itemPath);
      const type = stat.isDirectory() ? '目录' : '文件';
      log.info(`    - ${type}: ${item}`);
    }
  }

  /**
   * 递归复制目录
   */
  private static copyDirectory(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const items = fs.readdirSync(src);
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * 验证迁移结果
   */
  static verifyMigration(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const newSpecbmadDir = getProjectPath(PATHS.CONFIG_DIR);
    const oldBmadDir = getProjectPath(LEGACY_PATHS.OLD_BMAD_DIR);

    // 检查新目录是否存在
    if (!fs.existsSync(newSpecbmadDir)) {
      issues.push('新的 .specbmad 目录不存在');
    }

    // 检查关键文件/目录是否存在
    const requiredPaths = [
      PATHS.ARTIFACTS_DIR,
      PATHS.WORKFLOW_STATE_FILE,
    ];

    for (const relPath of requiredPaths) {
      const fullPath = getProjectPath(relPath);
      if (fs.existsSync(oldBmadDir) && !fs.existsSync(fullPath)) {
        // 如果旧目录还存在，检查是否有对应的文件需要迁移
        const oldPath = fullPath.replace('.specbmad', '.bmad');
        if (fs.existsSync(oldPath)) {
          issues.push(`文件未迁移: ${relPath}`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

