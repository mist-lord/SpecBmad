jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('chalk', () => ({
  cyan: jest.fn((s: string) => s),
  green: jest.fn((s: string) => s),
}));

jest.mock('@/utils/config', () => {
  const mockSave = jest.fn();
  return {
    ConfigManager: jest.fn().mockImplementation(() => ({
      save: mockSave,
      load: jest.fn().mockReturnValue({}),
    })),
    config: {
      save: mockSave,
      load: jest.fn().mockReturnValue({}),
    },
  };
});

jest.mock('@/utils/config-migrator', () => ({
  ConfigMigrator: {
    needsMigration: jest.fn().mockReturnValue(false),
    migrate: jest.fn(),
  },
}));

jest.mock('@/core/project/status', () => ({
  ProjectStatusManager: jest.fn().mockImplementation(() => ({
    isInitialized: jest.fn().mockReturnValue(false),
  })),
}));

jest.mock('@/core/stack', () => ({
  stackManager: {
    detectStack: jest.fn().mockReturnValue(null),
  },
}));

import { ensureProjectInitialized, autoConfigureLLM } from '@/utils/auto-init';
import { ProjectStatusManager } from '@/core/project/status';
import { ConfigMigrator } from '@/utils/config-migrator';
import { ConfigManager } from '@/utils/config';
import { stackManager } from '@/core/stack';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('auto-init', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoinit-test-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    (ConfigMigrator.needsMigration as jest.Mock).mockReturnValue(false);
    (ConfigMigrator.migrate as jest.Mock).mockImplementation(() => undefined);
    (ProjectStatusManager as jest.Mock).mockImplementation(() => ({
      isInitialized: jest.fn().mockReturnValue(false),
    }));
    (stackManager.detectStack as jest.Mock).mockReturnValue(null);
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('ensureProjectInitialized', () => {
    it('should return early if already initialized', async () => {
      (ProjectStatusManager as jest.Mock).mockImplementation(() => ({
        isInitialized: jest.fn().mockReturnValue(true),
      }));

      await ensureProjectInitialized();

      expect(ConfigMigrator.needsMigration).not.toHaveBeenCalled();
    });

    it('should check for migration when not initialized', async () => {
      (ProjectStatusManager as jest.Mock).mockImplementation(() => ({
        isInitialized: jest.fn().mockReturnValue(false),
      }));

      await ensureProjectInitialized();

      expect(ConfigMigrator.needsMigration).toHaveBeenCalled();
    });

    it('should attempt migration when needed', async () => {
      (ProjectStatusManager as jest.Mock).mockImplementation(() => ({
        isInitialized: jest.fn()
          .mockReturnValueOnce(false)  // first check
          .mockReturnValueOnce(true),  // after migration
      }));
      (ConfigMigrator.needsMigration as jest.Mock).mockReturnValue(true);

      await ensureProjectInitialized();

      expect(ConfigMigrator.migrate).toHaveBeenCalledWith(false);
    });

    it('should auto-init when migration does not resolve', async () => {
      (ProjectStatusManager as jest.Mock).mockImplementation(() => ({
        isInitialized: jest.fn().mockReturnValue(false),
      }));

      await ensureProjectInitialized();

      // Should have called ConfigManager.save via autoInit
      expect(ConfigManager).toHaveBeenCalled();
    });

    it('should be silent when silent=true', async () => {
      const { log } = require('@/utils/logger');
      (ProjectStatusManager as jest.Mock).mockImplementation(() => ({
        isInitialized: jest.fn().mockReturnValue(true),
      }));

      await ensureProjectInitialized(true);

      expect(log.debug).not.toHaveBeenCalled();
    });

    it('should handle migration failure gracefully', async () => {
      const { log } = require('@/utils/logger');
      (ProjectStatusManager as jest.Mock).mockImplementation(() => ({
        isInitialized: jest.fn().mockReturnValue(false),
      }));
      (ConfigMigrator.needsMigration as jest.Mock).mockReturnValue(true);
      (ConfigMigrator.migrate as jest.Mock).mockImplementation(() => {
        throw new Error('Migration failed');
      });

      // Should not throw - graceful handling
      await ensureProjectInitialized();

      expect(log.warn).toHaveBeenCalled();
    });

    it('should use detected plugin language when stack manager matches', async () => {
      (ProjectStatusManager as jest.Mock).mockImplementation(() => ({
        isInitialized: jest.fn().mockReturnValue(false),
      }));
      (stackManager.detectStack as jest.Mock).mockReturnValue({ name: 'python' });

      await ensureProjectInitialized(true);

      const instance = (ConfigManager as unknown as jest.Mock).mock.results[0].value;
      expect(instance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'python',
        }),
      );
    });

    it('should detect javascript + express enterprise project from package.json', async () => {
      (ProjectStatusManager as jest.Mock).mockImplementation(() => ({
        isInitialized: jest.fn().mockReturnValue(false),
      }));
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ dependencies: { express: '^4.0.0' } }),
      );

      await ensureProjectInitialized(true);

      const instance = (ConfigManager as unknown as jest.Mock).mock.results[0].value;
      expect(instance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'javascript',
          framework: 'express',
          type: 'enterprise',
        }),
      );
    });

    it('should detect typescript + nextjs web project from package.json', async () => {
      (ProjectStatusManager as jest.Mock).mockImplementation(() => ({
        isInitialized: jest.fn().mockReturnValue(false),
      }));
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          dependencies: { react: '^18.0.0', next: '^14.0.0' },
          devDependencies: { typescript: '^5.0.0' },
        }),
      );

      await ensureProjectInitialized(true);

      const instance = (ConfigManager as unknown as jest.Mock).mock.results[0].value;
      expect(instance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'typescript',
          framework: 'nextjs',
          type: 'web',
        }),
      );
    });

    it('should detect enterprise type from package bin fallback path', async () => {
      (ProjectStatusManager as jest.Mock).mockImplementation(() => ({
        isInitialized: jest.fn().mockReturnValue(false),
      }));
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'cli-demo', bin: { demo: './bin/demo.js' } }),
      );

      await ensureProjectInitialized(true);

      const instance = (ConfigManager as unknown as jest.Mock).mock.results[0].value;
      expect(instance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'javascript',
          framework: undefined,
          type: 'enterprise',
        }),
      );
    });

    it('should fallback to defaults when package.json is invalid', async () => {
      (ProjectStatusManager as jest.Mock).mockImplementation(() => ({
        isInitialized: jest.fn().mockReturnValue(false),
      }));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{invalid-json');

      await ensureProjectInitialized(true);

      const instance = (ConfigManager as unknown as jest.Mock).mock.results[0].value;
      expect(instance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'typescript',
          framework: undefined,
          type: 'web',
        }),
      );
    });
  });

  describe('autoConfigureLLM', () => {
    it('should initialize LLM manager', async () => {
      const mockInit = jest.fn().mockResolvedValue(undefined);
      const mockGetClientStatus = jest.fn().mockResolvedValue([
        { name: 'OpenAI', available: true },
      ]);

      jest.doMock('@/core/llm/manager', () => ({
        llmManager: {
          initialize: mockInit,
          getClientStatus: mockGetClientStatus,
        },
      }));

      // Re-import to pick up the mock
      jest.resetModules();
      // Need to re-mock dependencies that are cleared by resetModules
      jest.doMock('@/utils/logger', () => ({
        log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), success: jest.fn(), debug: jest.fn() },
      }));
      jest.doMock('chalk', () => ({ cyan: (s: string) => s }));

      const { autoConfigureLLM: freshAutoConfigureLLM } = require('@/utils/auto-init');
      await freshAutoConfigureLLM();

      expect(mockInit).toHaveBeenCalled();
    });

    it('should handle initialization failure gracefully', async () => {
      jest.resetModules();
      jest.doMock('@/utils/logger', () => ({
        log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), success: jest.fn(), debug: jest.fn() },
      }));
      jest.doMock('chalk', () => ({ cyan: (s: string) => s }));
      jest.doMock('@/core/llm/manager', () => ({
        llmManager: {
          initialize: jest.fn().mockRejectedValue(new Error('No API key')),
        },
      }));

      const { autoConfigureLLM: freshAutoConfigureLLM } = require('@/utils/auto-init');
      // Should not throw
      await expect(freshAutoConfigureLLM()).resolves.toBeUndefined();
    });

    it('should log offline hints when only mock client is available', async () => {
      jest.resetModules();
      const info = jest.fn();
      const warn = jest.fn();
      jest.doMock('@/utils/logger', () => ({
        log: { info, warn, error: jest.fn(), success: jest.fn(), debug: jest.fn() },
      }));
      jest.doMock('chalk', () => ({ cyan: (s: string) => s }));
      jest.doMock('@/core/llm/manager', () => ({
        llmManager: {
          initialize: jest.fn().mockResolvedValue(undefined),
          getClientStatus: jest.fn().mockResolvedValue([{ name: 'Mock', available: true }]),
        },
      }));

      const { autoConfigureLLM: freshAutoConfigureLLM } = require('@/utils/auto-init');
      await freshAutoConfigureLLM(false);

      expect(info).toHaveBeenCalledWith('💡 未检测到 LLM API Key，使用离线 Mock 模式');
      expect(info).toHaveBeenCalledWith('   提示：设置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY 可使用真实 AI');
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
