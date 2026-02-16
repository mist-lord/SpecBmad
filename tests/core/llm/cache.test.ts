/**
 * LLM Cache Tests
 *
 * Tests for LLM response caching with TTL and persistence
 */

// Mock config object (must be defined before mock)
const mockConfigObj = {
  load: jest.fn(),
  get: jest.fn((key: string) => {
    const config: any = {
      cacheDir: '.specbmad/cache',
      llmCacheEnabled: true,
      llmCacheTTLSeconds: 3600,
    };
    return config[key];
  }),
};

// Mock dependencies (must be before imports)
jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/utils/config', () => ({
  config: mockConfigObj,
}));

import { LLMCache } from '@/core/llm/cache';
import * as fs from 'fs';
import * as path from 'path';
import {
  createTempCoreDir,
  cleanupTempCoreDir,
  mockDateNow,
  restoreDateNow,
  coreTestFixtures,
} from '../core-test-utils';

describe('LLMCache', () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    tmpDir = createTempCoreDir('cache-test-');
    originalCwd = process.cwd();
    originalNodeEnv = process.env.NODE_ENV;
    process.chdir(tmpDir);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    cleanupTempCoreDir(tmpDir);
    restoreDateNow();
  });

  describe('constructor', () => {
    it('should create cache directory if it does not exist', () => {
      delete process.env.NODE_ENV; // Enable persistence

      const cache = new LLMCache();

      const cacheDir = path.join(tmpDir, '.specbmad', 'cache');
      expect(fs.existsSync(cacheDir)).toBe(true);
    });

    it('should create cache file if it does not exist', () => {
      delete process.env.NODE_ENV;

      const cache = new LLMCache();

      const cacheFile = path.join(tmpDir, '.specbmad', 'cache', 'llm.json');
      expect(fs.existsSync(cacheFile)).toBe(true);
    });

    it('should load existing cache from disk', () => {
      delete process.env.NODE_ENV;

      const cacheDir = path.join(tmpDir, '.specbmad', 'cache');
      fs.mkdirSync(cacheDir, { recursive: true });

      const existingData = {
        'test-key': {
          key: 'test-key',
          value: 'test-value',
          createdAt: Date.now(),
        },
      };
      fs.writeFileSync(
        path.join(cacheDir, 'llm.json'),
        JSON.stringify(existingData),
        'utf-8'
      );

      const cache = new LLMCache();
      const result = cache.get('test-key');

      expect(result).toBe('test-value');
    });

    it('should disable persistence when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';

      const cache = new LLMCache();

      const cacheDir = path.join(tmpDir, '.specbmad', 'cache');
      expect(fs.existsSync(cacheDir)).toBe(false);
    });

    it('should handle missing cache directory gracefully', () => {
      delete process.env.NODE_ENV;

      expect(() => new LLMCache()).not.toThrow();
    });

    it('should handle corrupted cache file gracefully', () => {
      delete process.env.NODE_ENV;

      const cacheDir = path.join(tmpDir, '.specbmad', 'cache');
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(path.join(cacheDir, 'llm.json'), 'invalid json {', 'utf-8');

      expect(() => new LLMCache()).not.toThrow();
    });
  });

  describe('makeKey()', () => {
    let cache: LLMCache;

    beforeEach(() => {
      process.env.NODE_ENV = 'test'; // Disable persistence for speed
      cache = new LLMCache();
    });

    it('should generate SHA256 hash for cache key', () => {
      const key = cache.makeKey('test prompt', coreTestFixtures.validLLMOptions);

      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate consistent hash for same inputs', () => {
      const key1 = cache.makeKey('test prompt', coreTestFixtures.validLLMOptions);
      const key2 = cache.makeKey('test prompt', coreTestFixtures.validLLMOptions);

      expect(key1).toBe(key2);
    });

    it('should generate different hash for different prompts', () => {
      const key1 = cache.makeKey('prompt A', coreTestFixtures.validLLMOptions);
      const key2 = cache.makeKey('prompt B', coreTestFixtures.validLLMOptions);

      expect(key1).not.toBe(key2);
    });

    it('should generate different hash for different models', () => {
      const key1 = cache.makeKey('test', { ...coreTestFixtures.validLLMOptions, model: 'model-a' });
      const key2 = cache.makeKey('test', { ...coreTestFixtures.validLLMOptions, model: 'model-b' });

      expect(key1).not.toBe(key2);
    });

    it('should generate different hash for different temperatures', () => {
      const key1 = cache.makeKey('test', { ...coreTestFixtures.validLLMOptions, temperature: 0.5 });
      const key2 = cache.makeKey('test', { ...coreTestFixtures.validLLMOptions, temperature: 0.9 });

      expect(key1).not.toBe(key2);
    });

    it('should generate different hash for different maxTokens', () => {
      const key1 = cache.makeKey('test', { ...coreTestFixtures.validLLMOptions, maxTokens: 1000 });
      const key2 = cache.makeKey('test', { ...coreTestFixtures.validLLMOptions, maxTokens: 2000 });

      expect(key1).not.toBe(key2);
    });

    it('should generate different hash for different systemPrompt', () => {
      const key1 = cache.makeKey('test', { ...coreTestFixtures.validLLMOptions, systemPrompt: 'sys1' });
      const key2 = cache.makeKey('test', { ...coreTestFixtures.validLLMOptions, systemPrompt: 'sys2' });

      expect(key1).not.toBe(key2);
    });

    it('should generate different hash for different context', () => {
      const key1 = cache.makeKey('test', { ...coreTestFixtures.validLLMOptions, context: ['msg1'] });
      const key2 = cache.makeKey('test', { ...coreTestFixtures.validLLMOptions, context: ['msg2'] });

      expect(key1).not.toBe(key2);
    });

    it('should handle undefined options gracefully', () => {
      const key = cache.makeKey('test', {});

      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('get()', () => {
    let cache: LLMCache;

    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      mockDateNow(1000000000);
      cache = new LLMCache();
    });

    it('should return cached value for valid key', () => {
      const key = 'test-key';
      cache.set(key, 'test-value');

      const result = cache.get(key);
      expect(result).toBe('test-value');
    });

    it('should return null for non-existent key', () => {
      const result = cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should return null for expired entries', () => {
      mockConfigObj.get.mockImplementation((key: string) => {
        if (key === 'llmCacheTTLSeconds') return 60; // 60 seconds TTL
        if (key === 'cacheDir') return '.specbmad/cache';
        if (key === 'llmCacheEnabled') return true;
        return undefined;
      });

      const cache2 = new LLMCache();
      cache2.set('test-key', 'test-value');

      // Advance time by 61 seconds
      mockDateNow(1000000000 + 61 * 1000);

      const result = cache2.get('test-key');
      expect(result).toBeNull();
    });

    it('should delete expired entries on access', () => {
      mockConfigObj.get.mockImplementation((key: string) => {
        if (key === 'llmCacheTTLSeconds') return 60;
        if (key === 'cacheDir') return '.specbmad/cache';
        if (key === 'llmCacheEnabled') return true;
        return undefined;
      });

      const cache2 = new LLMCache();
      cache2.set('test-key', 'test-value');

      // Advance time to expire
      mockDateNow(1000000000 + 61 * 1000);
      cache2.get('test-key'); // Should delete

      // Reset time and check if deleted
      mockDateNow(1000000000);
      const result = cache2.get('test-key');
      expect(result).toBeNull();
    });

    it('should return null when cache is disabled', () => {
      mockConfigObj.get.mockImplementation((key: string) => {
        if (key === 'llmCacheEnabled') return false;
        if (key === 'cacheDir') return '.specbmad/cache';
        return undefined;
      });

      const cache2 = new LLMCache();
      cache2.set('test-key', 'test-value');

      const result = cache2.get('test-key');
      expect(result).toBeNull();
    });

    it('should use default TTL of 3600 seconds when not configured', () => {
      mockConfigObj.get.mockImplementation((key: string) => {
        if (key === 'llmCacheTTLSeconds') return undefined; // Use default
        if (key === 'cacheDir') return '.specbmad/cache';
        if (key === 'llmCacheEnabled') return true;
        return undefined;
      });

      const cache2 = new LLMCache();
      cache2.set('test-key', 'test-value');

      // Advance time by 3599 seconds (just before expiry)
      mockDateNow(1000000000 + 3599 * 1000);
      expect(cache2.get('test-key')).toBe('test-value');

      // Advance time by 3601 seconds (expired)
      mockDateNow(1000000000 + 3601 * 1000);
      expect(cache2.get('test-key')).toBeNull();
    });
  });

  describe('set()', () => {
    it('should store value in cache', () => {
      process.env.NODE_ENV = 'test';
      const cache = new LLMCache();

      cache.set('test-key', 'test-value');

      expect(cache.get('test-key')).toBe('test-value');
    });

    it('should persist cache to disk when persistence is enabled', () => {
      delete process.env.NODE_ENV;

      const cache = new LLMCache();
      cache.set('test-key', 'test-value');

      const cacheFile = path.join(tmpDir, '.specbmad', 'cache', 'llm.json');
      expect(fs.existsSync(cacheFile)).toBe(true);

      const content = fs.readFileSync(cacheFile, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed['test-key']).toBeDefined();
      expect(parsed['test-key'].value).toBe('test-value');
    });

    it('should not persist when cache is disabled', () => {
      mockConfigObj.get.mockImplementation((key: string) => {
        if (key === 'llmCacheEnabled') return false;
        if (key === 'cacheDir') return '.specbmad/cache';
        return undefined;
      });

      delete process.env.NODE_ENV;
      const cache = new LLMCache();
      cache.set('test-key', 'test-value');

      const cacheFile = path.join(tmpDir, '.specbmad', 'cache', 'llm.json');
      // File might exist from constructor, but should not contain our key
      expect(cache.get('test-key')).toBeNull();
    });

    it('should not persist when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';

      const cache = new LLMCache();
      cache.set('test-key', 'test-value');

      const cacheFile = path.join(tmpDir, '.specbmad', 'cache', 'llm.json');
      expect(fs.existsSync(cacheFile)).toBe(false);
    });

    it('should handle file write errors gracefully', () => {
      delete process.env.NODE_ENV;

      const cache = new LLMCache();

      // Make cache file read-only to simulate write error
      const cacheFile = path.join(tmpDir, '.specbmad', 'cache', 'llm.json');
      fs.chmodSync(cacheFile, 0o444);

      expect(() => cache.set('test-key', 'test-value')).not.toThrow();

      // Restore permissions for cleanup
      fs.chmodSync(cacheFile, 0o644);
    });

    it('should store createdAt timestamp', () => {
      // Set up config with TTL
      mockConfigObj.get.mockImplementation((key: string) => {
        if (key === 'llmCacheTTLSeconds') return 60;
        if (key === 'cacheDir') return '.specbmad/cache';
        if (key === 'llmCacheEnabled') return true;
        return undefined;
      });

      process.env.NODE_ENV = 'test';
      mockDateNow(1234567890000);

      const cache = new LLMCache();
      cache.set('test-key', 'test-value');

      // Verify timestamp indirectly by checking cache still valid
      const result = cache.get('test-key');
      expect(result).toBe('test-value');

      // Advance time and verify expiration works (proves timestamp was set)
      mockDateNow(1234567890000 + 61000); // 61 seconds later
      const expiredResult = cache.get('test-key');
      expect(expiredResult).toBeNull(); // Should be expired
    });
  });
});
