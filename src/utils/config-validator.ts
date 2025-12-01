import { ProjectConfig } from './config';
import { log } from './logger';

/**
 * 配置验证器
 */
export class ConfigValidator {
  /**
   * 验证项目配置
   */
  public static validate(config: ProjectConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证基本项目信息
    if (!config.projectName || config.projectName.trim() === '') {
      errors.push('项目名称不能为空');
    }

    if (!config.version || !this.isValidVersion(config.version)) {
      warnings.push('版本号格式不正确，建议使用语义化版本');
    }

    // 验证项目类型和规模
    const validTypes = ['web', 'mobile', 'game', 'enterprise'];
    if (config.type && !validTypes.includes(config.type)) {
      errors.push(`无效的项目类型: ${config.type}，支持的类型: ${validTypes.join(', ')}`);
    }

    if (config.scale_level !== undefined && (config.scale_level < 0 || config.scale_level > 4)) {
      errors.push('项目规模级别必须在0-4之间');
    }

    // 验证Spec-Kit配置
    if (config.spec_kit) {
      if (config.spec_kit.enabled && !config.spec_kit.ai_agent) {
        warnings.push('Spec-Kit已启用但未指定AI代理');
      }
    }

    // 验证BMAD-Method配置
    if (config.bmad_method) {
      if (config.bmad_method.enabled && (!config.bmad_method.active_modules || config.bmad_method.active_modules.length === 0)) {
        warnings.push('BMAD-Method已启用但未指定活动模块');
      }

      const validWorkflowModes = ['standard', 'accelerated'];
      if (config.bmad_method.workflow_mode && !validWorkflowModes.includes(config.bmad_method.workflow_mode)) {
        errors.push(`无效的BMAD工作流模式: ${config.bmad_method.workflow_mode}`);
      }
    }

    // 验证代理配置
    if (config.agents) {
      for (const [agentName, agentConfig] of Object.entries(config.agents)) {
        if (!agentConfig.type) {
          errors.push(`代理 ${agentName} 缺少类型配置`);
        }

        if (agentConfig.enabled && !agentConfig.model) {
          warnings.push(`代理 ${agentName} 已启用但未指定模型`);
        }
      }
    }

    // 验证集成配置
    if (config.integration) {
      const validWorkflowModes = ['hybrid', 'spec_first', 'bmad_first'];
      if (config.integration.workflow_mode && !validWorkflowModes.includes(config.integration.workflow_mode)) {
        errors.push(`无效的集成工作流模式: ${config.integration.workflow_mode}`);
      }

      const validOutputFormats = ['markdown', 'yaml', 'json'];
      if (config.integration.output_format && !validOutputFormats.includes(config.integration.output_format)) {
        errors.push(`无效的输出格式: ${config.integration.output_format}`);
      }

      const validBridgeModes = ['subprocess', 'api', 'direct'];
      if (config.integration.bridge_mode && !validBridgeModes.includes(config.integration.bridge_mode)) {
        errors.push(`无效的桥接模式: ${config.integration.bridge_mode}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证版本号格式
   */
  private static isValidVersion(version: string): boolean {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    return semverRegex.test(version);
  }

  /**
   * 自动修复配置
   */
  public static autoFix(config: ProjectConfig): ProjectConfig {
    const fixedConfig = { ...config };

    // 自动设置默认值
    if (!fixedConfig.projectName) {
      fixedConfig.projectName = 'Untitled Project';
    }

    if (!fixedConfig.version) {
      fixedConfig.version = '0.1.0';
    }

    if (!fixedConfig.type) {
      fixedConfig.type = 'web';
    }

    if (fixedConfig.scale_level === undefined) {
      fixedConfig.scale_level = 1;
    }

    // 确保必要的配置存在
    if (!fixedConfig.spec_kit) {
      fixedConfig.spec_kit = {
        enabled: true,
        ai_agent: 'claude'
      };
    }

    if (!fixedConfig.bmad_method) {
      fixedConfig.bmad_method = {
        enabled: true,
        active_modules: ['bmm'],
        workflow_mode: 'standard'
      };
    }

    if (!fixedConfig.integration) {
      fixedConfig.integration = {
        workflow_mode: 'hybrid',
        output_format: 'markdown',
        bridge_mode: 'subprocess'
      };
    }

    return fixedConfig;
  }
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 配置迁移器
 */
export class ConfigMigrator {
  private static readonly CURRENT_VERSION = '1.0.0';

  /**
   * 迁移配置到最新版本
   */
  public static migrate(config: any): ProjectConfig {
    // 检查配置版本
    const configVersion = config._version || '0.0.0';
    
    if (this.compareVersions(configVersion, this.CURRENT_VERSION) >= 0) {
      return config;
    }

    log.info(`迁移配置从版本 ${configVersion} 到 ${this.CURRENT_VERSION}`);

    let migratedConfig = { ...config };

    // 从0.x版本迁移
    if (this.compareVersions(configVersion, '1.0.0') < 0) {
      migratedConfig = this.migrateFrom0x(migratedConfig);
    }

    // 设置新版本号
    migratedConfig._version = this.CURRENT_VERSION;

    return migratedConfig;
  }

  /**
   * 从0.x版本迁移
   */
  private static migrateFrom0x(config: any): ProjectConfig {
    const migrated: any = {};

    // 迁移基本信息
    migrated.projectName = config.name || config.projectName;
    migrated.version = config.version || '0.1.0';
    migrated.description = config.description;

    // 迁移项目设置
    migrated.type = config.projectType || config.type || 'web';
    migrated.scale_level = config.scaleLevel || config.scale_level || 1;
    migrated.language = config.language || 'typescript';
    migrated.framework = config.framework;

    // 迁移Spec-Kit配置
    if (config.specKit || config.spec_kit) {
      const specKitConfig = config.specKit || config.spec_kit;
      migrated.spec_kit = {
        enabled: specKitConfig.enabled !== false,
        ai_agent: specKitConfig.aiAgent || specKitConfig.ai_agent || 'claude',
        templates_path: specKitConfig.templatesPath || specKitConfig.templates_path,
        constitution_file: specKitConfig.constitutionFile || specKitConfig.constitution_file
      };
    }

    // 迁移BMAD-Method配置
    if (config.bmadMethod || config.bmad_method) {
      const bmadConfig = config.bmadMethod || config.bmad_method;
      migrated.bmad_method = {
        enabled: bmadConfig.enabled !== false,
        active_modules: bmadConfig.activeModules || bmadConfig.active_modules || ['bmm'],
        agents_config: bmadConfig.agentsConfig || bmadConfig.agents_config,
        workflow_mode: bmadConfig.workflowMode || bmadConfig.workflow_mode || 'standard'
      };
    }

    // 迁移集成配置
    if (config.integration) {
      const integ = config.integration;
      migrated.integration = {
        workflow_mode: integ.workflowMode || integ.workflow_mode || 'hybrid',
        output_format: integ.outputFormat || integ.output_format || 'markdown',
        bridge_mode: integ.bridgeMode || integ.bridge_mode || 'subprocess'
      };
    } else {
      migrated.integration = {
        workflow_mode: 'hybrid',
        output_format: 'markdown',
        bridge_mode: 'subprocess'
      };
    }

    // 迁移代理配置
    if (config.agents) {
      migrated.agents = config.agents;
    }
    
    // 迁移其他配置
    migrated.outputDir = config.outputDir || config.output_dir || './output';
    migrated.templatesDir = config.templatesDir || config.templates_dir || './templates';
    migrated.logLevel = config.logLevel || config.log_level || 'info';
    migrated.autoSave = config.autoSave !== false;
    migrated.backupEnabled = config.backupEnabled !== false;

    return migrated;
  }

  /**
   * 比较版本号
   */
  private static compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }

    return 0;
  }
}