/**
 * Tests for PromptEngine
 *
 * @see src/core/prompt/engine.ts
 */

// --- Mock fs before importing source ---
const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
};
jest.mock('fs', () => ({ default: mockFs, ...mockFs }));

// --- Mock logger ---
jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    success: jest.fn(),
  },
}));

// --- Mock config ---
const mockConfigObj = {
  load: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  save: jest.fn(),
  getAll: jest.fn(),
};
jest.mock('@/utils/config', () => ({
  config: mockConfigObj,
}));

// --- Mock built-in templates ---
const mockBuiltInTemplates: Record<string, any> = {
  Analyst: {
    name: 'Analyst',
    variants: {
      A: 'You are a Business Analyst. Project: {{projectName}} Mode: {{mode}}',
      B: 'Business Analyst for {{projectName}} in {{mode}} mode.',
    },
  },
  Developer: {
    name: 'Developer',
    variants: {
      A: 'Developer template A: {{taskId}}',
      // B variant intentionally missing to test fallback
    },
  },
};
jest.mock('@/core/prompt/templates', () => ({
  builtInTemplates: mockBuiltInTemplates,
}));

import { PromptEngine } from '@/core/prompt/engine';
import { log } from '@/utils/logger';

describe('PromptEngine', () => {
  let engine: PromptEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigObj.get.mockReturnValue(null); // no custom templatesDir
    mockFs.existsSync.mockReturnValue(false); // no disk templates by default
    engine = new PromptEngine();
  });

  // ---------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------
  describe('constructor', () => {
    it('should handle config.load() failure gracefully', () => {
      mockConfigObj.load.mockImplementation(() => {
        throw new Error('Config not found');
      });

      // Should not throw
      const eng = new PromptEngine();
      expect(eng).toBeInstanceOf(PromptEngine);
    });
  });

  // ---------------------------------------------------------------
  // render - built-in templates
  // ---------------------------------------------------------------
  describe('render with built-in templates', () => {
    it('should render built-in template variant A', () => {
      const result = engine.render(
        'Analyst',
        { projectName: 'MyApp', mode: 'full' },
        { variant: 'A' }
      );

      expect(result).toBe('You are a Business Analyst. Project: MyApp Mode: full');
      expect(log.debug).toHaveBeenCalled();
    });

    it('should render built-in template variant B', () => {
      const result = engine.render(
        'Analyst',
        { projectName: 'MyApp', mode: 'quick' },
        { variant: 'B' }
      );

      expect(result).toBe('Business Analyst for MyApp in quick mode.');
    });

    it('should throw when template is not found at all', () => {
      expect(() =>
        engine.render('NonExistent', {}, { variant: 'A' })
      ).toThrow('NonExistent');
    });

    it('should throw when variant is missing and fallbackToBuiltIn is false', () => {
      // Developer has no variant B in our mock
      expect(() =>
        engine.render('Developer', { taskId: '1' }, { variant: 'B', fallbackToBuiltIn: false })
      ).toThrow('Developer');
    });
  });

  // ---------------------------------------------------------------
  // render - disk templates
  // ---------------------------------------------------------------
  describe('render with disk templates', () => {
    it('should use disk template when variant file exists', () => {
      mockConfigObj.get.mockReturnValue('./custom-templates');

      mockFs.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('Analyst.A.txt')) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue('Disk template: {{projectName}}');

      const result = engine.render(
        'Analyst',
        { projectName: 'DiskApp' },
        { variant: 'A' }
      );

      expect(result).toBe('Disk template: DiskApp');
    });

    it('should fall back to generic .txt when variant file is missing', () => {
      mockConfigObj.get.mockReturnValue('./custom-templates');

      mockFs.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.endsWith('Analyst.A.txt')) return false;
        if (typeof p === 'string' && p.endsWith('Analyst.txt')) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue('Generic disk: {{projectName}}');

      const result = engine.render(
        'Analyst',
        { projectName: 'GenericApp' },
        { variant: 'A' }
      );

      expect(result).toBe('Generic disk: GenericApp');
    });

    it('should fall back to built-in when disk template is missing', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = engine.render(
        'Analyst',
        { projectName: 'FallbackApp', mode: 'test' },
        { variant: 'A' }
      );

      expect(result).toContain('FallbackApp');
    });

    it('should use custom templatesDir from config', () => {
      mockConfigObj.get.mockReturnValue('./my-templates');

      mockFs.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('my-templates') && p.includes('Analyst.A.txt')) {
          return true;
        }
        return false;
      });
      mockFs.readFileSync.mockReturnValue('Custom dir: {{projectName}}');

      const result = engine.render(
        'Analyst',
        { projectName: 'CustomDir' },
        { variant: 'A' }
      );

      expect(result).toBe('Custom dir: CustomDir');
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('my-templates')
      );
    });
  });

  // ---------------------------------------------------------------
  // render - variant selection
  // ---------------------------------------------------------------
  describe('render variant selection', () => {
    it('should use explicit variant override from options', () => {
      const result = engine.render(
        'Analyst',
        { projectName: 'X', mode: 'Y' },
        { variant: 'B' }
      );

      // Should be variant B content
      expect(result).toContain('Business Analyst for X');
    });

    it('should pick a random variant when none specified', () => {
      // Run multiple times - should not throw regardless of random outcome
      for (let i = 0; i < 10; i++) {
        const result = engine.render('Analyst', { projectName: 'R', mode: 'M' });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  // ---------------------------------------------------------------
  // interpolate
  // ---------------------------------------------------------------
  describe('interpolate', () => {
    // Access private method via casting
    const callInterpolate = (eng: any, tpl: string, data: Record<string, any>) =>
      eng.interpolate(tpl, data);

    it('should replace {{var}} with data values', () => {
      const result = callInterpolate(engine, 'Hello {{name}}!', { name: 'World' });

      expect(result).toBe('Hello World!');
    });

    it('should replace missing vars with empty string', () => {
      const result = callInterpolate(engine, 'Hello {{name}} {{missing}}!', { name: 'World' });

      expect(result).toBe('Hello World !');
    });

    it('should handle multiple variables', () => {
      const result = callInterpolate(
        engine,
        '{{a}} + {{b}} = {{c}}',
        { a: '1', b: '2', c: '3' }
      );

      expect(result).toBe('1 + 2 = 3');
    });

    it('should handle whitespace around variable names', () => {
      const result = callInterpolate(engine, '{{ name }}', { name: 'padded' });

      expect(result).toBe('padded');
    });

    it('should convert non-string values to strings', () => {
      const result = callInterpolate(engine, 'Count: {{num}}', { num: 42 });

      expect(result).toBe('Count: 42');
    });
  });

  // ---------------------------------------------------------------
  // readDiskTemplate
  // ---------------------------------------------------------------
  describe('readDiskTemplate', () => {
    const callReadDiskTemplate = (eng: any, dir: string, name: string, variant: string) =>
      eng.readDiskTemplate(dir, name, variant);

    it('should return null when fs throws an error', () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = callReadDiskTemplate(engine, './templates', 'Analyst', 'A');

      expect(result).toBeNull();
      expect(log.debug).toHaveBeenCalled();
    });

    it('should return null when no disk template files exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = callReadDiskTemplate(engine, './templates', 'Missing', 'A');

      expect(result).toBeNull();
    });
  });
});
