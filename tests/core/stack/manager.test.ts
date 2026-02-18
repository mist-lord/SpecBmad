import { StackManager } from '@/core/stack/manager';
import { StackPlugin } from '@/core/stack/interface';

jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() }
}));

function createMockPlugin(name: string, aliases: string[] = [], detectResult = false): StackPlugin {
  return {
    name,
    aliases,
    detect: jest.fn(() => detectResult),
    generateSkeleton: jest.fn(),
    getRunCommand: jest.fn(() => `run-${name}`)
  };
}

describe('StackManager', () => {
  let manager: StackManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get singleton and clear its state
    manager = StackManager.getInstance();
    // Clear plugins via register overwrite - access private field for testing
    (manager as any).plugins = new Map();
  });

  describe('singleton pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const a = StackManager.getInstance();
      const b = StackManager.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('register()', () => {
    it('should register a plugin by name', () => {
      const plugin = createMockPlugin('typescript');
      manager.register(plugin);
      expect(manager.getPlugin('typescript')).toBe(plugin);
    });

    it('should register plugin aliases', () => {
      const plugin = createMockPlugin('typescript', ['ts', 'js']);
      manager.register(plugin);
      expect(manager.getPlugin('ts')).toBe(plugin);
      expect(manager.getPlugin('js')).toBe(plugin);
    });

    it('should overwrite existing plugin with warning', () => {
      const plugin1 = createMockPlugin('typescript');
      const plugin2 = createMockPlugin('typescript');
      manager.register(plugin1);
      manager.register(plugin2);
      expect(manager.getPlugin('typescript')).toBe(plugin2);
      const { log } = require('@/utils/logger');
      expect(log.warn).toHaveBeenCalled();
    });
  });

  describe('getPlugin()', () => {
    it('should return registered plugin by name', () => {
      const plugin = createMockPlugin('python', ['py']);
      manager.register(plugin);
      expect(manager.getPlugin('python')).toBe(plugin);
    });

    it('should return plugin by alias', () => {
      const plugin = createMockPlugin('python', ['py']);
      manager.register(plugin);
      expect(manager.getPlugin('py')).toBe(plugin);
    });

    it('should be case-insensitive', () => {
      const plugin = createMockPlugin('typescript', ['ts']);
      manager.register(plugin);
      expect(manager.getPlugin('TypeScript')).toBe(plugin);
      expect(manager.getPlugin('TS')).toBe(plugin);
    });

    it('should return undefined for unregistered plugin', () => {
      expect(manager.getPlugin('rust')).toBeUndefined();
    });
  });

  describe('detectStack()', () => {
    it('should return first matching plugin', () => {
      const ts = createMockPlugin('typescript', [], false);
      const py = createMockPlugin('python', [], true);
      manager.register(ts);
      manager.register(py);
      const result = manager.detectStack('/some/dir');
      expect(result).toBe(py);
      expect(py.detect).toHaveBeenCalledWith('/some/dir');
    });

    it('should return undefined when no plugin matches', () => {
      const ts = createMockPlugin('typescript', [], false);
      manager.register(ts);
      const result = manager.detectStack('/some/dir');
      expect(result).toBeUndefined();
    });

    it('should call detect on each plugin', () => {
      const p1 = createMockPlugin('a', [], false);
      const p2 = createMockPlugin('b', [], false);
      manager.register(p1);
      manager.register(p2);
      manager.detectStack('/test');
      expect(p1.detect).toHaveBeenCalledWith('/test');
      expect(p2.detect).toHaveBeenCalledWith('/test');
    });
  });

  describe('getRegisteredStacks()', () => {
    it('should return empty array when no plugins registered', () => {
      expect(manager.getRegisteredStacks()).toEqual([]);
    });

    it('should return unique plugin names', () => {
      const ts = createMockPlugin('typescript', ['ts', 'js']);
      const py = createMockPlugin('python', ['py']);
      manager.register(ts);
      manager.register(py);
      const stacks = manager.getRegisteredStacks();
      expect(stacks).toContain('typescript');
      expect(stacks).toContain('python');
      expect(stacks).toHaveLength(2); // deduplicated from aliases
    });

    it('should deduplicate aliases', () => {
      const ts = createMockPlugin('typescript', ['ts', 'js', 'node']);
      manager.register(ts);
      const stacks = manager.getRegisteredStacks();
      // Even with 4 entries (typescript, ts, js, node), should return just 1 unique name
      expect(stacks).toHaveLength(1);
      expect(stacks[0]).toBe('typescript');
    });
  });
});
