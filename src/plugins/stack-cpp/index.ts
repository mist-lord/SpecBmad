import { BaseStackPlugin } from '../base-stack';
import { GeneratorOptions } from '@/generator';
import path from 'path';
import fs from 'fs';

export class CppStackPlugin extends BaseStackPlugin {
  name = 'cpp';
  aliases = ['c++', 'cxx', 'cc'];

  detect(cwd: string): boolean {
    // 检查构建文件
    if (fs.existsSync(path.join(cwd, 'CMakeLists.txt')) ||
        fs.existsSync(path.join(cwd, 'Makefile')) ||
        fs.existsSync(path.join(cwd, 'configure.ac')) ||
        fs.existsSync(path.join(cwd, 'configure.in'))) {
      return true;
    }
    
    // 检查源文件
    const cppFiles = ['.cpp', '.cxx', '.cc', '.hpp', '.hxx', '.h++'];
    try {
      const files = fs.readdirSync(cwd);
      return files.some(file => cppFiles.some(ext => file.endsWith(ext)));
    } catch {
      return false;
    }
  }

  async generateSkeleton(opts: GeneratorOptions): Promise<void> {
    const pkgName = this.toPkgName(opts.projectName);
    
    // 1. Root CMakeLists.txt (集成 GTest)
    const rootCmake = `cmake_minimum_required(VERSION 3.14)
project(${opts.projectName})

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 启用测试
include(CTest)
enable_testing()

# 引入 GoogleTest
include(FetchContent)
FetchContent_Declare(
  googletest
  URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.zip
)
# For Windows: Prevent overriding the parent project's compiler/linker settings
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

# 添加子目录
add_subdirectory(src)
add_subdirectory(tests)
`;

    // 2. Src CMakeLists.txt
    const srcCmake = `
add_library(${pkgName}_lib lib.cpp)
target_include_directories(${pkgName}_lib PUBLIC \${CMAKE_CURRENT_SOURCE_DIR})

add_executable(${pkgName}_run main.cpp)
target_link_libraries(${pkgName}_run PRIVATE ${pkgName}_lib)

install(TARGETS ${pkgName}_run DESTINATION bin)
install(TARGETS ${pkgName}_lib DESTINATION lib)
`;

    // 3. 源代码
    const libHpp = `#pragma once
#include <string>

std::string get_greeting(const std::string& name);
int add(int a, int b);
`;

    const libCpp = `#include "lib.hpp"

std::string get_greeting(const std::string& name) {
    return "Hello, " + name + "!";
}

int add(int a, int b) {
    return a + b;
}
`;

    const mainCpp = `#include <iostream>
#include "lib.hpp"

int main(int argc, char* argv[]) {
    std::cout << get_greeting("${opts.projectName}") << std::endl;
    return 0;
}
`;

    // 4. 测试代码
    const testsCmake = `
add_executable(${pkgName}_test test_main.cpp)
target_link_libraries(${pkgName}_test PRIVATE 
    ${pkgName}_lib 
    GTest::gtest_main
)

include(GoogleTest)
gtest_discover_tests(${pkgName}_test)
`;

    const testMainCpp = `#include <gtest/gtest.h>
#include "../src/lib.hpp"

TEST(LibTest, GetGreeting) {
    EXPECT_EQ(get_greeting("World"), "Hello, World!");
}

TEST(LibTest, Add) {
    EXPECT_EQ(add(1, 2), 3);
    EXPECT_EQ(add(-1, 1), 0);
}
`;

    const readme = `# ${opts.projectName}

## 构建与运行

\`\`\`bash
# 配置
cmake -B build

# 构建
cmake --build build

# 运行
./build/src/${pkgName}_run
\`\`\`

## 测试

本项目使用 GoogleTest 进行单元测试。

\`\`\`bash
# 运行测试
cd build && ctest --output-on-failure
\`\`\`
`;

    const gitignore = `build/
.cache/
*.o
*.a
*.so
*.dylib
*.exe
.DS_Store
.vscode/
`;

    // 写入文件
    this.writeFile(path.join(opts.projectDir, 'CMakeLists.txt'), rootCmake, opts.dryRun);
    this.writeFile(path.join(opts.projectDir, 'src', 'CMakeLists.txt'), srcCmake, opts.dryRun);
    this.writeFile(path.join(opts.projectDir, 'src', 'main.cpp'), mainCpp, opts.dryRun);
    this.writeFile(path.join(opts.projectDir, 'src', 'lib.cpp'), libCpp, opts.dryRun);
    this.writeFile(path.join(opts.projectDir, 'src', 'lib.hpp'), libHpp, opts.dryRun);
    
    this.writeFile(path.join(opts.projectDir, 'tests', 'CMakeLists.txt'), testsCmake, opts.dryRun);
    this.writeFile(path.join(opts.projectDir, 'tests', 'test_main.cpp'), testMainCpp, opts.dryRun);
    
    this.writeFile(path.join(opts.projectDir, 'README.md'), readme, opts.dryRun);
    this.writeFile(path.join(opts.projectDir, '.gitignore'), gitignore, opts.dryRun);
  }

  getRunCommand(cwd: string, script?: string): string {
    const pkgName = this.toPkgName(path.basename(cwd));
    // 优先查找 src 下的可执行文件（新的结构）
    const binPath = path.join('build', 'src', `${pkgName}_run`);
    return `./${binPath}`;
  }

  getBuildCommand(cwd: string): string {
    return 'cmake -B build && cmake --build build';
  }

  getTestCommand(cwd: string): string {
    return 'cd build && ctest --output-on-failure';
  }
}
