/**
 * C++ Stack Plugin Tests
 *
 * Tests for C++ project detection and scaffolding with GoogleTest integration
 */

import { CppStackPlugin } from '@/plugins/stack-cpp';
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
  readTestFile,
  fixtures,
} from './plugin-test-utils';

describe('CppStackPlugin', () => {
  let plugin: CppStackPlugin;
  let tmpDir: string;

  beforeEach(() => {
    plugin = new CppStackPlugin();
    tmpDir = createTempProjectDir('cpp-plugin-test-');
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(plugin.name).toBe('cpp');
    });

    it('should have correct aliases', () => {
      expect(plugin.aliases).toEqual(['c++', 'cxx', 'cc']);
    });
  });

  describe('detect()', () => {
    it('should return true when CMakeLists.txt exists', () => {
      createTestFile(tmpDir, 'CMakeLists.txt', fixtures.cpp.cmakeLists);
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when Makefile exists', () => {
      createTestFile(tmpDir, 'Makefile', fixtures.cpp.makefile);
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when configure.ac exists', () => {
      createTestFile(tmpDir, 'configure.ac', fixtures.cpp.configureAc);
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when configure.in exists', () => {
      createTestFile(tmpDir, 'configure.in', fixtures.cpp.configureAc);
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when .cpp file exists', () => {
      createTestFile(tmpDir, 'main.cpp', fixtures.cpp.mainCpp);
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when .cxx file exists', () => {
      createTestFile(tmpDir, 'app.cxx', '#include <iostream>');
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when .cc file exists', () => {
      createTestFile(tmpDir, 'util.cc', '#include <string>');
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when .hpp file exists', () => {
      createTestFile(tmpDir, 'header.hpp', fixtures.cpp.headerHpp);
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when .hxx file exists', () => {
      createTestFile(tmpDir, 'api.hxx', '#pragma once');
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return true when .h++ file exists', () => {
      createTestFile(tmpDir, 'types.h++', '#pragma once');
      expect(plugin.detect(tmpDir)).toBe(true);
    });

    it('should return false when no C++ files exist', () => {
      expect(plugin.detect(tmpDir)).toBe(false);
    });

    it('should handle readdirSync errors gracefully', () => {
      // Use a path that doesn't exist to trigger error
      const nonExistentPath = path.join(tmpDir, 'does-not-exist');
      expect(plugin.detect(nonExistentPath)).toBe(false);
    });
  });

  describe('generateSkeleton()', () => {
    it('should create root CMakeLists.txt with project configuration', async () => {
      const opts = createMockGeneratorOptions({
        projectDir: tmpDir,
        projectName: 'MyCppApp',
      });

      await plugin.generateSkeleton(opts);

      const cmakePath = path.join(tmpDir, 'CMakeLists.txt');
      assertFileExists(cmakePath);
      assertFileContains(cmakePath, 'cmake_minimum_required(VERSION 3.14)');
      assertFileContains(cmakePath, 'project(MyCppApp)');
      assertFileContains(cmakePath, 'set(CMAKE_CXX_STANDARD 17)');
    });

    it('should create root CMakeLists.txt with GoogleTest integration', async () => {
      const opts = createMockGeneratorOptions({ projectDir: tmpDir });
      await plugin.generateSkeleton(opts);

      const content = readTestFile(tmpDir, 'CMakeLists.txt');
      expect(content).toContain('include(CTest)');
      expect(content).toContain('enable_testing()');
      expect(content).toContain('FetchContent_Declare');
      expect(content).toContain('googletest');
      expect(content).toContain('FetchContent_MakeAvailable(googletest)');
    });

    it('should create root CMakeLists.txt with subdirectories', async () => {
      const opts = createMockGeneratorOptions({ projectDir: tmpDir });
      await plugin.generateSkeleton(opts);

      const content = readTestFile(tmpDir, 'CMakeLists.txt');
      expect(content).toContain('add_subdirectory(src)');
      expect(content).toContain('add_subdirectory(tests)');
    });

    it('should create src/CMakeLists.txt with library and executable targets', async () => {
      const opts = createMockGeneratorOptions({
        projectDir: tmpDir,
        projectName: 'my-lib',
      });

      await plugin.generateSkeleton(opts);

      const srcCmakePath = path.join(tmpDir, 'src', 'CMakeLists.txt');
      assertFileExists(srcCmakePath);
      assertFileContains(srcCmakePath, 'add_library(my_lib_lib lib.cpp)');
      assertFileContains(srcCmakePath, 'add_executable(my_lib_run main.cpp)');
      assertFileContains(srcCmakePath, 'target_link_libraries(my_lib_run PRIVATE my_lib_lib)');
    });

    it('should create src/main.cpp with entry point', async () => {
      const opts = createMockGeneratorOptions({
        projectDir: tmpDir,
        projectName: 'TestApp',
      });

      await plugin.generateSkeleton(opts);

      const mainPath = path.join(tmpDir, 'src', 'main.cpp');
      assertFileExists(mainPath);
      assertFileContains(mainPath, '#include <iostream>');
      assertFileContains(mainPath, '#include "lib.hpp"');
      assertFileContains(mainPath, 'int main(int argc, char* argv[])');
      assertFileContains(mainPath, 'get_greeting("TestApp")');
    });

    it('should create src/lib.cpp with implementation', async () => {
      const opts = createMockGeneratorOptions({ projectDir: tmpDir });
      await plugin.generateSkeleton(opts);

      const libPath = path.join(tmpDir, 'src', 'lib.cpp');
      assertFileExists(libPath);
      assertFileContains(libPath, '#include "lib.hpp"');
      assertFileContains(libPath, 'std::string get_greeting(const std::string& name)');
      assertFileContains(libPath, 'int add(int a, int b)');
    });

    it('should create src/lib.hpp with declarations', async () => {
      const opts = createMockGeneratorOptions({ projectDir: tmpDir });
      await plugin.generateSkeleton(opts);

      const headerPath = path.join(tmpDir, 'src', 'lib.hpp');
      assertFileExists(headerPath);
      assertFileContains(headerPath, '#pragma once');
      assertFileContains(headerPath, '#include <string>');
      assertFileContains(headerPath, 'std::string get_greeting(const std::string& name);');
      assertFileContains(headerPath, 'int add(int a, int b);');
    });

    it('should create tests/CMakeLists.txt with GoogleTest configuration', async () => {
      const opts = createMockGeneratorOptions({
        projectDir: tmpDir,
        projectName: 'my-app',
      });

      await plugin.generateSkeleton(opts);

      const testsCmakePath = path.join(tmpDir, 'tests', 'CMakeLists.txt');
      assertFileExists(testsCmakePath);
      assertFileContains(testsCmakePath, 'add_executable(my_app_test test_main.cpp)');
      assertFileContains(testsCmakePath, 'target_link_libraries(my_app_test PRIVATE');
      assertFileContains(testsCmakePath, 'my_app_lib');
      assertFileContains(testsCmakePath, 'GTest::gtest_main');
      assertFileContains(testsCmakePath, 'gtest_discover_tests(my_app_test)');
    });

    it('should create tests/test_main.cpp with GoogleTest tests', async () => {
      const opts = createMockGeneratorOptions({ projectDir: tmpDir });
      await plugin.generateSkeleton(opts);

      const testPath = path.join(tmpDir, 'tests', 'test_main.cpp');
      assertFileExists(testPath);
      assertFileContains(testPath, '#include <gtest/gtest.h>');
      assertFileContains(testPath, '#include "../src/lib.hpp"');
      assertFileContains(testPath, 'TEST(LibTest, GetGreeting)');
      assertFileContains(testPath, 'TEST(LibTest, Add)');
      assertFileContains(testPath, 'EXPECT_EQ');
    });

    it('should create README.md with build instructions', async () => {
      const opts = createMockGeneratorOptions({
        projectDir: tmpDir,
        projectName: 'awesome-cpp',
      });

      await plugin.generateSkeleton(opts);

      const readmePath = path.join(tmpDir, 'README.md');
      assertFileExists(readmePath);
      assertFileContains(readmePath, '# awesome-cpp');
      assertFileContains(readmePath, 'cmake -B build');
      assertFileContains(readmePath, 'cmake --build build');
      assertFileContains(readmePath, './build/src/awesome_cpp_run');
      assertFileContains(readmePath, 'ctest --output-on-failure');
    });

    it('should create .gitignore with C++ patterns', async () => {
      const opts = createMockGeneratorOptions({ projectDir: tmpDir });
      await plugin.generateSkeleton(opts);

      const gitignorePath = path.join(tmpDir, '.gitignore');
      assertFileExists(gitignorePath);
      assertFileContains(gitignorePath, 'build/');
      assertFileContains(gitignorePath, '*.o');
      assertFileContains(gitignorePath, '*.a');
      assertFileContains(gitignorePath, '*.so');
    });

    it('should convert project name to valid package name', async () => {
      const opts = createMockGeneratorOptions({
        projectDir: tmpDir,
        projectName: 'My-Cool-App!',
      });

      await plugin.generateSkeleton(opts);

      const content = readTestFile(tmpDir, 'src/CMakeLists.txt');
      // Should convert to My_Cool_App (! removed, - to _)
      expect(content).toContain('My_Cool_App_lib');
      expect(content).toContain('My_Cool_App_run');
    });

    it('should respect dryRun option', async () => {
      const opts = createMockGeneratorOptions({
        projectDir: tmpDir,
        dryRun: true,
      });

      await plugin.generateSkeleton(opts);

      // No files should be created
      assertFileNotExists(path.join(tmpDir, 'CMakeLists.txt'));
      assertFileNotExists(path.join(tmpDir, 'src', 'main.cpp'));
      assertFileNotExists(path.join(tmpDir, 'README.md'));
    });

    it('should create all expected files', async () => {
      const opts = createMockGeneratorOptions({
        projectDir: tmpDir,
        projectName: 'test-cpp',
      });

      await plugin.generateSkeleton(opts);

      // Verify all 9 files are created
      assertFileExists(path.join(tmpDir, 'CMakeLists.txt'));
      assertFileExists(path.join(tmpDir, 'src', 'CMakeLists.txt'));
      assertFileExists(path.join(tmpDir, 'src', 'main.cpp'));
      assertFileExists(path.join(tmpDir, 'src', 'lib.cpp'));
      assertFileExists(path.join(tmpDir, 'src', 'lib.hpp'));
      assertFileExists(path.join(tmpDir, 'tests', 'CMakeLists.txt'));
      assertFileExists(path.join(tmpDir, 'tests', 'test_main.cpp'));
      assertFileExists(path.join(tmpDir, 'README.md'));
      assertFileExists(path.join(tmpDir, '.gitignore'));
    });
  });

  describe('toPkgName()', () => {
    it('should convert hyphens to underscores', () => {
      const result = (plugin as any).toPkgName('my-project');
      expect(result).toBe('my_project');
    });

    it('should remove spaces and special characters', () => {
      const result = (plugin as any).toPkgName('My Cool App!');
      expect(result).toBe('MyCoolApp');
    });

    it('should handle multiple hyphens', () => {
      const result = (plugin as any).toPkgName('my--cpp--lib');
      expect(result).toBe('my_cpp_lib');
    });
  });

  describe('getRunCommand()', () => {
    it('should return path to executable in build directory', () => {
      // Mock basename to return predictable result
      const testDir = path.join(tmpDir, 'my-app');
      fs.mkdirSync(testDir, { recursive: true });

      const result = plugin.getRunCommand(testDir);
      expect(result).toBe('./build/src/my_app_run');
    });

    it('should ignore script parameter', () => {
      const testDir = path.join(tmpDir, 'test-project');
      fs.mkdirSync(testDir, { recursive: true });

      // Script parameter should be ignored
      const result = plugin.getRunCommand(testDir, 'ignored.cpp');
      expect(result).toBe('./build/src/test_project_run');
    });
  });

  describe('getBuildCommand()', () => {
    it('should return cmake configuration and build command', () => {
      const result = plugin.getBuildCommand(tmpDir);
      expect(result).toBe('cmake -B build && cmake --build build');
    });
  });

  describe('getTestCommand()', () => {
    it('should return ctest command', () => {
      const result = plugin.getTestCommand(tmpDir);
      expect(result).toBe('cd build && ctest --output-on-failure');
    });
  });
});
