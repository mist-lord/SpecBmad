"""
BMAD-Method 核心引擎
负责协调各个模块的工作流程
"""

import json
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

from .analysis import AnalysisEngine
from .planning import PlanningEngine
from .solution import SolutionEngine
from .bmm import BMMEngine

logger = logging.getLogger(__name__)

class BMADCore:
    """BMAD-Method 核心引擎"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化BMAD核心引擎
        
        Args:
            config: 项目配置
        """
        self.config = config
        self.project_root = Path(config.get('project_root', '.'))
        
        # 初始化各个引擎
        self.analysis_engine = AnalysisEngine(config)
        self.planning_engine = PlanningEngine(config)
        self.solution_engine = SolutionEngine(config)
        self.bmm_engine = BMMEngine(config)
        
        # 工作流状态
        self.workflow_state = {
            'current_phase': None,
            'completed_phases': [],
            'artifacts': {}
        }
        
        logger.info("BMAD核心引擎初始化完成")
    
    def execute_workflow(self, workflow_type: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """
        执行BMAD工作流
        
        Args:
            workflow_type: 工作流类型 (analysis, planning, solution, bmm)
            options: 执行选项
            
        Returns:
            执行结果
        """
        logger.info(f"开始执行 {workflow_type} 工作流")
        
        try:
            if workflow_type == 'analysis':
                return self._execute_analysis_workflow(options)
            elif workflow_type == 'planning':
                return self._execute_planning_workflow(options)
            elif workflow_type == 'solution':
                return self._execute_solution_workflow(options)
            elif workflow_type == 'bmm':
                return self._execute_bmm_workflow(options)
            else:
                raise ValueError(f"未知的工作流类型: {workflow_type}")
                
        except Exception as e:
            logger.error(f"工作流执行失败: {e}")
            return {
                'success': False,
                'error': str(e),
                'workflow_type': workflow_type
            }
    
    def _execute_analysis_workflow(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """执行分析工作流"""
        mode = options.get('mode', 'comprehensive')
        agent = options.get('agent', 'default')
        
        # 执行分析
        result = self.analysis_engine.analyze(
            mode=mode,
            agent=agent,
            project_path=self.project_root
        )
        
        # 保存分析结果
        self._save_artifact('analysis', result)
        
        return {
            'success': True,
            'workflow_type': 'analysis',
            'result': result,
            'artifacts_saved': True
        }
    
    def _execute_planning_workflow(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """执行规划工作流"""
        planning_type = options.get('type', 'architecture')
        agent = options.get('agent', 'default')
        scale = options.get('scale', 1)
        
        # 检查是否有分析结果作为输入
        analysis_result = self._load_artifact('analysis')
        
        # 执行规划
        result = self.planning_engine.plan(
            planning_type=planning_type,
            agent=agent,
            scale=scale,
            analysis_input=analysis_result
        )
        
        # 保存规划结果
        self._save_artifact('planning', result)
        
        return {
            'success': True,
            'workflow_type': 'planning',
            'result': result,
            'artifacts_saved': True
        }
    
    def _execute_solution_workflow(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """执行解决方案工作流"""
        solution_type = options.get('type', 'technical')
        agent = options.get('agent', 'default')
        depth = options.get('depth', 'detailed')
        
        # 检查是否有规划结果作为输入
        planning_result = self._load_artifact('planning')
        analysis_result = self._load_artifact('analysis')
        
        # 执行解决方案设计
        result = self.solution_engine.design(
            solution_type=solution_type,
            agent=agent,
            depth=depth,
            planning_input=planning_result,
            analysis_input=analysis_result
        )
        
        # 保存解决方案结果
        self._save_artifact('solution', result)
        
        return {
            'success': True,
            'workflow_type': 'solution',
            'result': result,
            'artifacts_saved': True
        }
    
    def _execute_bmm_workflow(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """执行BMM工作流"""
        bmm_mode = options.get('mode', 'full')
        agent = options.get('agent', 'default')
        
        # 执行BMM分析
        result = self.bmm_engine.execute(
            mode=bmm_mode,
            agent=agent,
            project_path=self.project_root
        )
        
        # 保存BMM结果
        self._save_artifact('bmm', result)
        
        return {
            'success': True,
            'workflow_type': 'bmm',
            'result': result,
            'artifacts_saved': True
        }
    
    def save_artifact(self, artifact_type: str, data: Dict[str, Any]) -> None:
        """
        保存工作流产物
        
        Args:
            artifact_type: 产物类型
            data: 产物数据
        """
        self._save_artifact(artifact_type, data)
    
    def load_artifact(self, artifact_type: str) -> Optional[Dict[str, Any]]:
        """
        加载工作流产物
        
        Args:
            artifact_type: 产物类型
            
        Returns:
            产物数据，如果不存在则返回None
        """
        return self._load_artifact(artifact_type)
    
    def _save_artifact(self, artifact_type: str, data: Dict[str, Any]) -> None:
        """保存工作流产物"""
        artifacts_dir = self.project_root / '.bmad' / 'artifacts'
        artifacts_dir.mkdir(parents=True, exist_ok=True)
        
        artifact_file = artifacts_dir / f"{artifact_type}.json"
        
        with open(artifact_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        self.workflow_state['artifacts'][artifact_type] = str(artifact_file)
        logger.info(f"已保存 {artifact_type} 产物到 {artifact_file}")
    
    def _load_artifact(self, artifact_type: str) -> Optional[Dict[str, Any]]:
        """加载工作流产物"""
        artifacts_dir = self.project_root / '.bmad' / 'artifacts'
        artifact_file = artifacts_dir / f"{artifact_type}.json"
        
        if not artifact_file.exists():
            logger.warning(f"未找到 {artifact_type} 产物文件")
            return None
        
        try:
            with open(artifact_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"加载 {artifact_type} 产物失败: {e}")
            return None
    
    def get_workflow_status(self) -> Dict[str, Any]:
        """获取工作流状态"""
        return {
            'state': self.workflow_state,
            'available_artifacts': list(self.workflow_state['artifacts'].keys()),
            'config': {
                'project_root': str(self.project_root),
                'enabled_modules': self.config.get('bmad_method', {}).get('active_modules', [])
            }
        }
    
    def reset_workflow(self) -> None:
        """重置工作流状态"""
        self.workflow_state = {
            'current_phase': None,
            'completed_phases': [],
            'artifacts': {}
        }
        logger.info("工作流状态已重置")