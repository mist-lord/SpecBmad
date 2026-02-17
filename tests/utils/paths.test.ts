import path from 'path';
import {
  PATHS,
  LEGACY_PATHS,
  getProjectPath,
  getConfigPath,
  getArtifactsPath,
  getRunPath,
  getSpecPath,
  getPlanPath,
  getCodePath,
  getVerificationPath,
  getEventsPath,
} from '@/utils/paths';

describe('PATHS constants', () => {
  it('should define CONFIG_DIR', () => {
    expect(PATHS.CONFIG_DIR).toBe('.specbmad');
  });

  it('should define all config file paths', () => {
    expect(PATHS.CONFIG_FILE_JSON).toBe('.specbmad.json');
    expect(PATHS.CONFIG_FILE_YAML).toBe('.specbmad.yaml');
    expect(PATHS.CONFIG_FILE_ALT_JSON).toBe('.specbmad/config.json');
    expect(PATHS.CONFIG_FILE_ALT_YAML).toBe('.specbmad/config.yaml');
  });

  it('should define workflow paths', () => {
    expect(PATHS.WORKFLOW_STATE_FILE).toBe('.specbmad/workflow.state.json');
    expect(PATHS.WORKFLOW_CHAIN_STATE_FILE).toBe('.specbmad/chain.state.json');
  });

  it('should define V2 architecture directories', () => {
    expect(PATHS.SPEC_DIR).toBe('spec');
    expect(PATHS.PLAN_DIR).toBe('plan');
    expect(PATHS.CODE_DIR).toBe('code');
    expect(PATHS.VERIFICATION_DIR).toBe('verification');
    expect(PATHS.EVENTS_DIR).toBe('events');
  });

  it('should define phase-related paths', () => {
    expect(PATHS.PHASE_STATE_FILE).toBe('.specbmad/phase.state.json');
    expect(PATHS.PHASE_TRANSITIONS_CONFIG).toBe('spec/phase_transitions.yaml');
  });

  it('should define additional directories', () => {
    expect(PATHS.CACHE_DIR).toBe('.specbmad/cache');
    expect(PATHS.RELEASES_DIR).toBe('.specbmad/releases');
    expect(PATHS.RUNS_DIR).toBe('.specbmad/runs');
    expect(PATHS.TEMPLATES_DIR).toBe('templates');
    expect(PATHS.OUTPUT_DIR).toBe('output');
  });
});

describe('LEGACY_PATHS constants', () => {
  it('should define old bmad paths', () => {
    expect(LEGACY_PATHS.OLD_BMAD_DIR).toBe('.bmad');
    expect(LEGACY_PATHS.OLD_ARTIFACTS_DIR).toBe('.bmad/artifacts');
    expect(LEGACY_PATHS.OLD_WORKFLOW_STATE).toBe('.bmad/workflow.state.json');
    expect(LEGACY_PATHS.OLD_RELEASES_DIR).toBe('.bmad/releases');
  });
});

describe('path helper functions', () => {
  const cwd = process.cwd();

  describe('getProjectPath', () => {
    it('should join relative path with cwd', () => {
      expect(getProjectPath('src/index.ts')).toBe(path.join(cwd, 'src/index.ts'));
    });

    it('should handle nested paths', () => {
      expect(getProjectPath('a/b/c')).toBe(path.join(cwd, 'a/b/c'));
    });
  });

  describe('getConfigPath', () => {
    it('should join relative path under .specbmad', () => {
      expect(getConfigPath('config.json')).toBe(path.join(cwd, '.specbmad', 'config.json'));
    });
  });

  describe('getArtifactsPath', () => {
    it('should join relative path under .specbmad/artifacts', () => {
      expect(getArtifactsPath('report.md')).toBe(path.join(cwd, '.specbmad/artifacts', 'report.md'));
    });
  });

  describe('getRunPath', () => {
    it('should create run path with runId', () => {
      expect(getRunPath('run-123')).toBe(path.join(cwd, '.specbmad/runs', 'run-123', ''));
    });

    it('should include subPath when provided', () => {
      expect(getRunPath('run-123', 'output.json')).toBe(
        path.join(cwd, '.specbmad/runs', 'run-123', 'output.json')
      );
    });
  });

  describe('getSpecPath', () => {
    it('should return spec dir for empty subPath', () => {
      expect(getSpecPath()).toBe(path.join(cwd, 'spec', ''));
    });

    it('should include subPath', () => {
      expect(getSpecPath('intent.yaml')).toBe(path.join(cwd, 'spec', 'intent.yaml'));
    });
  });

  describe('getPlanPath', () => {
    it('should return plan dir path', () => {
      expect(getPlanPath('plan.md')).toBe(path.join(cwd, 'plan', 'plan.md'));
    });
  });

  describe('getCodePath', () => {
    it('should return code dir path', () => {
      expect(getCodePath('main.ts')).toBe(path.join(cwd, 'code', 'main.ts'));
    });
  });

  describe('getVerificationPath', () => {
    it('should return verification dir path', () => {
      expect(getVerificationPath('check.json')).toBe(path.join(cwd, 'verification', 'check.json'));
    });
  });

  describe('getEventsPath', () => {
    it('should return events dir path', () => {
      expect(getEventsPath('event.log')).toBe(path.join(cwd, 'events', 'event.log'));
    });
  });
});
