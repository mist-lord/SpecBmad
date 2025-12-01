import { ConfigValidator, ConfigMigrator, ValidationResult } from '../../src/utils/config-validator';
import { ProjectConfig } from '../../src/utils/config';

describe('ConfigValidator.validate', () => {
  test('invalid projectName and semver yields errors and warnings', () => {
    const cfg: ProjectConfig = {
      projectName: '',
      version: 'v1',
      type: 'web',
      scale_level: 1,
    };
    const result: ValidationResult = ConfigValidator.validate(cfg);
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(['项目名称不能为空']));
    expect(result.warnings).toEqual(expect.arrayContaining(['版本号格式不正确，建议使用语义化版本']));
  });

  test('invalid type and scale_level range', () => {
    const cfg: ProjectConfig = {
      projectName: 'Demo',
      version: '1.0.0',
      type: 'desktop' as any,
      scale_level: 9 as any,
    };
    const result = ConfigValidator.validate(cfg);
    expect(result.isValid).toBe(false);
    expect(result.errors.join('\n')).toMatch(/无效的项目类型/);
    expect(result.errors.join('\n')).toMatch(/项目规模级别必须在0-4之间/);
  });

  test('spec_kit enabled without ai_agent warns', () => {
    const cfg: ProjectConfig = {
      projectName: 'Demo',
      version: '1.0.0',
      spec_kit: { enabled: true },
    } as any;
    const result = ConfigValidator.validate(cfg);
    expect(result.isValid).toBe(true);
    expect(result.warnings.join('\n')).toMatch(/Spec-Kit已启用但未指定AI代理/);
  });

  test('bmad_method invalid workflow_mode errors', () => {
    const cfg: ProjectConfig = {
      projectName: 'Demo',
      version: '1.0.0',
      bmad_method: { enabled: true, active_modules: ['bmm'], workflow_mode: 'turbo' as any }
    };
    const result = ConfigValidator.validate(cfg);
    expect(result.isValid).toBe(false);
    expect(result.errors.join('\n')).toMatch(/无效的BMAD工作流模式/);
  });

  test('agents missing type errors, enabled without model warns', () => {
    const cfg: ProjectConfig = {
      projectName: 'Demo',
      version: '1.0.0',
      agents: {
        A1: { enabled: true } as any,
        A2: { type: 'claude', enabled: true } as any,
      }
    };
    const r = ConfigValidator.validate(cfg);
    expect(r.isValid).toBe(false);
    expect(r.errors.join('\n')).toMatch(/代理 A1 缺少类型配置/);
    expect(r.warnings.join('\n')).toMatch(/代理 A2 已启用但未指定模型/);
  });

  test('integration invalid enum values', () => {
    const cfg: ProjectConfig = {
      projectName: 'Demo',
      version: '1.0.0',
      integration: { workflow_mode: 'weird' as any, output_format: 'txt' as any, bridge_mode: 'socket' as any }
    };
    const r = ConfigValidator.validate(cfg);
    expect(r.isValid).toBe(false);
    expect(r.errors.join('\n')).toMatch(/无效的集成工作流模式/);
    expect(r.errors.join('\n')).toMatch(/无效的输出格式/);
    expect(r.errors.join('\n')).toMatch(/无效的桥接模式/);
  });
});

describe('ConfigValidator.autoFix', () => {
  test('fills defaults for missing fields', () => {
    const cfg: ProjectConfig = {};
    const fixed = ConfigValidator.autoFix(cfg);
    expect(fixed.projectName).toBeDefined();
    expect(fixed.version).toBeDefined();
    expect(fixed.type).toBe('web');
    expect(fixed.scale_level).toBe(1);
    expect(fixed.spec_kit?.enabled).toBe(true);
    expect(fixed.bmad_method?.workflow_mode).toBe('standard');
    expect(fixed.integration?.bridge_mode).toBe('subprocess');
  });
});

describe('ConfigMigrator.migrate', () => {
  test('migrates 0.x style config and sets _version', () => {
    const legacy: any = {
      name: 'LegacyName',
      projectType: 'mobile',
      specKit: { enabled: true, aiAgent: 'mock' },
      bmadMethod: { enabled: true, activeModules: ['bmm'], workflowMode: 'accelerated' },
      output_dir: './out',
      templates_dir: './tpls',
      log_level: 'debug',
      autoSave: false,
    };

    const migrated = ConfigMigrator.migrate(legacy);
    expect((migrated as any)._version).toBeDefined();
    expect((migrated as any)._version).toBe('1.0.0');
    expect(migrated.projectName).toBe('LegacyName');
    expect(migrated.type).toBe('mobile');
    expect(migrated.integration?.workflow_mode).toBeDefined();
    expect(migrated.spec_kit?.ai_agent).toBe('mock');
    expect(migrated.bmad_method?.workflow_mode).toBe('accelerated');
  });
});