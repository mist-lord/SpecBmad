/**
 * Generator Tests
 *
 * Tests for src/generator/index.ts covering:
 * - generateByStack main entry point (manifest path, plugin paths, legacy mappings, fallback)
 * - applyManifest with interpolation and custom vars
 * - toPkgName sanitization
 * - loadManifest error handling
 * - interpolate template processing
 */

import fs from 'fs'
import path from 'path'
import { stackManager } from '@/core/stack'
import { generateByStack, GeneratorOptions } from '@/generator'

jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
}))

jest.mock('@/core/stack', () => ({
  stackManager: {
    getPlugin: jest.fn(),
  },
}))

const mockFs = fs as jest.Mocked<typeof fs>
const mockGetPlugin = stackManager.getPlugin as jest.Mock

function createOpts(overrides?: Partial<GeneratorOptions>): GeneratorOptions {
  return {
    stack: 'typescript',
    projectDir: '/tmp/test-project',
    projectName: 'test-project',
    dryRun: false,
    ...overrides,
  }
}

function createMockPlugin() {
  return { generateSkeleton: jest.fn().mockResolvedValue(undefined) }
}

function makeManifest(files: Array<{ path: string; content: string }>) {
  return JSON.stringify({ files })
}

describe('Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: readFileSync throws so loadManifest returns null
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
  })

  // ---------------------------------------------------------------
  // generateByStack - manifest path
  // ---------------------------------------------------------------
  describe('generateByStack with manifest', () => {
    it('should apply manifest when loadManifest finds a valid manifest file', async () => {
      const manifest = makeManifest([
        { path: 'src/index.ts', content: 'console.log("hello")' },
      ])
      mockFs.readFileSync.mockReturnValue(manifest)

      const opts = createOpts({ stack: 'react' })
      await generateByStack(opts)

      // Should have called readFileSync for manifest
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining(path.join('templates', 'react', 'manifest.json')),
        'utf-8'
      )
      // Should have written the file from manifest
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join('/tmp/test-project', 'src/index.ts'),
        'console.log("hello")',
        'utf-8'
      )
      // Should NOT have consulted plugins
      expect(mockGetPlugin).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------
  // generateByStack - direct plugin match
  // ---------------------------------------------------------------
  describe('generateByStack with direct plugin match', () => {
    it('should call plugin.generateSkeleton when no manifest but plugin exists', async () => {
      const plugin = createMockPlugin()
      mockGetPlugin.mockImplementation((name: string) =>
        name === 'golang' ? plugin : null
      )

      const opts = createOpts({ stack: 'golang' })
      await generateByStack(opts)

      expect(mockGetPlugin).toHaveBeenCalledWith('golang')
      expect(plugin.generateSkeleton).toHaveBeenCalledWith(opts)
    })
  })

  // ---------------------------------------------------------------
  // generateByStack - legacy stack name mappings
  // ---------------------------------------------------------------
  describe('generateByStack legacy stack mappings', () => {
    it('should map ts-app to typescript plugin', async () => {
      const tsPlugin = createMockPlugin()
      mockGetPlugin.mockImplementation((name: string) =>
        name === 'typescript' ? tsPlugin : null
      )

      const opts = createOpts({ stack: 'ts-app' })
      await generateByStack(opts)

      expect(mockGetPlugin).toHaveBeenCalledWith('ts-app')
      expect(mockGetPlugin).toHaveBeenCalledWith('typescript')
      expect(tsPlugin.generateSkeleton).toHaveBeenCalledWith(opts)
    })

    it('should map py-lib to python plugin', async () => {
      const pyPlugin = createMockPlugin()
      mockGetPlugin.mockImplementation((name: string) =>
        name === 'python' ? pyPlugin : null
      )

      const opts = createOpts({ stack: 'py-lib' })
      await generateByStack(opts)

      expect(mockGetPlugin).toHaveBeenCalledWith('py-lib')
      expect(mockGetPlugin).toHaveBeenCalledWith('python')
      expect(pyPlugin.generateSkeleton).toHaveBeenCalledWith(opts)
    })

    it('should map cpp-cli to cpp plugin', async () => {
      const cppPlugin = createMockPlugin()
      mockGetPlugin.mockImplementation((name: string) =>
        name === 'cpp' ? cppPlugin : null
      )

      const opts = createOpts({ stack: 'cpp-cli' })
      await generateByStack(opts)

      expect(mockGetPlugin).toHaveBeenCalledWith('cpp-cli')
      expect(mockGetPlugin).toHaveBeenCalledWith('cpp')
      expect(cppPlugin.generateSkeleton).toHaveBeenCalledWith(opts)
    })

    it('should map cpp-app to cpp plugin', async () => {
      const cppPlugin = createMockPlugin()
      mockGetPlugin.mockImplementation((name: string) =>
        name === 'cpp' ? cppPlugin : null
      )

      const opts = createOpts({ stack: 'cpp-app' })
      await generateByStack(opts)

      expect(mockGetPlugin).toHaveBeenCalledWith('cpp-app')
      expect(mockGetPlugin).toHaveBeenCalledWith('cpp')
      expect(cppPlugin.generateSkeleton).toHaveBeenCalledWith(opts)
    })
  })

  // ---------------------------------------------------------------
  // generateByStack - default fallback
  // ---------------------------------------------------------------
  describe('generateByStack default fallback', () => {
    it('should fall back to typescript plugin for unknown stack', async () => {
      const tsPlugin = createMockPlugin()
      // Return null for the unknown stack, then tsPlugin for 'typescript'
      mockGetPlugin.mockImplementation((name: string) =>
        name === 'typescript' ? tsPlugin : null
      )

      const opts = createOpts({ stack: 'unknown-stack' })
      await generateByStack(opts)

      expect(mockGetPlugin).toHaveBeenCalledWith('unknown-stack')
      expect(mockGetPlugin).toHaveBeenCalledWith('typescript')
      expect(tsPlugin.generateSkeleton).toHaveBeenCalledWith(opts)
    })
  })

  // ---------------------------------------------------------------
  // generateByStack - dryRun
  // ---------------------------------------------------------------
  describe('generateByStack with dryRun', () => {
    it('should not create project directory when dryRun is true', async () => {
      const plugin = createMockPlugin()
      mockGetPlugin.mockReturnValue(plugin)

      const opts = createOpts({ dryRun: true })
      await generateByStack(opts)

      // mkdirSync should NOT be called for the project directory
      // (it may still be called from writeFile/ensureDir inside plugin, but not from generateByStack)
      const mkdirCalls = mockFs.mkdirSync.mock.calls
      const projectDirCalls = mkdirCalls.filter(
        (call) => call[0] === '/tmp/test-project'
      )
      expect(projectDirCalls).toHaveLength(0)
    })

    it('should not write files when dryRun is true with manifest', async () => {
      const manifest = makeManifest([
        { path: 'README.md', content: '# {{ projectName }}' },
      ])
      mockFs.readFileSync.mockReturnValue(manifest)

      const opts = createOpts({ dryRun: true })
      await generateByStack(opts)

      expect(mockFs.writeFileSync).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------
  // applyManifest - interpolation
  // ---------------------------------------------------------------
  describe('applyManifest interpolation', () => {
    it('should interpolate projectName and packageName in manifest files', async () => {
      const manifest = makeManifest([
        {
          path: '{{ projectName }}/package.json',
          content: '{"name": "{{ packageName }}"}',
        },
      ])
      mockFs.readFileSync.mockReturnValue(manifest)

      const opts = createOpts({ projectName: 'my-cool-app' })
      await generateByStack(opts)

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join('/tmp/test-project', 'my-cool-app/package.json'),
        '{"name": "my_cool_app"}',
        'utf-8'
      )
    })

    it('should merge custom vars with default vars', async () => {
      const manifest = makeManifest([
        { path: 'config.json', content: '{"author": "{{ author }}", "name": "{{ projectName }}"}' },
      ])
      mockFs.readFileSync.mockReturnValue(manifest)

      const opts = createOpts({
        projectName: 'demo',
        vars: { author: 'Alice' },
      })
      await generateByStack(opts)

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join('/tmp/test-project', 'config.json'),
        '{"author": "Alice", "name": "demo"}',
        'utf-8'
      )
    })
  })

  // ---------------------------------------------------------------
  // toPkgName (tested indirectly via applyManifest)
  // ---------------------------------------------------------------
  describe('toPkgName sanitization', () => {
    it('should sanitize special characters from project name for packageName', async () => {
      const manifest = makeManifest([
        { path: 'pkg.json', content: '{{ packageName }}' },
      ])
      mockFs.readFileSync.mockReturnValue(manifest)

      const opts = createOpts({ projectName: '@scope/my--awesome--lib!' })
      await generateByStack(opts)

      // toPkgName: removes non-alphanumeric/underscore/hyphen chars, collapses hyphens to underscore
      // '@scope/my--awesome--lib!' -> 'scopemy--awesome--lib' -> 'scopemy_awesome_lib'
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        'scopemy_awesome_lib',
        'utf-8'
      )
    })
  })

  // ---------------------------------------------------------------
  // loadManifest error handling
  // ---------------------------------------------------------------
  describe('loadManifest error handling', () => {
    it('should return null and proceed to plugin path when readFileSync throws', async () => {
      // readFileSync already throws by default in beforeEach
      const plugin = createMockPlugin()
      mockGetPlugin.mockReturnValue(plugin)

      const opts = createOpts({ stack: 'node' })
      await generateByStack(opts)

      // loadManifest returned null, so it fell through to plugin
      expect(plugin.generateSkeleton).toHaveBeenCalledWith(opts)
    })
  })

  // ---------------------------------------------------------------
  // interpolate edge cases
  // ---------------------------------------------------------------
  describe('interpolate', () => {
    it('should handle whitespace inside delimiters', async () => {
      const manifest = makeManifest([
        { path: 'file.txt', content: '{{  projectName  }}' },
      ])
      mockFs.readFileSync.mockReturnValue(manifest)

      const opts = createOpts({ projectName: 'spaced' })
      await generateByStack(opts)

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        'spaced',
        'utf-8'
      )
    })

    it('should replace missing vars with empty string', async () => {
      const manifest = makeManifest([
        { path: 'file.txt', content: 'Hello {{ unknownVar }}!' },
      ])
      mockFs.readFileSync.mockReturnValue(manifest)

      const opts = createOpts()
      await generateByStack(opts)

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        'Hello !',
        'utf-8'
      )
    })
  })

  // ---------------------------------------------------------------
  // ensureDir called for project directory
  // ---------------------------------------------------------------
  describe('ensureDir', () => {
    it('should create project directory with recursive option when not dryRun', async () => {
      const plugin = createMockPlugin()
      mockGetPlugin.mockReturnValue(plugin)

      const opts = createOpts({ dryRun: false })
      await generateByStack(opts)

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/tmp/test-project', {
        recursive: true,
      })
    })
  })
})
