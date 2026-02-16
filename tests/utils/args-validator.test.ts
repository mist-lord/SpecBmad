import { validateInitArgs, validateSpecifyArgs, ValidationResult } from '@/utils/args-validator';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('validateInitArgs', () => {
  it('should return valid for valid project name with no options', () => {
    const result = validateInitArgs('my-project', {});
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return error for empty project name', () => {
    const result = validateInitArgs('', {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('项目名称不能为空');
  });

  it('should return error for whitespace-only project name', () => {
    const result = validateInitArgs('   ', {});
    expect(result.valid).toBe(false);
  });

  it('should accept known templates without warning', () => {
    const result = validateInitArgs('proj', { template: 'web-basic' });
    expect(result.warnings).toHaveLength(0);
  });

  it('should warn for unknown template', () => {
    const result = validateInitArgs('proj', { template: 'custom-unknown' });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('未知模板');
  });

  it('should accept known languages without warning', () => {
    const result = validateInitArgs('proj', { language: 'typescript' });
    expect(result.warnings).toHaveLength(0);
  });

  it('should warn for uncommon language', () => {
    const result = validateInitArgs('proj', { language: 'haskell' });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('不常见语言');
  });

  it('should accept known frameworks without warning', () => {
    const result = validateInitArgs('proj', { framework: 'react' });
    expect(result.warnings).toHaveLength(0);
  });

  it('should warn for uncommon framework', () => {
    const result = validateInitArgs('proj', { framework: 'angular' });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('不常见框架');
  });

  it('should warn for empty agents string', () => {
    const result = validateInitArgs('proj', { agents: ',,,' });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('AI代理列表为空');
  });

  it('should not warn for valid agents list', () => {
    const result = validateInitArgs('proj', { agents: 'Analyst,Architect' });
    expect(result.warnings.filter(w => w.includes('代理列表'))).toHaveLength(0);
  });

  it('should accept known LLM providers without warning', () => {
    const result = validateInitArgs('proj', { llmProvider: 'openai' });
    expect(result.warnings).toHaveLength(0);
  });

  it('should warn for unknown LLM provider', () => {
    const result = validateInitArgs('proj', { llmProvider: 'gemini' });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('未知LLM提供商');
  });

  it('should accumulate multiple warnings', () => {
    const result = validateInitArgs('proj', {
      template: 'unknown-tpl',
      language: 'cobol',
      framework: 'knockout',
      llmProvider: 'azure',
    });
    expect(result.warnings.length).toBe(4);
    expect(result.valid).toBe(true); // warnings don't make it invalid
  });
});

describe('validateSpecifyArgs', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'args-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return valid with no options in interactive mode', () => {
    const result = validateSpecifyArgs({ interactive: true });
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('should warn when no input and not interactive', () => {
    const result = validateSpecifyArgs({});
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('未提供输入文件');
  });

  it('should warn for non-existent input file', () => {
    const result = validateSpecifyArgs({ input: '/nonexistent/file.md' });
    expect(result.warnings.some(w => w.includes('输入文件不存在'))).toBe(true);
  });

  it('should not warn for existing input file', () => {
    const inputFile = path.join(tmpDir, 'input.md');
    fs.writeFileSync(inputFile, 'test content');
    const result = validateSpecifyArgs({ input: inputFile });
    expect(result.warnings.filter(w => w.includes('输入文件不存在'))).toHaveLength(0);
  });

  it('should accept known specify templates', () => {
    const result = validateSpecifyArgs({ interactive: true, template: 'standard' });
    expect(result.warnings.filter(w => w.includes('未知规格模板'))).toHaveLength(0);
  });

  it('should warn for unknown specify template', () => {
    const result = validateSpecifyArgs({ interactive: true, template: 'custom' });
    expect(result.warnings.some(w => w.includes('未知规格模板'))).toBe(true);
  });

  it('should accept known agents', () => {
    const result = validateSpecifyArgs({ interactive: true, agent: 'Analyst' });
    expect(result.warnings.filter(w => w.includes('未知代理'))).toHaveLength(0);
  });

  it('should warn for unknown agent', () => {
    const result = validateSpecifyArgs({ interactive: true, agent: 'CustomAgent' });
    expect(result.warnings.some(w => w.includes('未知代理'))).toBe(true);
  });

  it('should create output directory if it does not exist', () => {
    const outputPath = path.join(tmpDir, 'sub', 'output.md');
    const result = validateSpecifyArgs({ interactive: true, output: outputPath });
    expect(result.valid).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'sub'))).toBe(true);
  });
});
