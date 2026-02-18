import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  readTasksMarkdown,
  planFromTasks,
  writeSkeleton,
  updatePackageJson,
  buildTraceability,
  writeConsistencyReport,
  strengthenPlanning,
} from '@/utils/tasks-driven';

describe('tasks-driven', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('readTasksMarkdown', () => {
    it('should read markdown file content', () => {
      const filePath = path.join(tmpDir, 'tasks.md');
      fs.writeFileSync(filePath, '# Tasks\n- Task 1\n');
      expect(readTasksMarkdown(filePath)).toBe('# Tasks\n- Task 1\n');
    });

    it('should return empty string for non-existent file', () => {
      expect(readTasksMarkdown('/nonexistent/tasks.md')).toBe('');
    });
  });

  describe('planFromTasks', () => {
    it('should return empty array for unrelated markdown', () => {
      const plans = planFromTasks('# Hello World\nSome random content');
      expect(plans).toHaveLength(0);
    });

    it('should generate search module plan when search keyword present', () => {
      const plans = planFromTasks('# Tasks\n- Implement search feature');
      expect(plans.some(p => p.name === 'search')).toBe(true);
      const searchPlan = plans.find(p => p.name === 'search')!;
      expect(searchPlan.files.length).toBeGreaterThan(0);
      expect(searchPlan.tests.length).toBeGreaterThan(0);
    });

    it('should generate version module plan when version keyword present', () => {
      const plans = planFromTasks('# Tasks\n- Add 版本 management');
      expect(plans.some(p => p.name === 'version')).toBe(true);
    });

    it('should generate logging module plan when log keyword present', () => {
      const plans = planFromTasks('# Tasks\n- Add 日志 system');
      expect(plans.some(p => p.name === 'logging')).toBe(true);
    });

    it('should generate auth module plan when auth keyword present', () => {
      const plans = planFromTasks('# Tasks\n- Implement 权限 control');
      expect(plans.some(p => p.name === 'auth')).toBe(true);
    });

    it('should generate multiple plans when multiple keywords present', () => {
      const plans = planFromTasks('# Tasks\n- search and version and auth features');
      expect(plans.length).toBe(3);
    });
  });

  describe('writeSkeleton', () => {
    it('should write files and tests to project directory', () => {
      const plans = planFromTasks('# search feature');
      const result = writeSkeleton(tmpDir, plans);

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.tests.length).toBeGreaterThan(0);

      // Verify files exist on disk
      for (const f of result.files) {
        expect(fs.existsSync(f)).toBe(true);
      }
      for (const t of result.tests) {
        expect(fs.existsSync(t)).toBe(true);
      }
    });

    it('should create test runner script', () => {
      const plans = planFromTasks('# search feature');
      writeSkeleton(tmpDir, plans);

      const runnerPath = path.join(tmpDir, 'tests', 'run-tests.cjs');
      expect(fs.existsSync(runnerPath)).toBe(true);
    });

    it('should handle empty plans', () => {
      const result = writeSkeleton(tmpDir, []);
      expect(result.files).toHaveLength(0);
      // Still creates test runner
      expect(result.tests.length).toBe(1);
    });
  });

  describe('updatePackageJson', () => {
    it('should add test script to package.json', () => {
      const pkgPath = path.join(tmpDir, 'package.json');
      fs.writeFileSync(pkgPath, JSON.stringify({ name: 'test' }));

      updatePackageJson(tmpDir);

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.scripts.test).toBe('node tests/run-tests.cjs');
    });

    it('should not throw for missing package.json', () => {
      expect(() => updatePackageJson(tmpDir)).not.toThrow();
    });

    it('should preserve existing scripts', () => {
      const pkgPath = path.join(tmpDir, 'package.json');
      fs.writeFileSync(pkgPath, JSON.stringify({ name: 'test', scripts: { build: 'tsc' } }));

      updatePackageJson(tmpDir);

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.scripts.build).toBe('tsc');
      expect(pkg.scripts.test).toBe('node tests/run-tests.cjs');
    });
  });

  describe('buildTraceability', () => {
    it('should generate traceability markdown', () => {
      const md = '1. **用户故事**: Login feature\n- Implement auth\n- Add search';
      const files = ['src/search/index.cjs'];
      const tests = ['tests/search.test.cjs'];

      const result = buildTraceability(md, files, tests);
      expect(result).toContain('## Traceability');
    });

    it('should handle empty inputs', () => {
      const result = buildTraceability('', [], []);
      expect(result).toContain('## Traceability');
    });
  });

  describe('writeConsistencyReport', () => {
    it('should write JSON and markdown reports', () => {
      writeConsistencyReport(tmpDir, {
        files: ['src/a.ts'],
        tests: ['tests/a.test.ts'],
        tasks: 5,
        stories: 3,
      });

      const jsonPath = path.join(tmpDir, '.specbmad', 'artifacts', 'consistency.json');
      expect(fs.existsSync(jsonPath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      expect(data.coverage.files).toBe(1);
      expect(data.coverage.tests).toBe(1);
      expect(data.coverage.tasks).toBe(5);

      const mdPath = path.join(tmpDir, 'docs', '一致性报告.md');
      expect(fs.existsSync(mdPath)).toBe(true);
      const mdContent = fs.readFileSync(mdPath, 'utf-8');
      expect(mdContent).toContain('# 一致性报告');
    });
  });

  describe('strengthenPlanning', () => {
    it('should write planning JSON with module info', () => {
      strengthenPlanning(tmpDir, ['search', 'version']);

      const planPath = path.join(tmpDir, '.specbmad', 'artifacts', 'planning.json');
      expect(fs.existsSync(planPath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
      expect(data.modules).toEqual(['search', 'version']);
      expect(data.api.length).toBeGreaterThan(0); // version module adds API
    });

    it('should omit API section when version module not included', () => {
      strengthenPlanning(tmpDir, ['search']);

      const planPath = path.join(tmpDir, '.specbmad', 'artifacts', 'planning.json');
      const data = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
      expect(data.api).toHaveLength(0);
    });
  });
});
