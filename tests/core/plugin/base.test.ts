jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

import { BasePlugin, PluginConfig } from '@/core/plugin/base';
import { log } from '@/utils/logger';

class TestPlugin extends BasePlugin {
  public initOrder: string[] = [];

  protected async onBeforeInit(): Promise<void> {
    this.initOrder.push('onBeforeInit');
  }

  protected async onInit(): Promise<void> {
    this.initOrder.push('onInit');
  }

  protected async onAfterInit(): Promise<void> {
    this.initOrder.push('onAfterInit');
  }

  protected async onBeforeDestroy(): Promise<void> {
    this.initOrder.push('onBeforeDestroy');
  }

  protected async onDestroy(): Promise<void> {
    this.initOrder.push('onDestroy');
  }

  protected async onAfterDestroy(): Promise<void> {
    this.initOrder.push('onAfterDestroy');
  }
}

class FailingInitPlugin extends BasePlugin {
  protected async onInit(): Promise<void> {
    throw new Error('Init failed');
  }
  protected async onDestroy(): Promise<void> {}
}

class FailingDestroyPlugin extends BasePlugin {
  protected async onInit(): Promise<void> {}
  protected async onDestroy(): Promise<void> {
    throw new Error('Destroy failed');
  }
}

function createConfig(overrides: Partial<PluginConfig> = {}): PluginConfig {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    ...overrides,
  };
}

describe('BasePlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should set name and version from config', () => {
      const plugin = new TestPlugin(createConfig({ name: 'my-plugin', version: '2.0.0' }));

      expect(plugin.name).toBe('my-plugin');
      expect(plugin.version).toBe('2.0.0');
    });

    it('should set description when provided', () => {
      const plugin = new TestPlugin(createConfig({ description: 'A test plugin' }));

      expect(plugin.description).toBe('A test plugin');
    });

    it('should leave description undefined when not provided', () => {
      const plugin = new TestPlugin(createConfig());

      expect(plugin.description).toBeUndefined();
    });

    it('should default dependencies to empty array', () => {
      const plugin = new TestPlugin(createConfig());

      expect(plugin.dependencies).toEqual([]);
    });

    it('should set dependencies from config', () => {
      const plugin = new TestPlugin(createConfig({ dependencies: ['dep-a', 'dep-b'] }));

      expect(plugin.dependencies).toEqual(['dep-a', 'dep-b']);
    });

    it('should default enabled to true', () => {
      const plugin = new TestPlugin(createConfig());

      expect(plugin.isEnabled()).toBe(true);
    });

    it('should set enabled to false when config specifies false', () => {
      const plugin = new TestPlugin(createConfig({ enabled: false }));

      expect(plugin.isEnabled()).toBe(false);
    });

    it('should default settings to empty object', () => {
      const plugin = new TestPlugin(createConfig());

      expect(plugin.getAllSettings()).toEqual({});
    });

    it('should set settings from config', () => {
      const plugin = new TestPlugin(createConfig({ settings: { theme: 'dark' } }));

      expect(plugin.getAllSettings()).toEqual({ theme: 'dark' });
    });

    it('should default initialized to false', () => {
      const plugin = new TestPlugin(createConfig());

      expect(plugin.isInitialized()).toBe(false);
    });
  });

  describe('initialize()', () => {
    it('should call lifecycle hooks in order: onBeforeInit, onInit, onAfterInit', async () => {
      const plugin = new TestPlugin(createConfig());

      await plugin.initialize();

      expect(plugin.initOrder).toEqual(['onBeforeInit', 'onInit', 'onAfterInit']);
    });

    it('should set initialized to true after hooks complete', async () => {
      const plugin = new TestPlugin(createConfig());

      await plugin.initialize();

      expect(plugin.isInitialized()).toBe(true);
    });

    it('should emit initialized event', async () => {
      const plugin = new TestPlugin(createConfig({ name: 'evt-plugin' }));
      const listener = jest.fn();
      plugin.on('initialized', listener);

      await plugin.initialize();

      expect(listener).toHaveBeenCalledWith({ plugin: 'evt-plugin' });
    });

    it('should log warning and return early on double initialization', async () => {
      const plugin = new TestPlugin(createConfig({ name: 'double-init' }));

      await plugin.initialize();
      plugin.initOrder = [];
      await plugin.initialize();

      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('double-init'));
      expect(plugin.initOrder).toEqual([]);
    });

    it('should propagate error from onInit', async () => {
      const plugin = new FailingInitPlugin(createConfig());

      await expect(plugin.initialize()).rejects.toThrow('Init failed');
      expect(plugin.isInitialized()).toBe(false);
    });

    it('should log error when initialization fails', async () => {
      const plugin = new FailingInitPlugin(createConfig({ name: 'fail-plugin' }));

      await expect(plugin.initialize()).rejects.toThrow();

      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('fail-plugin'));
    });
  });

  describe('destroy()', () => {
    it('should call lifecycle hooks in order: onBeforeDestroy, onDestroy, onAfterDestroy', async () => {
      const plugin = new TestPlugin(createConfig());
      await plugin.initialize();
      plugin.initOrder = [];

      await plugin.destroy();

      expect(plugin.initOrder).toEqual(['onBeforeDestroy', 'onDestroy', 'onAfterDestroy']);
    });

    it('should set initialized to false', async () => {
      const plugin = new TestPlugin(createConfig());
      await plugin.initialize();

      await plugin.destroy();

      expect(plugin.isInitialized()).toBe(false);
    });

    it('should return early when not initialized', async () => {
      const plugin = new TestPlugin(createConfig());
      const listener = jest.fn();
      plugin.on('destroyed', listener);

      await plugin.destroy();

      expect(plugin.initOrder).toEqual([]);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should remove all listeners before emitting destroyed', async () => {
      const plugin = new TestPlugin(createConfig());
      await plugin.initialize();

      const destroyedListener = jest.fn();
      plugin.on('destroyed', destroyedListener);

      await plugin.destroy();

      // removeAllListeners() is called before emit('destroyed'),
      // so the listener registered before destroy won't fire
      expect(destroyedListener).not.toHaveBeenCalled();
    });

    it('should propagate error from onDestroy', async () => {
      const plugin = new FailingDestroyPlugin(createConfig());
      await plugin.initialize();

      await expect(plugin.destroy()).rejects.toThrow('Destroy failed');
    });
  });

  describe('enable() / disable()', () => {
    it('should set enabled to true and emit enabled event', () => {
      const plugin = new TestPlugin(createConfig({ enabled: false, name: 'toggle' }));
      const listener = jest.fn();
      plugin.on('enabled', listener);

      plugin.enable();

      expect(plugin.isEnabled()).toBe(true);
      expect(listener).toHaveBeenCalledWith({ plugin: 'toggle' });
    });

    it('should set enabled to false and emit disabled event', () => {
      const plugin = new TestPlugin(createConfig({ name: 'toggle' }));
      const listener = jest.fn();
      plugin.on('disabled', listener);

      plugin.disable();

      expect(plugin.isEnabled()).toBe(false);
      expect(listener).toHaveBeenCalledWith({ plugin: 'toggle' });
    });
  });

  describe('isEnabled() / isInitialized()', () => {
    it('should reflect current enabled state', () => {
      const plugin = new TestPlugin(createConfig());

      expect(plugin.isEnabled()).toBe(true);
      plugin.disable();
      expect(plugin.isEnabled()).toBe(false);
      plugin.enable();
      expect(plugin.isEnabled()).toBe(true);
    });

    it('should reflect current initialized state', async () => {
      const plugin = new TestPlugin(createConfig());

      expect(plugin.isInitialized()).toBe(false);
      await plugin.initialize();
      expect(plugin.isInitialized()).toBe(true);
      await plugin.destroy();
      expect(plugin.isInitialized()).toBe(false);
    });
  });

  describe('Settings management', () => {
    it('should return value for existing key via getSetting', () => {
      const plugin = new TestPlugin(createConfig({ settings: { color: 'blue' } }));

      expect(plugin.getSetting('color')).toBe('blue');
    });

    it('should return defaultValue for missing key via getSetting', () => {
      const plugin = new TestPlugin(createConfig());

      expect(plugin.getSetting('missing', 'fallback')).toBe('fallback');
    });

    it('should return undefined when key is missing and no default provided', () => {
      const plugin = new TestPlugin(createConfig());

      expect(plugin.getSetting('missing')).toBeUndefined();
    });

    it('should store value and emit settingChanged via setSetting', () => {
      const plugin = new TestPlugin(createConfig({ name: 'settings-test' }));
      const listener = jest.fn();
      plugin.on('settingChanged', listener);

      plugin.setSetting('timeout', 5000);

      expect(plugin.getSetting('timeout')).toBe(5000);
      expect(listener).toHaveBeenCalledWith({
        plugin: 'settings-test',
        key: 'timeout',
        value: 5000,
      });
    });

    it('should return a copy from getAllSettings (immutability)', () => {
      const plugin = new TestPlugin(createConfig({ settings: { a: 1 } }));

      const settings = plugin.getAllSettings();
      settings.a = 999;

      expect(plugin.getSetting('a')).toBe(1);
    });

    it('should merge settings and emit settingsUpdated via updateSettings', () => {
      const plugin = new TestPlugin(createConfig({ name: 'merge', settings: { a: 1, b: 2 } }));
      const listener = jest.fn();
      plugin.on('settingsUpdated', listener);

      plugin.updateSettings({ b: 20, c: 30 });

      expect(plugin.getAllSettings()).toEqual({ a: 1, b: 20, c: 30 });
      expect(listener).toHaveBeenCalledWith({
        plugin: 'merge',
        settings: { a: 1, b: 20, c: 30 },
      });
    });
  });

  describe('getInfo()', () => {
    it('should return correct structure with all fields', async () => {
      const plugin = new TestPlugin(
        createConfig({ name: 'info-test', version: '3.0.0', description: 'desc' })
      );
      await plugin.initialize();

      const info = plugin.getInfo();

      expect(info).toEqual({
        name: 'info-test',
        version: '3.0.0',
        description: 'desc',
        enabled: true,
        initialized: true,
      });
    });

    it('should omit description when not defined', () => {
      const plugin = new TestPlugin(createConfig({ name: 'no-desc', version: '1.0.0' }));

      const info = plugin.getInfo();

      expect(info).toEqual({
        name: 'no-desc',
        version: '1.0.0',
        enabled: true,
        initialized: false,
      });
      expect('description' in info).toBe(false);
    });
  });

  describe('cleanup()', () => {
    it('should delegate to destroy', async () => {
      const plugin = new TestPlugin(createConfig());
      await plugin.initialize();
      plugin.initOrder = [];

      await plugin.cleanup();

      expect(plugin.isInitialized()).toBe(false);
      expect(plugin.initOrder).toEqual(['onBeforeDestroy', 'onDestroy', 'onAfterDestroy']);
    });
  });
});
