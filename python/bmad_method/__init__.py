"""
BMAD-Method Python 模块
Business Model Analysis and Design Method

提供业务模型分析和设计的核心功能
"""

from .core import BMADCore
from .analysis import AnalysisEngine
from .planning import PlanningEngine
from .solution import SolutionEngine
from .bmm import BMMEngine

__version__ = "1.0.0"
__all__ = [
    "BMADCore",
    "AnalysisEngine", 
    "PlanningEngine",
    "SolutionEngine",
    "BMMEngine"
]