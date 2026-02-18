jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

import { PluginManager } from '@/core/plugin/manager';
import { BasePlugin, PluginConfig } from '@/core/plugin/base';
import { log } from '@/utils/logger';

class TestPlugin extends BasePlugin {
  protected async onInit(): Promise<void> {}
  protected async onDestroy(): Promise<void> {}
}

class FailingPlugin extends BasePlugin {
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

function config(name: string, overrides: Partial<PluginConfig> = {}): PluginConfig {
  return { name, version: '1.0.0', ...overrides };
}

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new PluginManager();
  });

  describe('registerPlugin()', () => {
    it('should create an instance and store it', () => {
      manager.registerPlugin(config('alpha'), TestPlugin);

      expect(manager.hasPlugin('alpha')).toBe(true);
      expect(manager.getPlugin('alpha')).toBeInstanceOf(TestPlugin);
    });

    it('should set up event listeners on the plugin', () => {
      const listener = jest.fn();
      manager.on('pluginEnabled', listener);

      manager.registerPlugin(config('alpha'), TestPlugin);
      manager.enablePlugin('alpha');

      expect(listener).toHaveBeenCalledWith({ plugin: 'alpha' });
    });
  });

  describe('initializePlugin()', () => {
    it('should initialize a registered plugin', async () => {
      manager.registerPlugin(config('alpha'), TestPlugin);

      await manager.initializePlugin('alpha');

      expect(manager.getPlugin('alpha')!.isInitialized()).toBe(true);
    });

    it('should throw for unknown plugin', async () => {
      await expect(manager.initializePlugin('unknown')).rejects.toThrow();
    });

    it('should skip disabled plugin', async () => {
      manager.registerPlugin(config('alpha', { enabled: false }), TestPlugin);

      await manager.initializePlugin('alpha');

      expect(manager.getPlugin('alpha')!.isInitialized()).toBe(false);
      expect(log.warn).toHaveBeenCalled();
    });
  });

  describe('initializeAll()', () => {
    it('should initialize all enabled plugins', async () => {
      manager.registerPlugin(config('alpha'), TestPlugin);
      manager.registerPlugin(config('beta'), TestPlugin);
      manager.registerPlugin(config('gamma', { enabled: false }), TestPlugin);

      await manager.initializeAll();

      expect(manager.getPlugin('alpha')!.isInitialized()).toBe(true);
      expect(manager.getPlugin('beta')!.isInitialized()).toBe(true);
      expect(manager.getPlugin('gamma')!.isInitialized()).toBe(false);
    });

    it('should continue when a single plugin fails initialization', async () => {
      manager.registerPlugin(config('alpha'), TestPlugin);
      manager.registerPlugin(config('beta'), FailingPlugin);
      manager.registerPlugin(config('gamma'), TestPlugin);

      await manager.initializeAll();

      expect(manager.getPlugin('alpha')!.isInitialized()).toBe(true);
      expect(manager.getPlugin('beta')!.isInitialized()).toBe(false);
      expect(manager.getPlugin('gamma')!.isInitialized()).toBe(true);
      expect(log.error).toHaveBeenCalled();
    });

    it('should respect dependency order', async () => {
      const initOrder: string[] = [];
      class OrderPlugin extends BasePlugin {
        protected async onInit(): Promise<void> {
          initOrder.push(this.name);
        }
        protected async onDestroy(): Promise<void> {}
      }

      // beta depends on alpha, so alpha should init first
      manager.registerPlugin(config('alpha'), OrderPlugin);
      manager.registerPlugin(config('beta', { dependencies: ['alpha'] }), OrderPlugin);

      await manager.initializeAll();

      expect(initOrder).toEqual(['alpha', 'beta']);
    });
  });

  describe('destroyPlugin()', () => {
    it('should destroy an initialized plugin', async () => {
      manager.registerPlugin(config('alpha'), TestPlugin);
      await manager.initializePlugin('alpha');

      await manager.destroyPlugin('alpha');

      expect(manager.getPlugin('alpha')!.isInitialized()).toBe(false);
    });

    it('should throw for unknown plugin', async () => {
      await expect(manager.destroyPlugin('unknown')).rejects.toThrow();
    });
  });

  describe('destroyAll()', () => {
    it('should destroy in reverse dependency order', async () => {
      const destroyOrder: string[] = [];
      class OrderPlugin extends BasePlugin {
        protected async onInit(): Promise<void> {}
        protected async onDestroy(): Promise<void> {
          destroyOrder.push(this.name);
        }
      }

      manager.registerPlugin(config('alpha'), OrderPlugin);
      manager.registerPlugin(config('beta', { dependencies: ['alpha'] }), OrderPlugin);

      await manager.initializeAll();
      await manager.destroyAll();

      // Sorted by deps: [alpha, beta], reversed: [beta, alpha]
      expect(destroyOrder).toEqual(['beta', 'alpha']);
    });

    it('should continue when a single plugin fails to destroy', async () => {
      manager.registerPlugin(config('alpha'), TestPlugin);
      manager.registerPlugin(config('beta'), FailingDestroyPlugin);

      await manager.initializeAll();
      await manager.destroyAll();

      expect(manager.getPlugin('alpha')!.isInitialized()).toBe(false);
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('enablePlugin() / disablePlugin()', () => {
    it('should enable a plugin', () => {
      manager.registerPlugin(config('alpha', { enabled: false }), TestPlugin);

      manager.enablePlugin('alpha');

      expect(manager.getPlugin('alpha')!.isEnabled()).toBe(true);
    });

    it('should throw when enabling unknown plugin', () => {
      expect(() => manager.enablePlugin('unknown')).toThrow();
    });

    it('should disable a plugin', () => {
      manager.registerPlugin(config('alpha'), TestPlugin);

      manager.disablePlugin('alpha');

      expect(manager.getPlugin('alpha')!.isEnabled()).toBe(false);
    });

    it('should throw when disabling unknown plugin', () => {
      expect(() => manager.disablePlugin('unknown')).toThrow();
    });
  });

  describe('Query methods', () => {
    it('should return plugin by name or undefined', () => {
      manager.registerPlugin(config('alpha'), TestPlugin);

      expect(manager.getPlugin('alpha')).toBeInstanceOf(TestPlugin);
      expect(manager.getPlugin('nope')).toBeUndefined();
    });

    it('should return all registered plugins', () => {
      manager.registerPlugin(config('alpha'), TestPlugin);
      manager.registerPlugin(config('beta'), TestPlugin);

      expect(manager.getAllPlugins()).toHaveLength(2);
    });

    it('should return only enabled plugins', () => {
      manager.registerPlugin(config('alpha'), TestPlugin);
      manager.registerPlugin(config('beta', { enabled: false }), TestPlugin);

      const enabled = manager.getEnabledPlugins();

      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe('alpha');
    });

    it('should return only initialized plugins', async () => {
      manager.registerPlugin(config('alpha'), TestPlugin);
      manager.registerPlugin(config('beta'), TestPlugin);
      await manager.initializePlugin('alpha');

      const initialized = manager.getInitializedPlugins();

      expect(initialized).toHaveLength(1);
      expect(initialized[0].name).toBe('alpha');
    });

    it('should check plugin existence with hasPlugin', () => {
      manager.registerPlugin(config('alpha'), TestPlugin);

      expect(manager.hasPlugin('alpha')).toBe(true);
      expect(manager.hasPlugin('nope')).toBe(false);
    });
  });

  describe('removePlugin()', () => {
    it('should destroy if initialized, then remove from manager', async () => {
      manager.registerPlugin(config('alpha'), TestPlugin);
      await manager.initializePlugin('alpha');

      await manager.removePlugin('alpha');

      expect(manager.hasPlugin('alpha')).toBe(false);
      expect(manager.getPlugin('alpha')).toBeUndefined();
    });

    it('should handle non-existent plugin gracefully', async () => {
      await expect(manager.removePlugin('nope')).resolves.toBeUndefined();
    });

    it('should remove non-initialized plugin without error', async () => {
      manager.registerPlugin(config('alpha'), TestPlugin);

      await manager.removePlugin('alpha');

      expect(manager.hasPlugin('alpha')).toBe(false);
    });
  });

  describe('cleanup()', () => {
    it('should destroy all plugins and clear maps', async () => {
      manager.registerPlugin(config('alpha'), TestPlugin);
      manager.registerPlugin(config('beta'), TestPlugin);
      await manager.initializeAll();

      await manager.cleanup();

      expect(manager.getAllPlugins()).toHaveLength(0);
      expect(manager.hasPlugin('alpha')).toBe(false);
      expect(manager.hasPlugin('beta')).toBe(false);
    });
  });

  describe('sortPluginsByDependencies()', () => {
    it('should place dependency before dependent (A depends on B -> B first)', async () => {
      const initOrder: string[] = [];
      class OrderPlugin extends BasePlugin {
        protected async onInit(): Promise<void> {
          initOrder.push(this.name);
        }
        protected async onDestroy(): Promise<void> {}
      }

      // Register dependent first, dependency second
      manager.registerPlugin(config('A', { dependencies: ['B'] }), OrderPlugin);
      manager.registerPlugin(config('B'), OrderPlugin);

      await manager.initializeAll();

      expect(initOrder).toEqual(['B', 'A']);
    });

    it('should detect circular dependency and throw', () => {
      class OrderPlugin extends BasePlugin {
        protected async onInit(): Promise<void> {}
        protected async onDestroy(): Promise<void> {}
      }

      manager.registerPlugin(config('A', { dependencies: ['B'] }), OrderPlugin);
      manager.registerPlugin(config('B', { dependencies: ['A'] }), OrderPlugin);

      expect(manager.initializeAll()).rejects.toThrow(/循环依赖/);
    });
  });

  describe('Event forwarding', () => {
    it('should forward initialized event as pluginInitialized', async () => {
      const listener = jest.fn();
      manager.on('pluginInitialized', listener);
      manager.registerPlugin(config('alpha'), TestPlugin);

      await manager.initializePlugin('alpha');

      expect(listener).toHaveBeenCalledWith({ plugin: 'alpha' });
    });

    it('should forward enabled event as pluginEnabled', () => {
      const listener = jest.fn();
      manager.on('pluginEnabled', listener);
      manager.registerPlugin(config('alpha', { enabled: false }), TestPlugin);

      manager.enablePlugin('alpha');

      expect(listener).toHaveBeenCalledWith({ plugin: 'alpha' });
    });

    it('should forward disabled event as pluginDisabled', () => {
      const listener = jest.fn();
      manager.on('pluginDisabled', listener);
      manager.registerPlugin(config('alpha'), TestPlugin);

      manager.disablePlugin('alpha');

      expect(listener).toHaveBeenCalledWith({ plugin: 'alpha' });
    });

    it('should forward settingChanged as pluginSettingChanged', () => {
      const listener = jest.fn();
      manager.on('pluginSettingChanged', listener);
      manager.registerPlugin(config('alpha'), TestPlugin);

      manager.getPlugin('alpha')!.setSetting('key', 'val');

      expect(listener).toHaveBeenCalledWith({
        plugin: 'alpha',
        key: 'key',
        value: 'val',
      });
    });

    it('should forward settingsUpdated as pluginSettingsUpdated', () => {
      const listener = jest.fn();
      manager.on('pluginSettingsUpdated', listener);
      manager.registerPlugin(config('alpha'), TestPlugin);

      manager.getPlugin('alpha')!.updateSettings({ x: 1 });

      expect(listener).toHaveBeenCalledWith({
        plugin: 'alpha',
        settings: { x: 1 },
      });
    });
  });
});
