#!/usr/bin/env python3
"""
BMAD-Method 概念验证原型演示
展示完整的分析->规划->解决方案->BMM工作流程
"""

import os
import sys
import json
import time
from pathlib import Path
from bmad_bridge import BMADBridge

def print_header(title: str):
    """打印标题"""
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def print_step(step: str, description: str):
    """打印步骤"""
    print(f"\n🔄 步骤 {step}: {description}")
    print("-" * 40)

def print_result(result: dict):
    """打印结果摘要"""
    if result.get('success'):
        print("✅ 执行成功")
        if 'summary' in result:
            print(f"📊 摘要: {json.dumps(result['summary'], indent=2, ensure_ascii=False)}")
    else:
        print("❌ 执行失败")
        print(f"错误: {result.get('error', '未知错误')}")

def demo_complete_workflow():
    """演示完整的BMAD工作流程"""
    print_header("BMAD-Method 概念验证原型演示")
    
    # 初始化桥接器
    project_root = os.getcwd()
    bridge = BMADBridge(project_root)
    
    print(f"📁 项目根目录: {project_root}")
    print(f"🤖 使用AI代理: Claude")
    
    # 步骤1: 项目分析
    print_step("1", "项目分析 (Analysis)")
    print("执行综合分析，了解项目结构和特征...")
    
    analysis_result = bridge.execute_analyze(
        mode="comprehensive",
        agent="Claude",
        output="json",
        verbose=True
    )
    print_result(analysis_result)
    time.sleep(1)
    
    # 步骤2: 项目规划
    print_step("2", "项目规划 (Planning)")
    print("基于分析结果，制定架构规划...")
    
    planning_result = bridge.execute_plan(
        planning_type="architecture",
        agent="Claude",
        scale=3,
        output="json",
        verbose=True
    )
    print_result(planning_result)
    time.sleep(1)
    
    # 步骤3: 解决方案设计
    print_step("3", "解决方案设计 (Solution)")
    print("基于规划结果，设计实施解决方案...")
    
    solution_result = bridge.execute_solution(
        solution_type="implementation",
        agent="Claude",
        depth=2,
        output="json",
        verbose=True
    )
    print_result(solution_result)
    time.sleep(1)
    
    # 步骤4: 业务模型管理
    print_step("4", "业务模型管理 (BMM)")
    print("分析和优化业务模型...")
    
    bmm_result = bridge.execute_bmm(
        operation="analyze",
        agent="Claude",
        output="json",
        verbose=True
    )
    print_result(bmm_result)
    
    # 工作流程总结
    print_header("工作流程总结")
    
    all_success = all([
        analysis_result.get('success', False),
        planning_result.get('success', False),
        solution_result.get('success', False),
        bmm_result.get('success', False)
    ])
    
    if all_success:
        print("🎉 所有工作流程步骤都成功完成！")
        print("\n📋 生成的产物:")
        artifacts_dir = Path(project_root) / ".bmad" / "artifacts"
        if artifacts_dir.exists():
            for artifact in artifacts_dir.glob("*.json"):
                print(f"  - {artifact.name}")
        
        print("\n🔍 工作流程概览:")
        print("  1. ✅ 项目分析 - 理解项目结构和特征")
        print("  2. ✅ 项目规划 - 制定架构和实施计划")
        print("  3. ✅ 解决方案 - 设计具体实施方案")
        print("  4. ✅ 业务模型 - 分析和优化业务模型")
        
        print("\n🚀 BMAD-Method 概念验证成功！")
    else:
        print("⚠️  部分工作流程步骤失败，请检查日志")
    
    return all_success

def demo_individual_commands():
    """演示各个独立命令"""
    print_header("独立命令演示")
    
    commands = [
        ("分析命令", "python bmad_bridge.py analyze --mode business --agent Claude --output json"),
        ("规划命令", "python bmad_bridge.py plan --type technical --agent Claude --scale 2 --output json"),
        ("解决方案命令", "python bmad_bridge.py solution --type optimization --agent Claude --depth 1 --output json"),
        ("BMM命令", "python bmad_bridge.py bmm --operation validate --agent Claude --output json")
    ]
    
    for name, command in commands:
        print(f"\n📝 {name}:")
        print(f"   {command}")
    
    print("\n💡 提示: 您可以直接运行这些命令来测试各个功能模块")

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "--commands":
            demo_individual_commands()
        else:
            success = demo_complete_workflow()
            sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⏹️  演示被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 演示过程中发生错误: {e}")
        sys.exit(1)