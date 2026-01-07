import path from 'path';

/**
 * 项目路径常量
 * 
 * 统一管理所有项目相关的路径，避免硬编码路径分散在代码中。
 * 所有路径都基于项目根目录（process.cwd()）。
 */
export const PATHS = {
  /**
   * 主配置目录
   */
  CONFIG_DIR: '.specbmad',
  
  /**
   * 配置文件路径（支持多种格式）
   */
  CONFIG_FILE_JSON: '.specbmad.json',
  CONFIG_FILE_YAML: '.specbmad.yaml',
  CONFIG_FILE_ALT_JSON: '.specbmad/config.json',
  CONFIG_FILE_ALT_YAML: '.specbmad/config.yaml',
  
  /**
   * 工作流相关路径
   */
  WORKFLOW_STATE_FILE: '.specbmad/workflow.state.json',
  WORKFLOW_CHAIN_STATE_FILE: '.specbmad/chain.state.json',
  
  /**
   * 产物目录
   */
  ARTIFACTS_DIR: '.specbmad/artifacts',
  
  /**
   * 规范文档目录（旧路径，向后兼容）
   */
  SPECIFICATIONS_DIR: '.specbmad/specifications',
  
  /**
   * V2 架构目录结构
   */
  SPEC_DIR: 'spec',
  PLAN_DIR: 'plan',
  CODE_DIR: 'code',
  VERIFICATION_DIR: 'verification',
  EVENTS_DIR: 'events',
  
  /**
   * Phase 相关文件
   */
  PHASE_STATE_FILE: '.specbmad/phase.state.json',
  PHASE_TRANSITIONS_CONFIG: 'spec/phase_transitions.yaml',
  
  /**
   * 缓存目录
   */
  CACHE_DIR: '.specbmad/cache',
  
  /**
   * 发布目录
   */
  RELEASES_DIR: '.specbmad/releases',
  
  /**
   * 状态文件
   */
  STATUS_FILE: '.specbmad/status.json',
  
  /**
   * 运行记录目录
   */
  RUNS_DIR: '.specbmad/runs',
  
  /**
   * 模板目录
   */
  TEMPLATES_DIR: 'templates',
  
  /**
   * 输出目录
   */
  OUTPUT_DIR: 'output',
} as const;

/**
 * 获取项目根目录下的完整路径
 */
export function getProjectPath(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

/**
 * 获取配置目录下的完整路径
 */
export function getConfigPath(relativePath: string): string {
  return path.join(process.cwd(), PATHS.CONFIG_DIR, relativePath);
}

/**
 * 获取产物目录下的完整路径
 */
export function getArtifactsPath(relativePath: string): string {
  return path.join(process.cwd(), PATHS.ARTIFACTS_DIR, relativePath);
}

/**
 * 获取运行记录目录下的完整路径
 */
export function getRunPath(runId: string, subPath: string = ''): string {
  return path.join(process.cwd(), PATHS.RUNS_DIR, runId, subPath);
}

/**
 * 获取 V2 架构目录路径
 */
export function getSpecPath(subPath: string = ''): string {
  return path.join(process.cwd(), PATHS.SPEC_DIR, subPath);
}

export function getPlanPath(subPath: string = ''): string {
  return path.join(process.cwd(), PATHS.PLAN_DIR, subPath);
}

export function getCodePath(subPath: string = ''): string {
  return path.join(process.cwd(), PATHS.CODE_DIR, subPath);
}

export function getVerificationPath(subPath: string = ''): string {
  return path.join(process.cwd(), PATHS.VERIFICATION_DIR, subPath);
}

export function getEventsPath(subPath: string = ''): string {
  return path.join(process.cwd(), PATHS.EVENTS_DIR, subPath);
}

/**
 * 旧路径映射（用于向后兼容和迁移）
 * 
 * @deprecated 这些路径将在未来版本中移除，请使用 PATHS 中的新路径
 */
export const LEGACY_PATHS = {
  OLD_BMAD_DIR: '.bmad',
  OLD_ARTIFACTS_DIR: '.bmad/artifacts',
  OLD_WORKFLOW_STATE: '.bmad/workflow.state.json',
  OLD_RELEASES_DIR: '.bmad/releases',
} as const;

