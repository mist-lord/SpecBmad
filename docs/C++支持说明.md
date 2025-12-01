# C++ 支持说明

## ✅ 已支持的功能

### 1. 自动检测 C++ 项目

工具可以自动检测以下 C++ 项目标识：
- `CMakeLists.txt` 文件
- `Makefile` 文件
- `configure.ac` 或 `configure.in` 文件
- `.cpp`、`.cxx`、`.cc`、`.hpp`、`.hxx`、`.h++` 源文件

### 2. 项目初始化

```bash
# 交互式初始化，选择 C++
node dist/index.js init my-cpp-project -l cpp -i

# 直接指定
node dist/index.js init my-cpp-project -l cpp
```

### 3. 快速生成 C++ 项目

```bash
# 自动检测（包含 c++ 或 cpp 关键词）
node dist/index.js quick --text "用 c++ 创建一个计算器工具"

# 手动指定 CLI 工具
node dist/index.js quick --text "创建一个文件处理工具" --stack cpp-cli

# 手动指定应用程序（GUI）
node dist/index.js quick --text "创建一个 C++ GUI 应用" --stack cpp-app
```

### 4. 生成的项目结构

生成的 C++ 项目包含：

```
my-project/
├── CMakeLists.txt      # CMake 构建配置
├── src/
│   └── main.cpp        # 主程序入口
├── README.md           # 项目说明
└── .gitignore          # Git 忽略文件
```

### 5. 构建和运行

```bash
# 构建项目
mkdir build && cd build
cmake ..
make

# 运行
./my_project
```

## 📋 生成的 CMakeLists.txt 示例

```cmake
cmake_minimum_required(VERSION 3.10)
project(my-project)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(my_project src/main.cpp)

# 安装目标
install(TARGETS my_project DESTINATION bin)
```

## 📋 生成的 main.cpp 示例

```cpp
#include <iostream>
#include <string>

int main(int argc, char* argv[]) {
    std::cout << "Hello from my-project!" << std::endl;
    return 0;
}
```

## 🚀 使用场景

### CLI 工具开发

```bash
node dist/index.js go "创建一个 C++ 命令行文件压缩工具"
```

### 桌面应用开发

```bash
node dist/index.js quick --text "创建一个 C++ GUI 应用" --stack cpp-app
```

### 系统工具开发

```bash
node dist/index.js quick --text "用 cpp 创建一个系统监控工具" --stack cpp-cli
```

## 🔧 扩展支持

### 添加 C++ 库依赖

编辑生成的 `CMakeLists.txt`，添加：

```cmake
# 查找库
find_package(SomeLibrary REQUIRED)

# 链接库
target_link_libraries(my_project SomeLibrary::SomeLibrary)
```

### 添加多个源文件

```cmake
add_executable(my_project 
    src/main.cpp
    src/utils.cpp
    src/parser.cpp
)
```

### 使用 C++20 标准

修改 `CMakeLists.txt`：

```cmake
set(CMAKE_CXX_STANDARD 20)
```

## 📝 注意事项

1. **构建工具要求**：
   - 需要安装 CMake (>= 3.10)
   - 需要 C++ 编译器（g++、clang++ 等）

2. **自动运行**：
   - C++ 项目需要先构建才能运行
   - 使用 `--auto-run` 时，如果项目未构建会提示构建命令

3. **跨平台**：
   - 生成的 CMake 配置支持跨平台构建
   - Windows 上可以使用 Visual Studio 或 MinGW

## 🎯 未来计划

- [ ] 支持更多 C++ 构建系统（Bazel、Meson）
- [ ] 支持 C++ 测试框架（Google Test、Catch2）
- [ ] 支持 C++ 包管理（vcpkg、Conan）
- [ ] 支持 Qt、GTK 等 GUI 框架
- [ ] 支持 C++ 库项目模板

---

**开始使用 C++ 支持**：

```bash
node dist/index.js quick --text "用 c++ 创建一个工具" --stack cpp-cli
```

