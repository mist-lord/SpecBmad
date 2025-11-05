#!/usr/bin/env python3
"""
BMAD桥接器测试脚本
"""

import sys
import json
import subprocess
from pathlib import Path

def test_bridge_import():
    """测试桥接器导入"""
    try:
        # 测试导入BMAD模块
        from bmad_method import BMADCore, AnalysisEngine, PlanningEngine, SolutionEngine, BMMEngine
        print("✓ BMAD模块导入成功")
        return True
    except ImportError as e:
        print(f"✗ BMAD模块导入失败: {e}")
        return False

def test_bridge_basic():
    """测试桥接器基本功能"""
    try:
        from bmad_bridge import BMADBridge
        
        # 创建桥接器实例
        bridge = BMADBridge(".")
        print("✓ 桥接器实例创建成功")
        
        # 测试配置加载
        config = bridge._load_project_config()
        print(f"✓ 配置加载成功: {type(config)}")
        
        return True
    except Exception as e:
        print(f"✗ 桥接器基本功能测试失败: {e}")
        return False

def test_bridge_commands():
    """测试桥接器命令行接口"""
    test_cases = [
        {
            'name': '分析命令帮助',
            'cmd': [sys.executable, 'bmad_bridge.py', 'analyze', '--help'],
            'expect_success': True
        },
        {
            'name': '规划命令帮助',
            'cmd': [sys.executable, 'bmad_bridge.py', 'plan', '--help'],
            'expect_success': True
        },
        {
            'name': '解决方案命令帮助',
            'cmd': [sys.executable, 'bmad_bridge.py', 'solution', '--help'],
            'expect_success': True
        },
        {
            'name': 'BMM命令帮助',
            'cmd': [sys.executable, 'bmad_bridge.py', 'bmm', '--help'],
            'expect_success': True
        }
    ]
    
    success_count = 0
    for test_case in test_cases:
        try:
            result = subprocess.run(
                test_case['cmd'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if test_case['expect_success'] and result.returncode == 0:
                print(f"✓ {test_case['name']}")
                success_count += 1
            elif not test_case['expect_success'] and result.returncode != 0:
                print(f"✓ {test_case['name']}")
                success_count += 1
            else:
                print(f"✗ {test_case['name']}: 返回码 {result.returncode}")
                if result.stderr:
                    print(f"  错误: {result.stderr}")
        except subprocess.TimeoutExpired:
            print(f"✗ {test_case['name']}: 超时")
        except Exception as e:
            print(f"✗ {test_case['name']}: {e}")
    
    return success_count == len(test_cases)

def main():
    """主测试函数"""
    print("=== BMAD桥接器测试 ===\n")
    
    tests = [
        ("模块导入测试", test_bridge_import),
        ("基本功能测试", test_bridge_basic),
        ("命令行接口测试", test_bridge_commands)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n--- {test_name} ---")
        try:
            if test_func():
                passed += 1
                print(f"✓ {test_name} 通过")
            else:
                print(f"✗ {test_name} 失败")
        except Exception as e:
            print(f"✗ {test_name} 异常: {e}")
    
    print(f"\n=== 测试结果 ===")
    print(f"通过: {passed}/{total}")
    print(f"成功率: {passed/total*100:.1f}%")
    
    return 0 if passed == total else 1

if __name__ == '__main__':
    sys.exit(main())