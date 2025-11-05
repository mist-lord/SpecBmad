"""
BMAD-Method 分析引擎
负责项目的业务模型分析
"""

import logging
from typing import Dict, Any, List, Optional
from pathlib import Path
import json

logger = logging.getLogger(__name__)

class AnalysisEngine:
    """BMAD分析引擎"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化分析引擎
        
        Args:
            config: 项目配置
        """
        self.config = config
        self.analysis_modes = {
            'comprehensive': self._comprehensive_analysis,
            'business': self._business_analysis,
            'technical': self._technical_analysis,
            'stakeholder': self._stakeholder_analysis,
            'risk': self._risk_analysis
        }
        
        logger.info("BMAD分析引擎初始化完成")
    
    def analyze(self, mode: str, agent: str, project_path: Path) -> Dict[str, Any]:
        """
        执行项目分析
        
        Args:
            mode: 分析模式
            agent: AI代理
            project_path: 项目路径
            
        Returns:
            分析结果
        """
        logger.info(f"开始执行 {mode} 分析")
        
        if mode not in self.analysis_modes:
            raise ValueError(f"不支持的分析模式: {mode}")
        
        # 收集项目信息
        project_info = self._collect_project_info(project_path)
        
        # 执行分析
        analysis_func = self.analysis_modes[mode]
        result = analysis_func(project_info, agent)
        
        # 添加元数据
        result['metadata'] = {
            'analysis_mode': mode,
            'agent': agent,
            'project_path': str(project_path),
            'timestamp': self._get_timestamp()
        }
        
        logger.info(f"{mode} 分析完成")
        return result
    
    def _collect_project_info(self, project_path: Path) -> Dict[str, Any]:
        """收集项目信息"""
        info = {
            'structure': self._analyze_project_structure(project_path),
            'dependencies': self._analyze_dependencies(project_path),
            'documentation': self._analyze_documentation(project_path),
            'configuration': self._analyze_configuration(project_path)
        }
        
        return info
    
    def _analyze_project_structure(self, project_path: Path) -> Dict[str, Any]:
        """分析项目结构"""
        structure = {
            'directories': [],
            'files': [],
            'file_types': {},
            'size_metrics': {}
        }
        
        try:
            for item in project_path.rglob('*'):
                if item.is_dir():
                    structure['directories'].append(str(item.relative_to(project_path)))
                else:
                    rel_path = str(item.relative_to(project_path))
                    structure['files'].append(rel_path)
                    
                    # 统计文件类型
                    suffix = item.suffix.lower()
                    structure['file_types'][suffix] = structure['file_types'].get(suffix, 0) + 1
            
            structure['size_metrics'] = {
                'total_files': len(structure['files']),
                'total_directories': len(structure['directories']),
                'file_type_count': len(structure['file_types'])
            }
            
        except Exception as e:
            logger.error(f"项目结构分析失败: {e}")
            
        return structure
    
    def _analyze_dependencies(self, project_path: Path) -> Dict[str, Any]:
        """分析项目依赖"""
        dependencies = {
            'package_files': [],
            'dependencies': {},
            'dev_dependencies': {}
        }
        
        # 检查常见的依赖文件
        dep_files = ['package.json', 'requirements.txt', 'Pipfile', 'pom.xml', 'build.gradle']
        
        for dep_file in dep_files:
            file_path = project_path / dep_file
            if file_path.exists():
                dependencies['package_files'].append(dep_file)
                
                if dep_file == 'package.json':
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            package_data = json.load(f)
                            dependencies['dependencies'] = package_data.get('dependencies', {})
                            dependencies['dev_dependencies'] = package_data.get('devDependencies', {})
                    except Exception as e:
                        logger.error(f"解析 {dep_file} 失败: {e}")
        
        return dependencies
    
    def _analyze_documentation(self, project_path: Path) -> Dict[str, Any]:
        """分析项目文档"""
        documentation = {
            'readme_files': [],
            'doc_directories': [],
            'markdown_files': [],
            'documentation_coverage': 'low'
        }
        
        # 查找README文件
        readme_patterns = ['README.md', 'readme.md', 'README.txt', 'README']
        for pattern in readme_patterns:
            readme_file = project_path / pattern
            if readme_file.exists():
                documentation['readme_files'].append(pattern)
        
        # 查找文档目录
        doc_dirs = ['docs', 'doc', 'documentation', 'wiki']
        for doc_dir in doc_dirs:
            dir_path = project_path / doc_dir
            if dir_path.exists() and dir_path.is_dir():
                documentation['doc_directories'].append(doc_dir)
        
        # 统计Markdown文件
        for md_file in project_path.rglob('*.md'):
            documentation['markdown_files'].append(str(md_file.relative_to(project_path)))
        
        # 评估文档覆盖率
        doc_score = 0
        if documentation['readme_files']:
            doc_score += 30
        if documentation['doc_directories']:
            doc_score += 40
        if len(documentation['markdown_files']) > 5:
            doc_score += 30
        
        if doc_score >= 70:
            documentation['documentation_coverage'] = 'high'
        elif doc_score >= 40:
            documentation['documentation_coverage'] = 'medium'
        else:
            documentation['documentation_coverage'] = 'low'
        
        return documentation
    
    def _analyze_configuration(self, project_path: Path) -> Dict[str, Any]:
        """分析项目配置"""
        configuration = {
            'config_files': [],
            'build_tools': [],
            'ci_cd': [],
            'environment_files': []
        }
        
        # 配置文件
        config_files = ['.gitignore', '.editorconfig', '.eslintrc', 'tsconfig.json', 
                       'webpack.config.js', 'vite.config.js', 'rollup.config.js']
        
        for config_file in config_files:
            if (project_path / config_file).exists():
                configuration['config_files'].append(config_file)
        
        # 构建工具
        build_files = ['Makefile', 'gulpfile.js', 'Gruntfile.js', 'build.xml']
        for build_file in build_files:
            if (project_path / build_file).exists():
                configuration['build_tools'].append(build_file)
        
        # CI/CD
        ci_dirs = ['.github', '.gitlab-ci.yml', 'jenkins', '.travis.yml', '.circleci']
        for ci_item in ci_dirs:
            ci_path = project_path / ci_item
            if ci_path.exists():
                configuration['ci_cd'].append(ci_item)
        
        # 环境文件
        env_files = ['.env', '.env.local', '.env.development', '.env.production']
        for env_file in env_files:
            if (project_path / env_file).exists():
                configuration['environment_files'].append(env_file)
        
        return configuration
    
    def _comprehensive_analysis(self, project_info: Dict[str, Any], agent: str) -> Dict[str, Any]:
        """综合分析"""
        return {
            'analysis_type': 'comprehensive',
            'project_overview': self._generate_project_overview(project_info),
            'business_analysis': self._business_analysis(project_info, agent)['business_model'],
            'technical_analysis': self._technical_analysis(project_info, agent)['technical_assessment'],
            'stakeholder_analysis': self._stakeholder_analysis(project_info, agent)['stakeholders'],
            'risk_analysis': self._risk_analysis(project_info, agent)['risks'],
            'recommendations': self._generate_recommendations(project_info),
            'project_info': project_info
        }
    
    def _business_analysis(self, project_info: Dict[str, Any], agent: str) -> Dict[str, Any]:
        """业务分析"""
        business_model = {
            'value_proposition': self._analyze_value_proposition(project_info),
            'target_market': self._analyze_target_market(project_info),
            'revenue_model': self._analyze_revenue_model(project_info),
            'competitive_landscape': self._analyze_competition(project_info)
        }
        
        return {
            'analysis_type': 'business',
            'business_model': business_model,
            'business_metrics': self._calculate_business_metrics(project_info)
        }
    
    def _technical_analysis(self, project_info: Dict[str, Any], agent: str) -> Dict[str, Any]:
        """技术分析"""
        technical_assessment = {
            'architecture_pattern': self._identify_architecture_pattern(project_info),
            'technology_stack': self._analyze_technology_stack(project_info),
            'code_quality': self._assess_code_quality(project_info),
            'scalability': self._assess_scalability(project_info),
            'maintainability': self._assess_maintainability(project_info)
        }
        
        return {
            'analysis_type': 'technical',
            'technical_assessment': technical_assessment,
            'technical_metrics': self._calculate_technical_metrics(project_info)
        }
    
    def _stakeholder_analysis(self, project_info: Dict[str, Any], agent: str) -> Dict[str, Any]:
        """利益相关者分析"""
        stakeholders = {
            'primary_stakeholders': self._identify_primary_stakeholders(project_info),
            'secondary_stakeholders': self._identify_secondary_stakeholders(project_info),
            'stakeholder_needs': self._analyze_stakeholder_needs(project_info),
            'communication_strategy': self._develop_communication_strategy(project_info)
        }
        
        return {
            'analysis_type': 'stakeholder',
            'stakeholders': stakeholders
        }
    
    def _risk_analysis(self, project_info: Dict[str, Any], agent: str) -> Dict[str, Any]:
        """风险分析"""
        risks = {
            'technical_risks': self._identify_technical_risks(project_info),
            'business_risks': self._identify_business_risks(project_info),
            'operational_risks': self._identify_operational_risks(project_info),
            'mitigation_strategies': self._develop_mitigation_strategies(project_info)
        }
        
        return {
            'analysis_type': 'risk',
            'risks': risks
        }
    
    # 辅助方法
    def _generate_project_overview(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        """生成项目概览"""
        structure = project_info['structure']
        dependencies = project_info['dependencies']
        
        return {
            'project_size': self._classify_project_size(structure['size_metrics']),
            'primary_language': self._identify_primary_language(structure['file_types']),
            'project_type': self._classify_project_type(structure, dependencies),
            'maturity_level': self._assess_project_maturity(project_info)
        }
    
    def _classify_project_size(self, metrics: Dict[str, Any]) -> str:
        """分类项目规模"""
        file_count = metrics.get('total_files', 0)
        
        if file_count < 50:
            return 'small'
        elif file_count < 200:
            return 'medium'
        elif file_count < 1000:
            return 'large'
        else:
            return 'enterprise'
    
    def _identify_primary_language(self, file_types: Dict[str, int]) -> str:
        """识别主要编程语言"""
        code_extensions = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.py': 'Python',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.cs': 'C#',
            '.go': 'Go',
            '.rs': 'Rust',
            '.php': 'PHP'
        }
        
        max_count = 0
        primary_lang = 'Unknown'
        
        for ext, count in file_types.items():
            if ext in code_extensions and count > max_count:
                max_count = count
                primary_lang = code_extensions[ext]
        
        return primary_lang
    
    def _classify_project_type(self, structure: Dict[str, Any], dependencies: Dict[str, Any]) -> str:
        """分类项目类型"""
        # 基于文件结构和依赖判断项目类型
        deps = dependencies.get('dependencies', {})
        
        if 'react' in deps or 'vue' in deps or 'angular' in deps:
            return 'web_frontend'
        elif 'express' in deps or 'koa' in deps or 'fastify' in deps:
            return 'web_backend'
        elif 'electron' in deps:
            return 'desktop_app'
        elif 'react-native' in deps or 'expo' in deps:
            return 'mobile_app'
        else:
            return 'general'
    
    def _assess_project_maturity(self, project_info: Dict[str, Any]) -> str:
        """评估项目成熟度"""
        score = 0
        
        # 文档评分
        doc_coverage = project_info['documentation']['documentation_coverage']
        if doc_coverage == 'high':
            score += 30
        elif doc_coverage == 'medium':
            score += 20
        elif doc_coverage == 'low':
            score += 10
        
        # 配置评分
        config_count = len(project_info['configuration']['config_files'])
        score += min(config_count * 5, 25)
        
        # CI/CD评分
        if project_info['configuration']['ci_cd']:
            score += 20
        
        # 依赖管理评分
        if project_info['dependencies']['package_files']:
            score += 25
        
        if score >= 80:
            return 'mature'
        elif score >= 50:
            return 'developing'
        else:
            return 'early'
    
    # 占位符方法 - 实际实现需要更复杂的逻辑
    def _analyze_value_proposition(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '价值主张分析'}
    
    def _analyze_target_market(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '目标市场分析'}
    
    def _analyze_revenue_model(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '收入模式分析'}
    
    def _analyze_competition(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '竞争分析'}
    
    def _calculate_business_metrics(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '业务指标计算'}
    
    def _identify_architecture_pattern(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '架构模式识别'}
    
    def _analyze_technology_stack(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '技术栈分析'}
    
    def _assess_code_quality(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '代码质量评估'}
    
    def _assess_scalability(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '可扩展性评估'}
    
    def _assess_maintainability(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '可维护性评估'}
    
    def _calculate_technical_metrics(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '技术指标计算'}
    
    def _identify_primary_stakeholders(self, project_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [{'status': 'placeholder', 'description': '主要利益相关者识别'}]
    
    def _identify_secondary_stakeholders(self, project_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [{'status': 'placeholder', 'description': '次要利益相关者识别'}]
    
    def _analyze_stakeholder_needs(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '利益相关者需求分析'}
    
    def _develop_communication_strategy(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '沟通策略制定'}
    
    def _identify_technical_risks(self, project_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [{'status': 'placeholder', 'description': '技术风险识别'}]
    
    def _identify_business_risks(self, project_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [{'status': 'placeholder', 'description': '业务风险识别'}]
    
    def _identify_operational_risks(self, project_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [{'status': 'placeholder', 'description': '运营风险识别'}]
    
    def _develop_mitigation_strategies(self, project_info: Dict[str, Any]) -> Dict[str, Any]:
        return {'status': 'placeholder', 'description': '风险缓解策略制定'}
    
    def _generate_recommendations(self, project_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [{'status': 'placeholder', 'description': '改进建议生成'}]
    
    def _get_timestamp(self) -> str:
        """获取时间戳"""
        from datetime import datetime
        return datetime.now().isoformat()