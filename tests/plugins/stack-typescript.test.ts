/**
 * TypeScript Stack Plugin Tests
 *
 * Tests for TypeScript/JavaScript project detection and scaffolding
 */

import { TypeScriptStackPlugin } from '@/plugins/stack-typescript';
import * as fs from 'fs';
import * as path from 'path';
import {
  createTempProjectDir,
  cleanupTempDir,
  createMockGeneratorOptions,
  createTestFile,
  assertFileExists,
  assertFileContains,
  assertFileNotExists,
  readTestJson,
  fixtures,
} from './plugin-test-utils';

describe('TypeScriptStackPlugin', () => {
  let plugin: TypeScriptStackPlugin;
  let tmpDir: string;

  beforeEach(() => {
    plugin = new TypeScriptStackPlugin();
    tmpDir = createTempProjectDir('ts-plugin-test-');
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(plugin.name).toBe('typescript');
    });

    it('should have correct aliases', () => {
      expect(plugin.aliases).toEqual(['ts', 'js', 'javascript', 'node']);
    });
  });

  describe('detect()', () => {
    it('should return true when package.json has typescript in devDependencies', () => {
      createTestFile(tmpDir, 'package.json', fixtures.typescript.packageJsonWithTs);
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when package.json has typescript in dependencies', () => {
      const pkg = {
        name: 'test',
        dependencies: { typescript: '^5.0.0' },
      };
      createTestFile(tmpDir, 'package.json', JSON.stringify(pkg));
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when package.json has @types/node in devDependencies', () => {
      createTestFile(tmpDir, 'package.json', fixtures.typescript.packageJsonWithTypes);
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when package.json has @types/node in dependencies', () => {
      const pkg = {
        name: 'test',
        dependencies: { '@types/node': '^20.0.0' },
      };
      createTestFile(tmpDir, 'package.json', JSON.stringify(pkg));
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when package.json exists without typescript (plain JS)', () => {
      createTestFile(tmpDir, 'package.json', fixtures.typescript.packageJsonPlain);
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when tsconfig.json exists', () => {
      createTestFile(tmpDir, 'tsconfig.json', fixtures.typescript.tsConfig);
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return false when neither package.json nor tsconfig.json exists', () => {
      expect(plugin.detect(tmpDir)).toBe(false);
    });

    it('should handle JSON parse errors gracefully', () => {
      createTestFile(tmpDir, 'package.json', 'invalid json {');
      // Should not throw, should check for tsconfig.json and return false
      expect(plugin.detect(tmpDir)).toBe(false);
    });
  });

  describe('generateSkeleton()', () => {
    it('should create package.json with correct structure', async () => {
      const opts = createMockGeneratorOptions({
        projectDir: tmpDir,
        projectName: 'my-awesome-project',
      });

      await plugin.generateSkeleton(opts);

      const pkgPath = path.join(tmpDir, 'package.json');
      assertFileExists(pkgPath);

      const pkg = readTestJson(tmpDir, 'package.json');
      expect(pkg).toMatchObject({
        name: 'my-awesome-project',
        version: '0.1.0',
        private: true,
        type: 'module',
      });
    });

    it('should create package.json with correct scripts', async () => {
      const opts = createMockGeneratorOptions({ projectDir: tmpDir });
      await plugin.generateSkeleton(opts);

      const pkg = readTestJson<any>(tmpDir, 'package.json');
      expect(pkg.scripts).toEqual({
        build: 'echo "build"',
        start: 'node dist/index.js',
        test: 'echo "test"',
      });
    });

    it('should create src/index.js with main function', async () => {
      const opts = createMockGeneratorOptions({ projectDir: tmpDir });
      await plugin.generateSkeleton(opts);

      const indexPath = path.join(tmpDir, 'src', 'index.js');
      assertFileExists(indexPath);
      assertFileContains(indexPath, 'function main()');
      assertFileContains(indexPath, "console.log('hello')");
    });

    it('should create tests/example.test.ts', async () => {
      const opts = createMockGeneratorOptions({ projectDir: tmpDir });
      await plugin.generateSkeleton(opts);

      const testPath = path.join(tmpDir, 'tests', 'example.test.ts');
      assertFileExists(testPath);
      assertFileContains(testPath, "describe('basic'");
      assertFileContains(testPath, "it('works'");
    });

    it('should respect dryRun option', async () => {
      const opts = createMockGeneratorOptions({
        projectDir: tmpDir,
        dryRun: true,
      });

      await plugin.generateSkeleton(opts);

      // No files should be created
      assertFileNotExists(path.join(tmpDir, 'package.json'));
      assertFileNotExists(path.join(tmpDir, 'src', 'index.js'));
      assertFileNotExists(path.join(tmpDir, 'tests', 'example.test.ts'));
    });

    it('should create parent directories as needed', async () => {
      const nestedDir = path.join(tmpDir, 'nested', 'project');
      const opts = createMockGeneratorOptions({ projectDir: nestedDir });

      await plugin.generateSkeleton(opts);

      assertFileExists(path.join(nestedDir, 'package.json'));
      assertFileExists(path.join(nestedDir, 'src', 'index.js'));
    });
  });

  describe('getRunCommand()', () => {
    it('should return npm run command when script is provided', () => {
      const result = plugin.getRunCommand(tmpDir, 'dev');
      expect(result).toBe('npm run dev');
    });

    it('should return npm start when no script is provided', () => {
      const result = plugin.getRunCommand(tmpDir);
      expect(result).toBe('npm start');
    });
  });

  describe('getTestCommand()', () => {
    it('should return npm test', () => {
      const result = plugin.getTestCommand(tmpDir);
      expect(result).toBe('npm test');
    });
  });
});
