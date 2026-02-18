jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    debug: jest.fn(),
  },
}));

import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigMigrator } from '@/utils/config-migrator';
import { PATHS, LEGACY_PATHS } from '@/utils/paths';

describe('ConfigMigrator', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrator-test-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('needsMigration', () => {
    it('should return false when no legacy dir exists', () => {
      expect(ConfigMigrator.needsMigration()).toBe(false);
    });

    it('should return true when legacy dir exists but new dir does not', () => {
      fs.mkdirSync(path.join(tmpDir, LEGACY_PATHS.OLD_BMAD_DIR));
      expect(ConfigMigrator.needsMigration()).toBe(true);
    });

    it('should return false when both dirs exist', () => {
      fs.mkdirSync(path.join(tmpDir, LEGACY_PATHS.OLD_BMAD_DIR));
      fs.mkdirSync(path.join(tmpDir, PATHS.CONFIG_DIR));
      expect(ConfigMigrator.needsMigration()).toBe(false);
    });

    it('should return false when only new dir exists', () => {
      fs.mkdirSync(path.join(tmpDir, PATHS.CONFIG_DIR));
      expect(ConfigMigrator.needsMigration()).toBe(false);
    });
  });

  describe('migrate', () => {
    it('should return not migrated when no legacy dir', () => {
      const result = ConfigMigrator.migrate();
      expect(result.migrated).toBe(false);
      expect(result.files).toHaveLength(0);
    });

    it('should skip migration when new dir already exists', () => {
      fs.mkdirSync(path.join(tmpDir, LEGACY_PATHS.OLD_BMAD_DIR));
      fs.mkdirSync(path.join(tmpDir, PATHS.CONFIG_DIR));
      const result = ConfigMigrator.migrate();
      expect(result.migrated).toBe(false);
    });

    it('should perform dry run without copying files', () => {
      const oldDir = path.join(tmpDir, LEGACY_PATHS.OLD_BMAD_DIR);
      fs.mkdirSync(oldDir);
      fs.writeFileSync(path.join(oldDir, 'config.json'), '{}');

      const result = ConfigMigrator.migrate(true);
      expect(result.migrated).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, PATHS.CONFIG_DIR))).toBe(false);
    });

    it('should migrate files from .bmad to .specbmad', () => {
      const oldDir = path.join(tmpDir, LEGACY_PATHS.OLD_BMAD_DIR);
      fs.mkdirSync(oldDir);
      fs.writeFileSync(path.join(oldDir, 'config.json'), '{"key": "value"}');
      fs.writeFileSync(path.join(oldDir, 'state.json'), '{}');

      const result = ConfigMigrator.migrate();
      expect(result.migrated).toBe(true);
      expect(result.files.length).toBe(2);

      // Verify files were copied
      const newDir = path.join(tmpDir, PATHS.CONFIG_DIR);
      expect(fs.existsSync(path.join(newDir, 'config.json'))).toBe(true);
      expect(fs.readFileSync(path.join(newDir, 'config.json'), 'utf-8')).toBe('{"key": "value"}');
    });

    it('should migrate subdirectories recursively', () => {
      const oldDir = path.join(tmpDir, LEGACY_PATHS.OLD_BMAD_DIR);
      const subDir = path.join(oldDir, 'artifacts');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, 'report.md'), '# Report');

      const result = ConfigMigrator.migrate();
      expect(result.migrated).toBe(true);

      const newSubDir = path.join(tmpDir, PATHS.CONFIG_DIR, 'artifacts');
      expect(fs.existsSync(path.join(newSubDir, 'report.md'))).toBe(true);
    });
  });

  describe('verifyMigration', () => {
    it('should report valid when new dir exists and no legacy concerns', () => {
      fs.mkdirSync(path.join(tmpDir, PATHS.CONFIG_DIR));
      const result = ConfigMigrator.verifyMigration();
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should report issue when new dir does not exist', () => {
      const result = ConfigMigrator.verifyMigration();
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('.specbmad 目录不存在'))).toBe(true);
    });

    it('should report issue when legacy file exists but not migrated', () => {
      // Create old dir with workflow state
      const oldDir = path.join(tmpDir, LEGACY_PATHS.OLD_BMAD_DIR);
      fs.mkdirSync(oldDir);
      fs.writeFileSync(
        path.join(tmpDir, LEGACY_PATHS.OLD_BMAD_DIR, 'workflow.state.json'),
        '{}'
      );
      // Create new dir but without the workflow state
      fs.mkdirSync(path.join(tmpDir, PATHS.CONFIG_DIR));

      const result = ConfigMigrator.verifyMigration();
      expect(result.issues.some(i => i.includes('文件未迁移'))).toBe(true);
    });
  });
});
