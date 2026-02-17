jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() },
}));

jest.mock('@/utils/paths', () => ({
  PATHS: {
    SPECIFICATIONS_DIR: '.specbmad/specifications',
    ARTIFACTS_DIR: '.specbmad/artifacts',
    CONFIG_DIR: '.specbmad',
  },
}));

import fs from 'fs';
import path from 'path';
import os from 'os';
import { exportCommand } from '@/commands/export';

describe('exportCommand', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-test-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    exportCommand.exitOverride();
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should be a Command instance', () => {
    expect(exportCommand).toBeDefined();
    expect(exportCommand.name()).toBe('export');
  });

  it('should have rules subcommand', () => {
    const subcommands = exportCommand.commands.map(c => c.name());
    expect(subcommands).toContain('rules');
  });

  describe('rules subcommand', () => {
    it('should export cursor rules', async () => {
      await exportCommand.parseAsync(['node', 'test', 'rules', '--ide', 'cursor']);

      const cursorPath = path.join(tmpDir, '.cursorrules');
      expect(fs.existsSync(cursorPath)).toBe(true);
      const content = fs.readFileSync(cursorPath, 'utf-8');
      expect(content).toContain('Spec-Driven Development Rules');
    });

    it('should export cline rules', async () => {
      await exportCommand.parseAsync(['node', 'test', 'rules', '--ide', 'cline']);

      const clinePath = path.join(tmpDir, '.clinerules', 'spec-rules.md');
      expect(fs.existsSync(clinePath)).toBe(true);
    });

    it('should export windsurf workflows', async () => {
      await exportCommand.parseAsync(['node', 'test', 'rules', '--ide', 'windsurf']);

      const windsurfPath = path.join(tmpDir, '.windsurf', 'workflows', 'openspec-proposal.md');
      expect(fs.existsSync(windsurfPath)).toBe(true);
    });

    it('should export all IDEs when ide=all', async () => {
      await exportCommand.parseAsync(['node', 'test', 'rules', '--ide', 'all']);

      // At minimum, cursor rules should exist
      expect(fs.existsSync(path.join(tmpDir, '.cursorrules'))).toBe(true);
    });

    it('should default to all IDEs', async () => {
      await exportCommand.parseAsync(['node', 'test', 'rules']);

      expect(fs.existsSync(path.join(tmpDir, '.cursorrules'))).toBe(true);
    });
  });
});
