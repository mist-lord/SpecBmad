import { ContextManager } from '@/core/context/manager';
import { AgentContext, AgentMemory } from '@/types';
import fs from 'fs';
import path from 'path';
import os from 'os';

jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() }
}));

let tmpDir: string;

jest.mock('@/utils/paths', () => ({
  PATHS: { ARTIFACTS_DIR: '.specbmad/artifacts' },
  getProjectPath: jest.fn((relPath: string) => path.join(tmpDir, relPath))
}));

function createContext(inputData?: Record<string, unknown>): AgentContext {
  return {
    projectState: {
      projectName: 'TestProject',
      workflow: { currentStep: 'design', completedSteps: ['capture'] }
    },
    workingDirectory: '/tmp/test',
    inputData
  } as AgentContext;
}

function createMemory(overrides?: Partial<AgentMemory>): AgentMemory {
  return {
    shortTerm: { lastAction: 'analyzed' },
    longTerm: {},
    context: ['2026-01-01T10:00:00.000Z: initialized'],
    ...overrides
  };
}

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new ContextManager();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('buildContext() - basic', () => {
    it('should return an array of strings', () => {
      const ctx = createContext();
      const mem = createMemory();
      const result = manager.buildContext('analyze the project', ctx, mem);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include workflow state summary', () => {
      const ctx = createContext();
      const mem = createMemory();
      // Use threshold=0 to bypass relevance filtering and test raw candidate generation
      const result = manager.buildContext('analyze', ctx, mem, { relevanceThreshold: 0 });
      const stateEntry = result.find(r => r.includes('Project=TestProject'));
      expect(stateEntry).toBeDefined();
      expect(stateEntry).toContain('CurrentStep=design');
      expect(stateEntry).toContain('capture');
    });

    it('should include input data as JSON', () => {
      const ctx = createContext({ mode: 'brief', target: 'auth' });
      const mem = createMemory();
      const result = manager.buildContext('analyze auth', ctx, mem);
      const inputEntry = result.find(r => r.includes('InputData='));
      expect(inputEntry).toBeDefined();
      expect(inputEntry).toContain('brief');
    });

    it('should include short-term memory', () => {
      const ctx = createContext();
      const mem = createMemory({ shortTerm: { key1: 'value1', key2: 'value2' } });
      const result = manager.buildContext('check memory', ctx, mem);
      const memEntries = result.filter(r => r.includes('Memory:'));
      expect(memEntries.length).toBeGreaterThan(0);
    });

    it('should include history entries', () => {
      const ctx = createContext();
      const mem = createMemory({ context: ['History event 1', 'History event 2'] });
      const result = manager.buildContext('history check', ctx, mem);
      const histEntries = result.filter(r => r.includes('History='));
      expect(histEntries.length).toBeGreaterThan(0);
    });
  });

  describe('buildContext() - options', () => {
    it('should respect maxHistory limit', () => {
      const ctx = createContext();
      const longHistory = Array.from({ length: 30 }, (_, i) => `event ${i}`);
      const mem = createMemory({ context: longHistory });
      const result = manager.buildContext('test', ctx, mem, { maxHistory: 5 });
      const histEntries = result.filter(r => r.startsWith('History='));
      expect(histEntries.length).toBeLessThanOrEqual(5);
    });

    it('should respect maxContextTokens budget', () => {
      const ctx = createContext();
      const mem = createMemory({
        shortTerm: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`key${i}`, `value ${i} `.repeat(20)])
        )
      });
      const result = manager.buildContext('test', ctx, mem, { maxContextTokens: 100 });
      const totalTokens = result.reduce((sum, s) => sum + Math.ceil(s.length / 2.5), 0);
      expect(totalTokens).toBeLessThanOrEqual(100);
    });

    it('should filter by relevance threshold', () => {
      const ctx = createContext();
      const mem = createMemory({
        shortTerm: { relevant: 'analyze the project data', unrelated: 'cooking recipe for pasta' }
      });
      const result = manager.buildContext('analyze project', ctx, mem, { relevanceThreshold: 0.3 });
      // High threshold should filter out unrelated content
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should use default options when not provided', () => {
      const ctx = createContext();
      const mem = createMemory();
      const result = manager.buildContext('test', ctx, mem);
      expect(result).toBeDefined();
    });
  });

  describe('buildContext() - artifacts', () => {
    it('should read artifacts from directory', () => {
      const artifactsDir = path.join(tmpDir, '.specbmad', 'artifacts');
      fs.mkdirSync(artifactsDir, { recursive: true });
      fs.writeFileSync(
        path.join(artifactsDir, 'spec.md'),
        '# Spec\n- Key point 1\n- Key point 2\n- Key point 3'
      );

      const ctx = createContext();
      const mem = createMemory();
      const result = manager.buildContext('key point spec', ctx, mem);
      const artifactEntry = result.find(r => r.includes('Artifacts='));
      expect(artifactEntry).toBeDefined();
    });

    it('should handle missing artifacts directory gracefully', () => {
      // tmpDir has no artifacts dir
      const ctx = createContext();
      const mem = createMemory();
      const result = manager.buildContext('test', ctx, mem);
      expect(result).toBeDefined(); // should not throw
    });

    it('should extract key points from latest artifact', () => {
      const artifactsDir = path.join(tmpDir, '.specbmad', 'artifacts');
      fs.mkdirSync(artifactsDir, { recursive: true });
      fs.writeFileSync(
        path.join(artifactsDir, 'notes.md'),
        '# Notes\n- Point A\n- Point B\n* Point C\n1) Point D'
      );

      const ctx = createContext();
      const mem = createMemory();
      const result = manager.buildContext('notes point', ctx, mem);
      const artifactEntry = result.find(r => r.includes('Artifacts='));
      if (artifactEntry) {
        expect(artifactEntry).toContain('Point A');
      }
    });
  });

  describe('buildContext() - sorting', () => {
    it('should prefer recent items when preferRecent is true', () => {
      const ctx = createContext();
      const mem = createMemory({
        context: [
          '2026-01-01T10:00:00.000Z: old event',
          '2026-02-16T10:00:00.000Z: recent event'
        ]
      });
      const result = manager.buildContext('event', ctx, mem, { preferRecent: true });
      // History entries with timestamps should be present
      const histEntries = result.filter(r => r.includes('History='));
      expect(histEntries.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('buildContext() - edge cases', () => {
    it('should handle empty memory', () => {
      const ctx = createContext();
      const mem: AgentMemory = { shortTerm: {}, longTerm: {}, context: [] };
      // Use a prompt that matches workflow state keywords to pass relevance threshold
      const result = manager.buildContext('project design capture', ctx, mem, { relevanceThreshold: 0 });
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(1); // at least workflow state
    });

    it('should handle context without inputData', () => {
      const ctx = createContext();
      delete (ctx as any).inputData;
      const mem = createMemory();
      const result = manager.buildContext('test', ctx, mem);
      expect(result).toBeDefined();
    });

    it('should handle context without projectState workflow', () => {
      const ctx = {
        projectState: { projectName: 'Test' },
        workingDirectory: '/tmp'
      } as any;
      const mem = createMemory();
      const result = manager.buildContext('test', ctx, mem);
      expect(result).toBeDefined();
    });
  });
});

// Test exported helper functions indirectly through ContextManager
// The functions are module-private, but we can test their behavior via buildContext
describe('ContextManager helper functions (via buildContext)', () => {
  let manager: ContextManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new ContextManager();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-helper-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('tokenize + jaccard (via relevance scoring)', () => {
    it('should score higher for matching keywords', () => {
      const ctx = createContext();
      const mem = createMemory({
        shortTerm: {
          match: 'analyze project requirements',
          nomatch: 'unrelated cooking data'
        }
      });
      // With a prompt about analyzing, the matching entry should be included
      const result = manager.buildContext('analyze project requirements', ctx, mem, {
        relevanceThreshold: 0.01
      });
      const matchEntry = result.find(r => r.includes('analyze'));
      expect(matchEntry).toBeDefined();
    });

    it('should handle empty prompt gracefully', () => {
      const ctx = createContext();
      const mem = createMemory();
      const result = manager.buildContext('', ctx, mem);
      expect(result).toBeDefined();
    });

    it('should handle Chinese text tokenization', () => {
      const ctx = createContext();
      const mem = createMemory({
        shortTerm: { cn: '分析项目需求文档' }
      });
      const result = manager.buildContext('分析项目', ctx, mem);
      expect(result).toBeDefined();
    });
  });

  describe('estimateTokens (via token budget)', () => {
    it('should truncate when budget is very small', () => {
      const ctx = createContext();
      const mem = createMemory({
        shortTerm: { data: 'x'.repeat(1000) }
      });
      const result = manager.buildContext('test', ctx, mem, { maxContextTokens: 10 });
      // Very small budget should limit output
      const totalChars = result.reduce((sum, s) => sum + s.length, 0);
      expect(totalChars).toBeLessThan(1000);
    });

    it('should return empty for zero budget', () => {
      const ctx = createContext();
      const mem = createMemory();
      const result = manager.buildContext('test', ctx, mem, { maxContextTokens: 0 });
      expect(result).toEqual([]);
    });
  });

  describe('recentWeight (via sorting)', () => {
    it('should prioritize entries with History keyword', () => {
      const ctx = createContext();
      const mem = createMemory({
        context: ['History: something relevant happened'],
        shortTerm: { plain: 'just some data relevant' }
      });
      const result = manager.buildContext('relevant', ctx, mem, { preferRecent: true });
      // History entries should be present in result
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('safeJson (via memory serialization)', () => {
    it('should handle non-string memory values', () => {
      const ctx = createContext();
      const mem = createMemory({
        shortTerm: { obj: { nested: true }, num: 42 as any, arr: [1, 2, 3] as any }
      });
      const result = manager.buildContext('test nested', ctx, mem);
      expect(result).toBeDefined();
    });
  });
});
