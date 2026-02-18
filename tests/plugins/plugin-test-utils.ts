/**
 * Plugin Test Utilities
 *
 * Shared utilities for testing stack plugins (TypeScript, Python, C++)
 * Uses real file system with temp directories for reliable tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GeneratorOptions } from '@/generator';

/**
 * Create mock GeneratorOptions with sensible defaults
 * @param overrides Partial options to override defaults
 */
export function createMockGeneratorOptions(
  overrides?: Partial<GeneratorOptions>
): GeneratorOptions {
  const defaults: GeneratorOptions = {
    stack: 'typescript',
    projectDir: '/tmp/test-project',
    projectName: 'test-project',
    template: undefined,
    dryRun: false,
    vars: {},
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a temporary test directory
 * @param prefix Directory name prefix
 * @returns Absolute path to the created temp directory
 */
export function createTempProjectDir(prefix: string = 'plugin-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Clean up a temporary directory
 * @param dirPath Path to directory to remove
 */
export function cleanupTempDir(dirPath: string): void {
  if (dirPath && fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Assert that a file exists
 * @param filePath Path to check
 */
export function assertFileExists(filePath: string): void {
  expect(fs.existsSync(filePath)).toBe(true);
}

/**
 * Assert that a file does not exist
 * @param filePath Path to check
 */
export function assertFileNotExists(filePath: string): void {
  expect(fs.existsSync(filePath)).toBe(false);
}

/**
 * Assert that a file exists and contains expected content
 * @param filePath Path to file
 * @param expectedContent Content that should be present
 */
export function assertFileContains(
  filePath: string,
  expectedContent: string
): void {
  expect(fs.existsSync(filePath)).toBe(true);
  const content = fs.readFileSync(filePath, 'utf-8');
  expect(content).toContain(expectedContent);
}

/**
 * Assert that a file exists and matches exact content
 * @param filePath Path to file
 * @param expectedContent Exact content expected
 */
export function assertFileEquals(
  filePath: string,
  expectedContent: string
): void {
  expect(fs.existsSync(filePath)).toBe(true);
  const content = fs.readFileSync(filePath, 'utf-8');
  expect(content).toBe(expectedContent);
}

/**
 * Assert that all directories in the structure exist
 * @param basePath Base path to check from
 * @param expectedDirs Array of relative directory paths
 */
export function assertDirectoryStructure(
  basePath: string,
  expectedDirs: string[]
): void {
  for (const dir of expectedDirs) {
    const fullPath = path.join(basePath, dir);
    expect(fs.existsSync(fullPath)).toBe(true);
    expect(fs.statSync(fullPath).isDirectory()).toBe(true);
  }
}

/**
 * Assert that all files in the structure exist
 * @param basePath Base path to check from
 * @param expectedFiles Array of relative file paths
 */
export function assertFileStructure(
  basePath: string,
  expectedFiles: string[]
): void {
  for (const file of expectedFiles) {
    const fullPath = path.join(basePath, file);
    expect(fs.existsSync(fullPath)).toBe(true);
    expect(fs.statSync(fullPath).isFile()).toBe(true);
  }
}

/**
 * Create a file with content in the temp directory
 * @param basePath Base directory
 * @param relativePath Relative file path
 * @param content File content
 */
export function createTestFile(
  basePath: string,
  relativePath: string,
  content: string
): void {
  const fullPath = path.join(basePath, relativePath);
  const dirPath = path.dirname(fullPath);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

/**
 * Read a file's content
 * @param basePath Base directory
 * @param relativePath Relative file path
 * @returns File content as string
 */
export function readTestFile(basePath: string, relativePath: string): string {
  const fullPath = path.join(basePath, relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Parse a JSON file
 * @param basePath Base directory
 * @param relativePath Relative file path
 * @returns Parsed JSON object
 */
export function readTestJson<T = unknown>(
  basePath: string,
  relativePath: string
): T {
  const content = readTestFile(basePath, relativePath);
  return JSON.parse(content) as T;
}

/**
 * Test fixtures for common project structures
 */
export const fixtures = {
  /**
   * TypeScript project files
   */
  typescript: {
    packageJsonWithTs: JSON.stringify(
      {
        name: 'test-project',
        version: '1.0.0',
        devDependencies: { typescript: '^5.0.0' },
      },
      null,
      2
    ),
    packageJsonWithTypes: JSON.stringify(
      {
        name: 'test-project',
        version: '1.0.0',
        devDependencies: { '@types/node': '^20.0.0' },
      },
      null,
      2
    ),
    packageJsonPlain: JSON.stringify(
      {
        name: 'test-project',
        version: '1.0.0',
      },
      null,
      2
    ),
    tsConfig: JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true,
        },
      },
      null,
      2
    ),
  },

  /**
   * Python project files
   */
  python: {
    requirementsTxt: 'flask>=2.0\nrequests>=2.28',
    setupPy: 'from setuptools import setup\nsetup(name="test-project")',
    pyprojectToml: `[project]
name = "test-project"
version = "0.1.0"

[build-system]
requires = ["setuptools>=42"]
build-backend = "setuptools.build_meta"`,
  },

  /**
   * C++ project files
   */
  cpp: {
    cmakeLists: 'cmake_minimum_required(VERSION 3.14)\nproject(test-project)',
    makefile: 'all:\n\tg++ -o main main.cpp',
    configureAc: 'AC_INIT([test], [1.0])',
    mainCpp: '#include <iostream>\nint main() { return 0; }',
    headerHpp: '#pragma once\nvoid hello();',
  },
};
