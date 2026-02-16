import fs from 'fs';
import path from 'path';
import os from 'os';
import { extractInputHints, InputHints } from '@/utils/input';

describe('extractInputHints', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'input-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return empty object for undefined input', () => {
    const result = extractInputHints(undefined);
    expect(result).toEqual({});
  });

  it('should return empty object for empty string', () => {
    const result = extractInputHints('');
    expect(result).toEqual({});
  });

  it('should return empty object for non-existent file', () => {
    const result = extractInputHints('/nonexistent/file.json');
    expect(result).toEqual({});
  });

  describe('JSON files', () => {
    it('should extract preferredStack and runMode from JSON', () => {
      const filePath = path.join(tmpDir, 'hints.json');
      fs.writeFileSync(filePath, JSON.stringify({ preferredStack: 'typescript', runMode: 'dev' }));

      const result = extractInputHints(filePath);
      expect(result).toEqual({ preferredStack: 'typescript', runMode: 'dev' });
    });

    it('should return empty object for invalid JSON', () => {
      const filePath = path.join(tmpDir, 'bad.json');
      fs.writeFileSync(filePath, 'not json content {{{');

      const result = extractInputHints(filePath);
      expect(result).toEqual({});
    });

    it('should ignore non-string values in JSON', () => {
      const filePath = path.join(tmpDir, 'typed.json');
      fs.writeFileSync(filePath, JSON.stringify({ preferredStack: 123, runMode: true }));

      const result = extractInputHints(filePath);
      expect(result).toEqual({ preferredStack: undefined, runMode: undefined });
    });

    it('should handle JSON with only preferredStack', () => {
      const filePath = path.join(tmpDir, 'partial.json');
      fs.writeFileSync(filePath, JSON.stringify({ preferredStack: 'python' }));

      const result = extractInputHints(filePath);
      expect(result).toEqual({ preferredStack: 'python', runMode: undefined });
    });
  });

  describe('Markdown/text files', () => {
    it('should extract hints from markdown with English keys', () => {
      const filePath = path.join(tmpDir, 'hints.md');
      fs.writeFileSync(filePath, 'preferredStack: typescript\nrunMode: production\n');

      const result = extractInputHints(filePath);
      expect(result).toEqual({ preferredStack: 'typescript', runMode: 'production' });
    });

    it('should extract hints from markdown with Chinese keys', () => {
      const filePath = path.join(tmpDir, 'hints.md');
      fs.writeFileSync(filePath, '栈：python\n运行模式：dev\n');

      const result = extractInputHints(filePath);
      expect(result).toEqual({ preferredStack: 'python', runMode: 'dev' });
    });

    it('should return empty for .txt file with no matching keys', () => {
      const filePath = path.join(tmpDir, 'hints.txt');
      fs.writeFileSync(filePath, 'some random content\nno keys here\n');

      const result = extractInputHints(filePath);
      expect(result).toEqual({ preferredStack: undefined, runMode: undefined });
    });

    it('should take first match when multiple lines match', () => {
      const filePath = path.join(tmpDir, 'multi.md');
      fs.writeFileSync(filePath, 'preferredStack: first\npreferredStack: second\n');

      const result = extractInputHints(filePath);
      expect(result.preferredStack).toBe('first');
    });
  });

  it('should return empty object for unsupported file extension', () => {
    const filePath = path.join(tmpDir, 'hints.xml');
    fs.writeFileSync(filePath, '<hints><stack>ts</stack></hints>');

    const result = extractInputHints(filePath);
    expect(result).toEqual({});
  });

  it('should resolve relative paths against cwd', () => {
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      fs.writeFileSync(path.join(tmpDir, 'rel.json'), JSON.stringify({ preferredStack: 'go' }));
      const result = extractInputHints('rel.json');
      expect(result.preferredStack).toBe('go');
    } finally {
      process.chdir(origCwd);
    }
  });
});
