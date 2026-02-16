/**
 * SpecProtection Unit Tests
 *
 * Tests for the Spec Protection module (Architecture Violation detection).
 * @see src/core/spec/protection.ts
 */

import fs from 'fs';
import path from 'path';
import {
  createTempCoreDir,
  cleanupTempCoreDir,
  assertThrowsArchitectureViolation,
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

// Mock getSpecPath - will be updated per test
const mockGetSpecPath = jest.fn();
jest.mock('@/utils/paths', () => ({
  getSpecPath: mockGetSpecPath,
}));

// Import after mocks
import { SpecProtection, ArchitectureViolation, specProtection } from '@/core/spec/protection';

describe('SpecProtection', () => {
  let protection: SpecProtection;
  let testDir: string;
  let specDir: string;
  let nonSpecDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    testDir = createTempCoreDir('protection-test-');
    specDir = path.join(testDir, 'spec');
    nonSpecDir = path.join(testDir, 'src');

    // Create test directories
    fs.mkdirSync(specDir, { recursive: true });
    fs.mkdirSync(nonSpecDir, { recursive: true });

    // Update mock to return correct spec directory for this test
    mockGetSpecPath.mockImplementation((file?: string) => {
      return file ? path.join(specDir, file) : specDir;
    });

    protection = new SpecProtection(testDir);
  });

  afterEach(() => {
    cleanupTempCoreDir(testDir);
  });

  describe('ArchitectureViolation', () => {
    it('should create error with correct name', () => {
      const error = new ArchitectureViolation('Test violation');
      expect(error.name).toBe('ArchitectureViolation');
    });

    it('should create error with prefixed message', () => {
      const error = new ArchitectureViolation('Test violation');
      expect(error.message).toBe('Architecture Violation: Test violation');
    });

    it('should be instance of Error', () => {
      const error = new ArchitectureViolation('Test violation');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('isSpecPath()', () => {
    describe('paths inside /spec/', () => {
      it('should return true for file inside /spec/', () => {
        const specFilePath = path.join(specDir, 'intent.yaml');
        const isSpec = (protection as any).isSpecPath(specFilePath);
        expect(isSpec).toBe(true);
      });

      it('should return true for file inside /spec/subdir/', () => {
        const specSubdirPath = path.join(specDir, 'subdir', 'file.yaml');
        const isSpec = (protection as any).isSpecPath(specSubdirPath);
        expect(isSpec).toBe(true);
      });

      it('should return true for /spec/ directory itself', () => {
        const isSpec = (protection as any).isSpecPath(specDir);
        expect(isSpec).toBe(true);
      });
    });

    describe('paths outside /spec/', () => {
      it('should return false for path outside /spec/', () => {
        const srcFilePath = path.join(nonSpecDir, 'index.ts');
        const isSpec = (protection as any).isSpecPath(srcFilePath);
        expect(isSpec).toBe(false);
      });

      it('should return false for path in /src/', () => {
        const srcPath = path.join(testDir, 'src', 'main.ts');
        const isSpec = (protection as any).isSpecPath(srcPath);
        expect(isSpec).toBe(false);
      });

      it('should return false for path in project root', () => {
        const rootPath = path.join(testDir, 'README.md');
        const isSpec = (protection as any).isSpecPath(rootPath);
        expect(isSpec).toBe(false);
      });
    });

    describe('absolute path handling', () => {
      it('should handle absolute path inside spec', () => {
        const absoluteSpecPath = path.resolve(specDir, 'intent.yaml');
        const isSpec = (protection as any).isSpecPath(absoluteSpecPath);
        expect(isSpec).toBe(true);
      });

      it('should handle absolute path outside spec', () => {
        const absoluteNonSpecPath = path.resolve(nonSpecDir, 'main.ts');
        const isSpec = (protection as any).isSpecPath(absoluteNonSpecPath);
        expect(isSpec).toBe(false);
      });
    });

    describe('relative path handling', () => {
      it('should resolve relative path inside spec correctly', () => {
        const relativePath = path.join(specDir, '..', 'spec', 'intent.yaml');
        const isSpec = (protection as any).isSpecPath(relativePath);
        expect(isSpec).toBe(true);
      });

      it('should resolve relative path outside spec correctly', () => {
        const relativePath = path.join(specDir, '..', 'src', 'main.ts');
        const isSpec = (protection as any).isSpecPath(relativePath);
        expect(isSpec).toBe(false);
      });
    });

    describe('path with ../ that resolves outside spec', () => {
      it('should return false for path escaping spec via ../', () => {
        // Start inside spec but navigate out
        const escapingPath = path.join(specDir, '..', '..', 'etc', 'passwd');
        const isSpec = (protection as any).isSpecPath(escapingPath);
        expect(isSpec).toBe(false);
      });
    });

    describe('path with ../ that resolves inside spec', () => {
      it('should return true for path staying inside spec via ../', () => {
        const subdir = path.join(specDir, 'subdir');
        fs.mkdirSync(subdir, { recursive: true });

        // Navigate up but stay inside spec
        const stayingPath = path.join(subdir, '..', 'intent.yaml');
        const isSpec = (protection as any).isSpecPath(stayingPath);
        expect(isSpec).toBe(true);
      });
    });

    describe('trailing slash handling', () => {
      it('should handle trailing slash on spec directory', () => {
        const specDirWithSlash = specDir + path.sep;
        const isSpec = (protection as any).isSpecPath(specDirWithSlash);
        expect(isSpec).toBe(true);
      });

      it('should handle trailing slash on non-spec directory', () => {
        const nonSpecDirWithSlash = nonSpecDir + path.sep;
        const isSpec = (protection as any).isSpecPath(nonSpecDirWithSlash);
        expect(isSpec).toBe(false);
      });
    });
  });

  describe('checkWritePermission()', () => {
    describe('non-spec paths', () => {
      it('should allow write to non-spec path (no throw)', () => {
        const nonSpecPath = path.join(nonSpecDir, 'test.ts');
        expect(() => {
          protection.checkWritePermission(nonSpecPath);
        }).not.toThrow();
      });

      it('should allow write to project root file', () => {
        const rootFile = path.join(testDir, 'package.json');
        expect(() => {
          protection.checkWritePermission(rootFile);
        }).not.toThrow();
      });
    });

    describe('spec paths', () => {
      it('should throw ArchitectureViolation for spec path', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        assertThrowsArchitectureViolation(() => {
          protection.checkWritePermission(specPath);
        });
      });

      it('should throw with correct error name', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        expect(() => {
          protection.checkWritePermission(specPath);
        }).toThrow(ArchitectureViolation);
      });
    });

    describe('error message includes file path', () => {
      it('should include file path in error message', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        expect(() => {
          protection.checkWritePermission(specPath);
        }).toThrow();

        // Verify error message contains path
        try {
          protection.checkWritePermission(specPath);
        } catch (error: any) {
          expect(error.message).toContain(specPath);
        }
      });
    });

    describe('error message includes operation type', () => {
      it('should mention "修改" (modify) in error message', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        expect(() => {
          protection.checkWritePermission(specPath);
        }).toThrow();

        try {
          protection.checkWritePermission(specPath);
        } catch (error: any) {
          expect(error.message).toContain('修改');
        }
      });
    });

    describe('caller information', () => {
      it('should include caller info when provided', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        expect(() => {
          protection.checkWritePermission(specPath, 'TestCaller');
        }).toThrow();

        try {
          protection.checkWritePermission(specPath, 'TestCaller');
        } catch (error: any) {
          expect(error.message).toContain('TestCaller');
        }
      });
    });
  });

  describe('checkDeletePermission()', () => {
    describe('non-spec paths', () => {
      it('should allow delete from non-spec path (no throw)', () => {
        const nonSpecPath = path.join(nonSpecDir, 'test.ts');
        expect(() => {
          protection.checkDeletePermission(nonSpecPath);
        }).not.toThrow();
      });
    });

    describe('spec paths', () => {
      it('should throw ArchitectureViolation for spec path', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        assertThrowsArchitectureViolation(() => {
          protection.checkDeletePermission(specPath);
        });
      });
    });

    describe('error message includes file path', () => {
      it('should include file path in error message', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        expect(() => {
          protection.checkDeletePermission(specPath);
        }).toThrow();

        try {
          protection.checkDeletePermission(specPath);
        } catch (error: any) {
          expect(error.message).toContain(specPath);
        }
      });
    });

    describe('error message mentions "delete"', () => {
      it('should mention "删除" (delete) in error message', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        expect(() => {
          protection.checkDeletePermission(specPath);
        }).toThrow();

        try {
          protection.checkDeletePermission(specPath);
        } catch (error: any) {
          expect(error.message).toContain('删除');
        }
      });
    });

    describe('caller information', () => {
      it('should include caller info when provided', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        expect(() => {
          protection.checkDeletePermission(specPath, 'TestDeleter');
        }).toThrow();

        try {
          protection.checkDeletePermission(specPath, 'TestDeleter');
        } catch (error: any) {
          expect(error.message).toContain('TestDeleter');
        }
      });
    });
  });

  describe('protectedWriteFileSync()', () => {
    describe('non-spec paths', () => {
      it('should call fs.writeFileSync for non-spec path', () => {
        const nonSpecPath = path.join(nonSpecDir, 'test.ts');
        protection.protectedWriteFileSync(nonSpecPath, 'test content');

        expect(fs.existsSync(nonSpecPath)).toBe(true);
        const content = fs.readFileSync(nonSpecPath, 'utf-8');
        expect(content).toBe('test content');
      });

      it('should pass parameters correctly to fs.writeFileSync', () => {
        const nonSpecPath = path.join(nonSpecDir, 'data.txt');
        const testData = 'important data';
        protection.protectedWriteFileSync(nonSpecPath, testData);

        const written = fs.readFileSync(nonSpecPath, 'utf-8');
        expect(written).toBe(testData);
      });
    });

    describe('spec paths', () => {
      it('should throw ArchitectureViolation for spec path', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        assertThrowsArchitectureViolation(() => {
          protection.protectedWriteFileSync(specPath, 'forbidden content');
        });
      });

      it('should not write file when spec path is blocked', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        expect(() => {
          protection.protectedWriteFileSync(specPath, 'forbidden content');
        }).toThrow();

        expect(fs.existsSync(specPath)).toBe(false);
      });
    });

    describe('caller tracking', () => {
      it('should pass caller info to checkWritePermission', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        expect(() => {
          protection.protectedWriteFileSync(specPath, 'content', 'WriteCaller');
        }).toThrow();

        try {
          protection.protectedWriteFileSync(specPath, 'content', 'WriteCaller');
        } catch (error: any) {
          expect(error.message).toContain('WriteCaller');
        }
      });
    });
  });

  describe('protectedUnlinkSync()', () => {
    describe('non-spec paths', () => {
      it('should call fs.unlinkSync for non-spec path', () => {
        const nonSpecPath = path.join(nonSpecDir, 'temp.txt');
        fs.writeFileSync(nonSpecPath, 'temporary');

        protection.protectedUnlinkSync(nonSpecPath);

        expect(fs.existsSync(nonSpecPath)).toBe(false);
      });

      it('should pass parameters correctly to fs.unlinkSync', () => {
        const nonSpecPath = path.join(nonSpecDir, 'delete-me.txt');
        fs.writeFileSync(nonSpecPath, 'delete this');

        expect(fs.existsSync(nonSpecPath)).toBe(true);
        protection.protectedUnlinkSync(nonSpecPath);
        expect(fs.existsSync(nonSpecPath)).toBe(false);
      });
    });

    describe('spec paths', () => {
      it('should throw ArchitectureViolation for spec path', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        fs.writeFileSync(specPath, 'protected');

        assertThrowsArchitectureViolation(() => {
          protection.protectedUnlinkSync(specPath);
        });
      });

      it('should not delete file when spec path is blocked', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        fs.writeFileSync(specPath, 'must remain');

        expect(() => {
          protection.protectedUnlinkSync(specPath);
        }).toThrow();

        expect(fs.existsSync(specPath)).toBe(true);
      });
    });

    describe('caller tracking', () => {
      it('should pass caller info to checkDeletePermission', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        fs.writeFileSync(specPath, 'protected');

        expect(() => {
          protection.protectedUnlinkSync(specPath, 'DeleteCaller');
        }).toThrow();

        try {
          protection.protectedUnlinkSync(specPath, 'DeleteCaller');
        } catch (error: any) {
          expect(error.message).toContain('DeleteCaller');
        }
      });
    });
  });

  describe('canRead()', () => {
    describe('spec paths', () => {
      it('should return true for spec path', () => {
        const specPath = path.join(specDir, 'intent.yaml');
        const canRead = protection.canRead(specPath);
        expect(canRead).toBe(true);
      });

      it('should return true for nested spec path', () => {
        const nestedSpecPath = path.join(specDir, 'subdir', 'file.yaml');
        const canRead = protection.canRead(nestedSpecPath);
        expect(canRead).toBe(true);
      });
    });

    describe('non-spec paths', () => {
      it('should return false for non-spec path', () => {
        const nonSpecPath = path.join(nonSpecDir, 'main.ts');
        const canRead = protection.canRead(nonSpecPath);
        expect(canRead).toBe(false);
      });

      it('should return false for project root file', () => {
        const rootFile = path.join(testDir, 'README.md');
        const canRead = protection.canRead(rootFile);
        expect(canRead).toBe(false);
      });
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance as "specProtection"', () => {
      expect(specProtection).toBeInstanceOf(SpecProtection);
    });

    it('should use the singleton instance consistently', () => {
      const firstRef = specProtection;
      const secondRef = specProtection;
      expect(firstRef).toBe(secondRef);
    });
  });

  describe('constructor', () => {
    it('should use process.cwd() when no projectRoot provided', () => {
      const defaultProtection = new SpecProtection();
      expect(defaultProtection).toBeInstanceOf(SpecProtection);
    });

    it('should accept custom projectRoot', () => {
      const customProtection = new SpecProtection('/custom/root');
      expect(customProtection).toBeInstanceOf(SpecProtection);
    });
  });
});
