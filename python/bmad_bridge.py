#!/usr/bin/env python3
"""
BMAD-Method Python 桥接脚本
连接 Node.js CLI 和 Python BMAD-Method 模块
"""

import sys
import json
import argparse
import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional, List

# 导入BMAD-Method引擎
try:
    from bmad_method import BMADCore, AnalysisEngine, PlanningEngine, SolutionEngine, BMMEngine
except ImportError as e:
    # 如果无法导入，继续运行但使用占位符实现
    print(f"警告: 无法导入BMAD-Method模块: {e}")
    BMADCore = None
    AnalysisEngine = None
    PlanningEngine = None
    SolutionEngine = None
    BMMEngine = None

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BMADBridge:
    """BMAD-Method 桥接器"""
    
    def __init__(self, project_root: str):
        """
        初始化桥接器
        
        Args:
            project_root: 项目根目录
        """
        self.project_root = Path(project_root)
        self.config = self._load_project_config()
        
        # 初始化BMAD引擎
        if BMADCore is not None:
            try:
                self.bmad_core = BMADCore(self.config)
                self.analysis_engine = AnalysisEngine(self.config)
                self.planning_engine = PlanningEngine(self.config)
                self.solution_engine = SolutionEngine(self.config)
                self.bmm_engine = BMMEngine(self.config)
                logger.info("BMAD引擎初始化完成")
            except Exception as e:
                logger.error(f"BMAD引擎初始化失败: {e}")
                self._init_fallback_engines()
        else:
            logger.warning("使用占位符引擎")
            self._init_fallback_engines()
        
        logger.info(f"BMAD桥接器初始化完成，项目根目录: {project_root}")
    
    def _init_fallback_engines(self):
        """初始化占位符引擎"""
        self.bmad_core = None
        self.analysis_engine = None
        self.planning_engine = None
        self.solution_engine = None
        self.bmm_engine = None
    
    def _load_project_config(self) -> Dict[str, Any]:
        """加载项目配置"""
        config_path = self.project_root / '.specbmad' / 'config.json'
        
        if not config_path.exists():
            logger.warning(f"配置文件不存在: {config_path}")
            return {}
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            logger.info("项目配置加载成功")
            return config
        except Exception as e:
            logger.error(f"加载配置文件失败: {e}")
            return {}
    
    def execute_analyze(self, mode: str, agent: str, output: str, verbose: bool = False) -> Dict[str, Any]:
        """
        执行分析工作流
        
        Args:
            mode: 分析模式
            agent: AI代理
            output: 输出格式
            verbose: 详细输出
            
        Returns:
            分析结果
        """
        logger.info(f"开始执行分析工作流: mode={mode}, agent={agent}")
        
        try:
            # 使用分析引擎执行分析
            if self.analysis_engine:
                analysis_result = self.analysis_engine.analyze(mode, agent, self.project_root)
                
                # 保存分析结果
                if self.bmad_core:
                    self.bmad_core.save_artifact('analysis', analysis_result)
                
                # 格式化输出
                result = self._format_analysis_output(analysis_result, output, verbose)
            else:
                # 使用占位符实现
                analysis_result = self._execute_fallback_analysis(mode, agent)
                result = self._format_analysis_output(analysis_result, output, verbose)
            
            logger.info("分析工作流执行完成")
            return result
            
        except Exception as e:
            logger.error(f"分析工作流执行失败: {e}")
            return {
                'success': False,
                'error': str(e),
                'workflow': 'analyze'
            }
    
    def execute_plan(self, planning_type: str, agent: str, scale: int, output: str, verbose: bool = False) -> Dict[str, Any]:
        """
        执行规划工作流
        
        Args:
            planning_type: 规划类型
            agent: AI代理
            scale: 项目规模
            output: 输出格式
            verbose: 详细输出
            
        Returns:
            规划结果
        """
        logger.info(f"开始执行规划工作流: type={planning_type}, agent={agent}, scale={scale}")
        
        try:
            # 使用规划引擎执行规划
            if self.planning_engine:
                # 获取分析结果作为输入
                analysis_input = None
                if self.bmad_core:
                    analysis_input = self.bmad_core.load_artifact('analysis')
                
                planning_result = self.planning_engine.plan(planning_type, agent, scale, analysis_input)
                
                # 保存规划结果
                if self.bmad_core:
                    self.bmad_core.save_artifact('planning', planning_result)
                
                # 格式化输出
                result = self._format_planning_output(planning_result, output, verbose)
            else:
                # 使用占位符实现
                planning_result = self._execute_fallback_planning(planning_type, agent, scale)
                result = self._format_planning_output(planning_result, output, verbose)
            
            logger.info("规划工作流执行完成")
            return result
            
        except Exception as e:
            logger.error(f"规划工作流执行失败: {e}")
            return {
                'success': False,
                'error': str(e),
                'workflow': 'plan'
            }
    
    def execute_solution(self, solution_type: str, agent: str, depth: int, output: str, verbose: bool = False) -> Dict[str, Any]:
        """
        执行解决方案工作流
        
        Args:
            solution_type: 解决方案类型
            agent: AI代理
            depth: 解决方案深度
            output: 输出格式
            verbose: 详细输出
            
        Returns:
            解决方案结果
        """
        logger.info(f"开始执行解决方案工作流: type={solution_type}, agent={agent}, depth={depth}")
        
        try:
            # 使用解决方案引擎执行解决方案设计
            if self.solution_engine:
                # 获取规划结果作为输入
                planning_input = None
                if self.bmad_core:
                    planning_input = self.bmad_core.load_artifact('planning')
                
                solution_result = self.solution_engine.design_solution(solution_type, agent, depth, planning_input)
                
                # 保存解决方案结果
                if self.bmad_core:
                    self.bmad_core.save_artifact('solution', solution_result)
                
                # 格式化输出
                result = self._format_solution_output(solution_result, output, verbose)
            else:
                # 使用占位符实现
                solution_result = self._execute_fallback_solution(solution_type, agent, depth)
                result = self._format_solution_output(solution_result, output, verbose)
            
            logger.info("解决方案工作流执行完成")
            return result
            
        except Exception as e:
            logger.error(f"解决方案工作流执行失败: {e}")
            return {
                'success': False,
                'error': str(e),
                'workflow': 'solution'
            }
    
    def execute_bmm(self, operation: str, agent: str, output: str, verbose: bool = False) -> Dict[str, Any]:
        """
        执行BMM工作流
        
        Args:
            operation: BMM操作类型
            agent: AI代理
            output: 输出格式
            verbose: 详细输出
            
        Returns:
            BMM结果
        """
        logger.info(f"开始执行BMM工作流: operation={operation}, agent={agent}")
        
        try:
            # 使用BMM引擎执行操作
            if self.bmm_engine:
                # 获取上下文信息
                context = self._get_bmm_context()
                
                bmm_result = self.bmm_engine.execute_bmm(operation, agent, context)
                
                # 保存BMM结果
                if self.bmad_core:
                    self.bmad_core.save_artifact('bmm', bmm_result)
                
                # 格式化输出
                result = self._format_bmm_output(bmm_result, output, verbose)
            else:
                # 使用占位符实现
                bmm_result = self._execute_fallback_bmm(operation, agent)
                result = self._format_bmm_output(bmm_result, output, verbose)
            
            logger.info("BMM工作流执行完成")
            return result
            
        except Exception as e:
            logger.error(f"BMM工作流执行失败: {e}")
            return {
                'success': False,
                'error': str(e),
                'workflow': 'bmm'
            }
    
    # 占位符实现方法
    def _execute_fallback_analysis(self, mode: str, agent: str) -> Dict[str, Any]:
        """占位符分析实现"""
        return {
            'metadata': {
                'analysis_mode': mode,
                'agent': agent,
                'timestamp': '2024-01-01T00:00:00Z'
            },
            'project_overview': {
                'name': self.config.get('name', 'Unknown Project'),
                'type': self.config.get('type', 'Unknown'),
                'scale': self.config.get('scale', 0)
            },
            'key_findings': [
                f"基于{mode}模式的分析发现",
                f"由{agent}代理执行的分析结果",
                "这是占位符实现的示例结果"
            ],
            'recommendations': [
                "建议进行更详细的分析",
                "考虑使用完整的BMAD-Method引擎",
                "制定下一步行动计划"
            ]
        }
    
    def _execute_fallback_planning(self, planning_type: str, agent: str, scale: int) -> Dict[str, Any]:
        """占位符规划实现"""
        return {
            'metadata': {
                'planning_type': planning_type,
                'agent': agent,
                'scale': scale,
                'timestamp': '2024-01-01T00:00:00Z'
            },
            'planning_overview': {
                'type': planning_type,
                'scale': scale,
                'complexity': 'medium'
            },
            'key_components': [
                f"{planning_type}规划组件1",
                f"{planning_type}规划组件2",
                f"{planning_type}规划组件3"
            ],
            'timeline': f"{scale + 1}个月",
            'resources': f"{scale + 2}人团队"
        }
    
    def _execute_fallback_solution(self, solution_type: str, agent: str, depth: int) -> Dict[str, Any]:
        """占位符解决方案实现"""
        return {
            'metadata': {
                'solution_type': solution_type,
                'agent': agent,
                'depth': depth,
                'timestamp': '2024-01-01T00:00:00Z'
            },
            'solution_overview': {
                'type': solution_type,
                'depth': depth,
                'complexity': 'medium'
            },
            'key_deliverables': [
                f"{solution_type}解决方案交付物1",
                f"{solution_type}解决方案交付物2",
                f"{solution_type}解决方案交付物3"
            ],
            'implementation_approach': f"基于{solution_type}的实施方法",
            'estimated_effort': f"{depth * 2}周"
        }
    
    def _execute_fallback_bmm(self, operation: str, agent: str) -> Dict[str, Any]:
        """占位符BMM实现"""
        return {
            'metadata': {
                'operation': operation,
                'agent': agent,
                'timestamp': '2024-01-01T00:00:00Z'
            },
            'bmm_overview': {
                'operation': operation,
                'focus_area': 'business_model'
            },
            'business_insights': [
                f"基于{operation}操作的业务洞察1",
                f"基于{operation}操作的业务洞察2",
                f"基于{operation}操作的业务洞察3"
            ],
            'optimization_opportunities': [
                "优化机会1",
                "优化机会2",
                "优化机会3"
            ],
            'next_actions': [
                "下一步行动1",
                "下一步行动2",
                "下一步行动3"
            ]
        }
    
    # 输出格式化方法
    def _format_analysis_output(self, analysis_result: Dict[str, Any], output_format: str, verbose: bool) -> Dict[str, Any]:
        """格式化分析输出"""
        base_result = {
            'success': True,
            'workflow': 'analyze',
            'metadata': analysis_result.get('metadata', {}),
            'summary': self._create_analysis_summary(analysis_result)
        }
        
        if verbose or output_format == 'detailed':
            base_result['detailed_results'] = analysis_result
        
        if output_format == 'json':
            base_result['format'] = 'json'
        elif output_format == 'markdown':
            base_result['format'] = 'markdown'
            base_result['markdown_report'] = self._generate_analysis_markdown(analysis_result)
        
        return base_result
    
    def _format_planning_output(self, planning_result: Dict[str, Any], output_format: str, verbose: bool) -> Dict[str, Any]:
        """格式化规划输出"""
        base_result = {
            'success': True,
            'workflow': 'plan',
            'metadata': planning_result.get('metadata', {}),
            'summary': self._create_planning_summary(planning_result)
        }
        
        if verbose or output_format == 'detailed':
            base_result['detailed_results'] = planning_result
        
        if output_format == 'json':
            base_result['format'] = 'json'
        elif output_format == 'markdown':
            base_result['format'] = 'markdown'
            base_result['markdown_report'] = self._generate_planning_markdown(planning_result)
        
        return base_result
    
    def _format_solution_output(self, solution_result: Dict[str, Any], output_format: str, verbose: bool) -> Dict[str, Any]:
        """格式化解决方案输出"""
        base_result = {
            'success': True,
            'workflow': 'solution',
            'metadata': solution_result.get('metadata', {}),
            'summary': self._create_solution_summary(solution_result)
        }
        
        if verbose or output_format == 'detailed':
            base_result['detailed_results'] = solution_result
        
        if output_format == 'json':
            base_result['format'] = 'json'
        elif output_format == 'markdown':
            base_result['format'] = 'markdown'
            base_result['markdown_report'] = self._generate_solution_markdown(solution_result)
        
        return base_result
    
    def _format_bmm_output(self, bmm_result: Dict[str, Any], output_format: str, verbose: bool) -> Dict[str, Any]:
        """格式化BMM输出"""
        base_result = {
            'success': True,
            'workflow': 'bmm',
            'metadata': bmm_result.get('metadata', {}),
            'summary': self._create_bmm_summary(bmm_result)
        }
        
        if verbose or output_format == 'detailed':
            base_result['detailed_results'] = bmm_result
        
        if output_format == 'json':
            base_result['format'] = 'json'
        elif output_format == 'markdown':
            base_result['format'] = 'markdown'
            base_result['markdown_report'] = self._generate_bmm_markdown(bmm_result)
        
        return base_result
    
    # 辅助方法
    def _get_bmm_context(self) -> Dict[str, Any]:
        """获取BMM上下文"""
        context = {
            'project_config': self.config
        }
        
        if self.bmad_core:
            context.update({
                'analysis_results': self.bmad_core.load_artifact('analysis'),
                'planning_results': self.bmad_core.load_artifact('planning'),
                'solution_results': self.bmad_core.load_artifact('solution')
            })
        
        return context
    
    def _create_analysis_summary(self, analysis_result: Dict[str, Any]) -> Dict[str, Any]:
        """创建分析摘要"""
        return {
            'analysis_type': analysis_result.get('metadata', {}).get('analysis_mode', 'unknown'),
            'project_overview': analysis_result.get('project_overview', {}),
            'key_findings': analysis_result.get('key_findings', []),
            'recommendations': analysis_result.get('recommendations', [])
        }
    
    def _create_planning_summary(self, planning_result: Dict[str, Any]) -> Dict[str, Any]:
        """创建规划摘要"""
        return {
            'planning_type': planning_result.get('metadata', {}).get('planning_type', 'unknown'),
            'project_scale': planning_result.get('metadata', {}).get('scale', 0),
            'key_components': planning_result.get('key_components', []),
            'implementation_timeline': planning_result.get('timeline', 'unknown')
        }
    
    def _create_solution_summary(self, solution_result: Dict[str, Any]) -> Dict[str, Any]:
        """创建解决方案摘要"""
        return {
            'solution_type': solution_result.get('metadata', {}).get('solution_type', 'unknown'),
            'solution_depth': solution_result.get('metadata', {}).get('depth', 0),
            'key_deliverables': solution_result.get('key_deliverables', []),
            'implementation_approach': solution_result.get('implementation_approach', 'unknown')
        }
    
    def _create_bmm_summary(self, bmm_result: Dict[str, Any]) -> Dict[str, Any]:
        """创建BMM摘要"""
        return {
            'operation': bmm_result.get('metadata', {}).get('operation', 'unknown'),
            'business_model_insights': bmm_result.get('business_insights', []),
            'optimization_opportunities': bmm_result.get('optimization_opportunities', []),
            'next_actions': bmm_result.get('next_actions', [])
        }
    
    # Markdown生成方法
    def _generate_analysis_markdown(self, analysis_result: Dict[str, Any]) -> str:
        """生成分析Markdown报告"""
        return f"""# 分析报告

## 项目概览
{json.dumps(analysis_result.get('project_overview', {}), indent=2, ensure_ascii=False)}

## 关键发现
{chr(10).join(f"- {finding}" for finding in analysis_result.get('key_findings', []))}

## 建议
{chr(10).join(f"- {rec}" for rec in analysis_result.get('recommendations', []))}
"""
    
    def _generate_planning_markdown(self, planning_result: Dict[str, Any]) -> str:
        """生成规划Markdown报告"""
        return f"""# 规划报告

## 规划类型
{planning_result.get('metadata', {}).get('planning_type', 'unknown')}

## 项目规模
{planning_result.get('metadata', {}).get('scale', 0)}

## 关键组件
{chr(10).join(f"- {comp}" for comp in planning_result.get('key_components', []))}

## 实施时间线
{planning_result.get('timeline', 'unknown')}
"""
    
    def _generate_solution_markdown(self, solution_result: Dict[str, Any]) -> str:
        """生成解决方案Markdown报告"""
        return f"""# 解决方案报告

## 解决方案类型
{solution_result.get('metadata', {}).get('solution_type', 'unknown')}

## 解决方案深度
{solution_result.get('metadata', {}).get('depth', 0)}

## 关键交付物
{chr(10).join(f"- {deliverable}" for deliverable in solution_result.get('key_deliverables', []))}

## 实施方法
{solution_result.get('implementation_approach', 'unknown')}
"""
    
    def _generate_bmm_markdown(self, bmm_result: Dict[str, Any]) -> str:
        """生成BMM Markdown报告"""
        return f"""# BMM报告

## 操作类型
{bmm_result.get('metadata', {}).get('operation', 'unknown')}

## 业务洞察
{chr(10).join(f"- {insight}" for insight in bmm_result.get('business_insights', []))}

## 优化机会
{chr(10).join(f"- {opportunity}" for opportunity in bmm_result.get('optimization_opportunities', []))}

## 下一步行动
{chr(10).join(f"- {action}" for action in bmm_result.get('next_actions', []))}
"""

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='BMAD-Method Python 桥接器')
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # 分析命令
    analyze_parser = subparsers.add_parser('analyze', help='执行分析工作流')
    analyze_parser.add_argument('--mode', required=True, choices=['comprehensive', 'business', 'technical', 'stakeholder', 'risk'], help='分析模式')
    analyze_parser.add_argument('--agent', required=True, help='AI代理')
    analyze_parser.add_argument('--output', choices=['json', 'markdown', 'detailed'], default='json', help='输出格式')
    analyze_parser.add_argument('--verbose', action='store_true', help='详细输出')
    
    # 规划命令
    plan_parser = subparsers.add_parser('plan', help='执行规划工作流')
    plan_parser.add_argument('--type', required=True, choices=['architecture', 'business', 'technical', 'resource', 'timeline'], help='规划类型')
    plan_parser.add_argument('--agent', required=True, help='AI代理')
    plan_parser.add_argument('--scale', required=True, type=int, help='项目规模')
    plan_parser.add_argument('--output', choices=['json', 'markdown', 'detailed'], default='json', help='输出格式')
    plan_parser.add_argument('--verbose', action='store_true', help='详细输出')
    
    # 解决方案命令
    solution_parser = subparsers.add_parser('solution', help='执行解决方案工作流')
    solution_parser.add_argument('--type', required=True, choices=['implementation', 'optimization', 'migration', 'integration', 'deployment'], help='解决方案类型')
    solution_parser.add_argument('--agent', required=True, help='AI代理')
    solution_parser.add_argument('--depth', required=True, type=int, choices=[1, 2, 3, 4, 5], help='分析深度')
    solution_parser.add_argument('--output', choices=['json', 'markdown', 'detailed'], default='json', help='输出格式')
    solution_parser.add_argument('--verbose', action='store_true', help='详细输出')
    
    # BMM命令
    bmm_parser = subparsers.add_parser('bmm', help='执行BMM工作流')
    bmm_parser.add_argument('--operation', required=True, choices=['analyze', 'optimize', 'validate', 'evolve', 'compare'], help='BMM操作类型')
    bmm_parser.add_argument('--agent', required=True, help='AI代理')
    bmm_parser.add_argument('--output', choices=['json', 'markdown', 'detailed'], default='json', help='输出格式')
    bmm_parser.add_argument('--verbose', action='store_true', help='详细输出')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # 获取项目根目录
    project_root = os.getcwd()
    
    try:
        # 创建桥接器实例
        bridge = BMADBridge(project_root)
        
        # 执行相应命令并获取结果
        if args.command == 'analyze':
            result = bridge.execute_analyze(args.mode, args.agent, args.output, args.verbose)
        elif args.command == 'plan':
            result = bridge.execute_plan(args.type, args.agent, args.scale, args.output, args.verbose)
        elif args.command == 'solution':
            result = bridge.execute_solution(args.type, args.agent, args.depth, args.output, args.verbose)
        elif args.command == 'bmm':
            result = bridge.execute_bmm(args.operation, args.agent, args.output, args.verbose)
        else:
            logger.error(f"未知命令: {args.command}")
            return 1
        
        # 输出结果
        if result.get('success', False):
            if args.output == 'json':
                print(json.dumps(result, indent=2, ensure_ascii=False))
            elif args.output == 'markdown' and 'markdown_report' in result:
                print(result['markdown_report'])
            else:
                print(json.dumps(result, indent=2, ensure_ascii=False))
            return 0
        else:
            logger.error(f"工作流执行失败: {result.get('error', '未知错误')}")
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return 1
            
    except Exception as e:
        logger.error(f"桥接器执行失败: {e}")
        error_result = {
            'success': False,
            'error': str(e),
            'workflow': args.command
        }
        print(json.dumps(error_result, indent=2, ensure_ascii=False))
        return 1

if __name__ == '__main__':
    sys.exit(main())