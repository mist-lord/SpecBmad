/**
 * SpecKit Integration Unit Tests
 *
 * Tests for the Spec-Kit module (Phase 0: Capture).
 * @see src/core/spec/spec-kit.ts
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import {
  createTempCoreDir,
  cleanupTempCoreDir,
  assertYamlFileValid,
  assertYamlFileContains,
  mockDateNow,
  restoreDateNow,
} from '../core-test-utils';

// Mock logger before importing the module
jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock getSpecPath to use temp directory
let tmpDir: string;
jest.mock('@/utils/paths', () => ({
  getSpecPath: jest.fn((file?: string) => {
    if (!tmpDir) tmpDir = createTempCoreDir('spec-kit-mock-');
    const specDir = path.join(tmpDir, 'spec');
    return file ? path.join(specDir, file) : specDir;
  }),
}));

// Import after mocks
import { SpecKitIntegration, specKit } from '@/core/spec/spec-kit';
import type { IntentSpec } from '@/core/spec/schema';

describe('SpecKitIntegration', () => {
  let integration: SpecKitIntegration;
  let testDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    integration = new SpecKitIntegration();
    testDir = createTempCoreDir('spec-kit-test-');

    // Mock Date for predictable timestamps
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    cleanupTempCoreDir(testDir);
    jest.useRealTimers(); // Restore real time
    jest.restoreAllMocks(); // Restore any spies
  });

  describe('execute()', () => {
    describe('single-line input', () => {
      it('should generate intent.yaml from single-line input', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const result = await integration.execute({
          input: 'Build a user authentication system',
          outputPath,
        });

        expect(result.success).toBe(true);
        expect(result.outputPath).toBe(outputPath);
        assertYamlFileValid(outputPath);
        assertYamlFileContains(outputPath, 'requirements.0.id', 'REQ-001');
        assertYamlFileContains(
          outputPath,
          'requirements.0.description',
          'Build a user authentication system'
        );
      });

      it('should assign high priority to single requirement', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Create REST API',
          outputPath,
        });

        assertYamlFileContains(outputPath, 'requirements.0.priority', 'high');
      });

      it('should return success status and intentSpec', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const result = await integration.execute({
          input: 'Test requirement',
          outputPath,
        });

        expect(result.success).toBe(true);
        expect(result.intentSpec).toBeDefined();
        expect(result.intentSpec?.title).toBe('Test requirement');
        expect(result.error).toBeUndefined();
      });
    });

    describe('multi-line input (sentence-separated)', () => {
      it('should generate multiple requirements from sentence-separated input', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const result = await integration.execute({
          input: '用户可以登录。系统记录审计日志。数据需要加密存储。',
          outputPath,
        });

        expect(result.success).toBe(true);
        assertYamlFileContains(outputPath, 'requirements.0.id', 'REQ-001');
        assertYamlFileContains(outputPath, 'requirements.1.id', 'REQ-002');
        assertYamlFileContains(outputPath, 'requirements.2.id', 'REQ-003');
      });

      it('should assign high priority to first, medium to rest (sentence-separated)', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'First requirement。Second requirement。Third requirement。',
          outputPath,
        });

        assertYamlFileContains(outputPath, 'requirements.0.priority', 'high');
        assertYamlFileContains(outputPath, 'requirements.1.priority', 'medium');
        assertYamlFileContains(outputPath, 'requirements.2.priority', 'medium');
      });
    });

    describe('multi-line input (newline-separated)', () => {
      it('should generate multiple requirements from newline-separated input', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const result = await integration.execute({
          input: 'User can login\nSystem logs audit trail\nData is encrypted',
          outputPath,
        });

        expect(result.success).toBe(true);
        assertYamlFileContains(outputPath, 'requirements.0.id', 'REQ-001');
        assertYamlFileContains(outputPath, 'requirements.1.id', 'REQ-002');
        assertYamlFileContains(outputPath, 'requirements.2.id', 'REQ-003');
      });

      it('should assign high priority to first, medium to rest (newline-separated)', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Line 1\nLine 2\nLine 3',
          outputPath,
        });

        assertYamlFileContains(outputPath, 'requirements.0.priority', 'high');
        assertYamlFileContains(outputPath, 'requirements.1.priority', 'medium');
        assertYamlFileContains(outputPath, 'requirements.2.priority', 'medium');
      });
    });

    describe('custom output path vs default path', () => {
      it('should use custom output path when provided', async () => {
        const customPath = path.join(testDir, 'custom', 'custom-intent.yaml');
        const result = await integration.execute({
          input: 'Custom path test',
          outputPath: customPath,
        });

        expect(result.success).toBe(true);
        expect(result.outputPath).toBe(customPath);
        expect(fs.existsSync(customPath)).toBe(true);
      });

      it('should use default path from getSpecPath when not provided', async () => {
        // Note: In actual runtime, this would use getSpecPath('intent.yaml')
        // but in test we control it via mock
        const result = await integration.execute({
          input: 'Default path test',
        });

        expect(result.success).toBe(true);
        expect(result.outputPath).toContain('intent.yaml');
      });
    });

    describe('directory creation when parent doesn\'t exist', () => {
      it('should create parent directories recursively', async () => {
        const deepPath = path.join(testDir, 'level1', 'level2', 'level3', 'intent.yaml');
        const result = await integration.execute({
          input: 'Deep directory test',
          outputPath: deepPath,
        });

        expect(result.success).toBe(true);
        expect(fs.existsSync(deepPath)).toBe(true);
        expect(fs.existsSync(path.join(testDir, 'level1', 'level2', 'level3'))).toBe(true);
      });
    });

    describe('YAML file validation', () => {
      it('should generate valid YAML structure', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'YAML validation test',
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content);

        expect(parsed).toHaveProperty('schema_version');
        expect(parsed).toHaveProperty('title');
        expect(parsed).toHaveProperty('description');
        expect(parsed).toHaveProperty('requirements');
        expect(parsed).toHaveProperty('metadata');
        expect(Array.isArray(parsed.requirements)).toBe(true);
      });

      it('should generate parseable YAML without errors', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Special chars: @#$% & "quotes"',
          outputPath,
        });

        expect(() => {
          const content = fs.readFileSync(outputPath, 'utf-8');
          yaml.parse(content);
        }).not.toThrow();
      });
    });

    describe('error handling', () => {
      it('should handle write failures gracefully', async () => {
        // Mock writeFileSync to throw an error
        const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
          throw new Error('EACCES: permission denied');
        });

        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const result = await integration.execute({
          input: 'Write failure test',
          outputPath,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('EACCES');
        expect(result.outputPath).toBe(outputPath);

        writeFileSpy.mockRestore();
      });

      it('should return error in result object on exception', async () => {
        // Mock yaml.stringify to throw an error during YAML generation
        const yamlStringifySpy = jest.spyOn(yaml, 'stringify').mockImplementation(() => {
          throw new Error('YAML serialization failed');
        });

        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const result = await integration.execute({
          input: 'Error handling test',
          outputPath,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('YAML serialization failed');

        // Restore original function
        yamlStringifySpy.mockRestore();
      });
    });
  });

  describe('parseRequirements()', () => {
    describe('empty string handling', () => {
      it('should generate single REQ-001 for empty string', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: '',
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.requirements).toHaveLength(1);
        expect(parsed.requirements[0].id).toBe('REQ-001');
        expect(parsed.requirements[0].description).toBe('');
        expect(parsed.requirements[0].priority).toBe('high');
      });
    });

    describe('single sentence handling', () => {
      it('should generate single REQ-001 for one sentence', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Single sentence requirement',
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.requirements).toHaveLength(1);
        expect(parsed.requirements[0].id).toBe('REQ-001');
        expect(parsed.requirements[0].description).toBe('Single sentence requirement');
      });
    });

    describe('multiple sentences (sentence-separated)', () => {
      it('should generate sequential REQ-IDs for sentence-separated input', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'First。Second。Third。Fourth。Fifth。',
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.requirements).toHaveLength(5);
        expect(parsed.requirements[0].id).toBe('REQ-001');
        expect(parsed.requirements[1].id).toBe('REQ-002');
        expect(parsed.requirements[2].id).toBe('REQ-003');
        expect(parsed.requirements[3].id).toBe('REQ-004');
        expect(parsed.requirements[4].id).toBe('REQ-005');
      });
    });

    describe('multiple lines (newline-separated)', () => {
      it('should generate multiple REQs for newline-separated input', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Line A\nLine B\nLine C',
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.requirements).toHaveLength(3);
        expect(parsed.requirements[0].description).toBe('Line A');
        expect(parsed.requirements[1].description).toBe('Line B');
        expect(parsed.requirements[2].description).toBe('Line C');
      });
    });

    describe('REQ-ID sequential numbering', () => {
      it('should pad single-digit IDs with leading zeros (REQ-001 to REQ-009)', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const input = Array.from({ length: 9 }, (_, i) => `Req ${i + 1}`).join('。');
        await integration.execute({
          input,
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.requirements).toHaveLength(9);
        expect(parsed.requirements[0].id).toBe('REQ-001');
        expect(parsed.requirements[8].id).toBe('REQ-009');
      });

      it('should handle two-digit IDs correctly (REQ-010)', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const input = Array.from({ length: 10 }, (_, i) => `Req ${i + 1}`).join('。');
        await integration.execute({
          input,
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.requirements).toHaveLength(10);
        expect(parsed.requirements[9].id).toBe('REQ-010');
      });

      it('should handle three-digit IDs correctly (REQ-100)', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const input = Array.from({ length: 100 }, (_, i) => `Req ${i + 1}`).join('。');
        await integration.execute({
          input,
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.requirements).toHaveLength(100);
        expect(parsed.requirements[99].id).toBe('REQ-100');
      });
    });

    describe('priority assignment', () => {
      it('should assign high to first req, medium to rest', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'A。B。C。D。E。',
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.requirements[0].priority).toBe('high');
        expect(parsed.requirements[1].priority).toBe('medium');
        expect(parsed.requirements[2].priority).toBe('medium');
        expect(parsed.requirements[3].priority).toBe('medium');
        expect(parsed.requirements[4].priority).toBe('medium');
      });
    });

    describe('whitespace handling', () => {
      it('should trim whitespace from requirements', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: '  Leading spaces。Trailing spaces  。  Both  。',
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.requirements[0].description).toBe('Leading spaces');
        expect(parsed.requirements[1].description).toBe('Trailing spaces');
        expect(parsed.requirements[2].description).toBe('Both');
      });

      it('should filter out empty lines', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Line 1\n\n\nLine 2\n\n',
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.requirements).toHaveLength(2);
        expect(parsed.requirements[0].description).toBe('Line 1');
        expect(parsed.requirements[1].description).toBe('Line 2');
      });
    });

    describe('special characters in text', () => {
      it('should handle special characters correctly', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const specialInput = 'API: /users/{id}。Query: SELECT * FROM users。Config: {env: "prod"}。';
        await integration.execute({
          input: specialInput,
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.requirements).toHaveLength(3);
        expect(parsed.requirements[0].description).toContain('/users/{id}');
        expect(parsed.requirements[1].description).toContain('SELECT * FROM users');
        expect(parsed.requirements[2].description).toContain('{env: "prod"}');
      });
    });
  });

  describe('extractTitle()', () => {
    describe('short input (<50 chars)', () => {
      it('should use full input as title for short text', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const shortInput = 'Build a simple web app';
        await integration.execute({
          input: shortInput,
          outputPath,
        });

        assertYamlFileContains(outputPath, 'title', shortInput);
      });
    });

    describe('long input (>50 chars)', () => {
      it('should truncate long input to 50 chars with "..."', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const longInput =
          'This is a very long requirement that exceeds fifty characters and should be truncated';
        await integration.execute({
          input: longInput,
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.title.length).toBe(50); // 47 chars + '...'
        expect(parsed.title).toBe(longInput.substring(0, 47) + '...');
      });
    });

    describe('exactly 50 chars', () => {
      it('should not truncate input of exactly 50 chars', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const exactInput = '12345678901234567890123456789012345678901234567890'; // Exactly 50
        await integration.execute({
          input: exactInput,
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.title).toBe(exactInput);
        expect(parsed.title.length).toBe(50);
        expect(parsed.title).not.toContain('...');
      });
    });

    describe('multi-line input', () => {
      it('should use first sentence for multi-line input', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'First sentence。Second sentence。Third sentence。',
          outputPath,
        });

        assertYamlFileContains(outputPath, 'title', 'First sentence');
      });

      it('should use first line for newline-separated input', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'First line\nSecond line\nThird line',
          outputPath,
        });

        assertYamlFileContains(outputPath, 'title', 'First line');
      });
    });

    describe('empty input', () => {
      it('should fallback to "需求规格" for empty input', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: '',
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        // With empty input, title uses the fallback '需求规格'
        expect(parsed.title).toBe('需求规格');
      });
    });

    describe('newline at end', () => {
      it('should trim trailing newlines', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Title with trailing newline\n',
          outputPath,
        });

        assertYamlFileContains(outputPath, 'title', 'Title with trailing newline');
      });
    });
  });

  describe('YAML output validation', () => {
    describe('schema_version', () => {
      it('should always set schema_version to 1', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Schema version test',
          outputPath,
        });

        assertYamlFileContains(outputPath, 'schema_version', 1);
      });
    });

    describe('title field', () => {
      it('should populate title field correctly', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Test Title',
          outputPath,
        });

        assertYamlFileContains(outputPath, 'title', 'Test Title');
      });
    });

    describe('description field', () => {
      it('should contain full input in description', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        const fullInput = 'This is the full description。With multiple parts。';
        await integration.execute({
          input: fullInput,
          outputPath,
        });

        assertYamlFileContains(outputPath, 'description', fullInput);
      });
    });

    describe('requirements array structure', () => {
      it('should create proper requirements array structure', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Req A。Req B。',
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(Array.isArray(parsed.requirements)).toBe(true);
        expect(parsed.requirements).toHaveLength(2);
        expect(parsed.requirements[0]).toHaveProperty('id');
        expect(parsed.requirements[0]).toHaveProperty('description');
        expect(parsed.requirements[0]).toHaveProperty('priority');
      });
    });

    describe('metadata.generated_by', () => {
      it('should set metadata.generated_by to "spec-kit"', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Metadata test',
          outputPath,
        });

        assertYamlFileContains(outputPath, 'metadata.generated_by', 'spec-kit');
      });
    });

    describe('metadata.timestamp', () => {
      it('should set metadata.timestamp in ISO format', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Timestamp test',
          outputPath,
        });

        const content = fs.readFileSync(outputPath, 'utf-8');
        const parsed = yaml.parse(content) as IntentSpec;

        expect(parsed.metadata?.timestamp).toBe('2009-02-13T23:31:30.000Z');
      });
    });

    describe('metadata.phase', () => {
      it('should set metadata.phase to 0', async () => {
        const outputPath = path.join(testDir, 'spec', 'intent.yaml');
        await integration.execute({
          input: 'Phase test',
          outputPath,
        });

        assertYamlFileContains(outputPath, 'metadata.phase', 0);
      });
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance as "specKit"', () => {
      expect(specKit).toBeInstanceOf(SpecKitIntegration);
    });

    it('should use the singleton instance consistently', () => {
      const firstRef = specKit;
      const secondRef = specKit;
      expect(firstRef).toBe(secondRef);
    });
  });
});
