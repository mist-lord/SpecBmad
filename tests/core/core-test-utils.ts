/**
 * Core Module Test Utilities
 *
 * Shared utilities for testing core modules (llm, phase, spec)
 * Extends patterns from command-test-utils.ts and plugin-test-utils.ts
 *
 * @see tests/commands/command-test-utils.ts - Command mocks
 * @see tests/plugins/plugin-test-utils.ts - Real file system patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { PhaseTransitionConfig } from '@/core/phase/types';
import type { IntentSpec } from '@/core/spec/schema';
import type { LLMOptions } from '@/types';

// ====================
// File System Utilities
// ====================

/**
 * Create a temporary test directory for core module tests
 * @param prefix Directory name prefix
 * @returns Absolute path to the created temp directory
 */
export function createTempCoreDir(prefix: string = 'core-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Clean up a temporary directory
 * @param dirPath Path to directory to remove
 */
export function cleanupTempCoreDir(dirPath: string): void {
  if (dirPath && fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

// ====================
// Environment Variable Mocking
// ====================

let originalEnv: NodeJS.ProcessEnv;

/**
 * Mock environment variables for testing
 * @param vars Record of env var key-value pairs
 */
export function mockEnvVars(vars: Record<string, string>): void {
  originalEnv = { ...process.env };
  Object.entries(vars).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

/**
 * Restore original environment variables
 */
export function restoreEnvVars(): void {
  if (originalEnv) {
    process.env = originalEnv;
  }
}

// ====================
// Time Mocking
// ====================

let originalDateNow: () => number;

/**
 * Mock Date.now() for predictable timestamps
 * @param timestamp Fixed timestamp to return
 */
export function mockDateNow(timestamp: number): void {
  originalDateNow = Date.now;
  Date.now = jest.fn(() => timestamp);
}

/**
 * Restore original Date.now()
 */
export function restoreDateNow(): void {
  if (originalDateNow) {
    Date.now = originalDateNow;
  }
}

// ====================
// Crypto Mocking
// ====================

/**
 * Mock crypto for predictable hash generation
 */
export function mockCrypto() {
  const mockHash = {
    update: jest.fn().mockReturnThis(),
    digest: jest.fn((encoding: string) => 'mock-hash-' + encoding),
  };

  return {
    createHash: jest.fn(() => mockHash),
  };
}

// ====================
// Config Manager Mocking
// ====================

export interface MockConfigManager {
  load: jest.Mock;
  get: jest.Mock;
  getProjectConfig: jest.Mock;
}

/**
 * Create a mock ConfigManager
 * @param config Partial config data to return
 */
export function mockConfigManager(config?: Partial<any>): MockConfigManager {
  const defaultConfig = {
    llmCacheEnabled: true,
    llmCacheTTLSeconds: 3600,
    llmConcurrencyLimit: 4,
    spec_kit: {
      ai_agent: 'Claude',
    },
    agents: {},
  };

  const mergedConfig = { ...defaultConfig, ...config };

  return {
    load: jest.fn().mockResolvedValue(undefined),
    get: jest.fn((key: string) => {
      const keys = key.split('.');
      let value: any = mergedConfig;
      for (const k of keys) {
        value = value?.[k];
      }
      return value;
    }),
    getProjectConfig: jest.fn(() => mergedConfig),
  };
}

// ====================
// LLM Client Factory Mocking
// ====================

export interface MockLLMClientFactory {
  register: jest.Mock;
  get: jest.Mock;
  getAll: jest.Mock;
  getAvailable: jest.Mock;
  getByType: jest.Mock;
  hasClient: jest.Mock;
  clear: jest.Mock;
}

/**
 * Create a mock LLMClientFactory
 */
export function mockLLMClientFactory(): MockLLMClientFactory {
  const clients = new Map<string, any>();

  return {
    register: jest.fn((client: any) => {
      clients.set(client.name, client);
    }),
    get: jest.fn((name: string) => clients.get(name)),
    getAll: jest.fn(() => Array.from(clients.values())),
    getAvailable: jest.fn(async () =>
      Array.from(clients.values()).filter((c) => c.isAvailable?.() !== false)
    ),
    getByType: jest.fn((type: string) =>
      Array.from(clients.values()).filter((c) => c.type === type)
    ),
    hasClient: jest.fn((name: string) => clients.has(name)),
    clear: jest.fn(() => clients.clear()),
  };
}

// ====================
// Gate Registry Mocking
// ====================

export interface MockGateRegistry {
  register: jest.Mock;
  get: jest.Mock;
  checkGates: jest.Mock;
}

/**
 * Create a mock GateRegistry
 */
export function mockGateRegistry(): MockGateRegistry {
  const gates = new Map<string, any>();

  return {
    register: jest.fn((gateId: string, checker: any) => {
      gates.set(gateId, checker);
    }),
    get: jest.fn((gateId: string) => gates.get(gateId)),
    checkGates: jest.fn(async (gateIds: string[], context: any) => {
      const results = [];
      for (const gateId of gateIds) {
        const checker = gates.get(gateId);
        if (checker) {
          const result = await checker.checkGate(context);
          results.push({ gateId, ...result });
        }
      }
      return results;
    }),
  };
}

// ====================
// Circuit Breaker Mocking
// ====================

export interface MockCircuitBreaker {
  recordSuccess: jest.Mock;
  recordFailure: jest.Mock;
  isOpen: jest.Mock;
  reset: jest.Mock;
  getState: jest.Mock;
}

/**
 * Create a mock CircuitBreaker
 */
export function mockCircuitBreaker(): MockCircuitBreaker {
  let state: 'closed' | 'open' | 'half-open' = 'closed';

  const mock = {
    recordSuccess: jest.fn(() => {
      if (state === 'half-open') state = 'closed';
    }),
    recordFailure: jest.fn(() => {
      state = 'open';
    }),
    isOpen: jest.fn(() => state === 'open'),
    reset: jest.fn(() => {
      state = 'closed';
    }),
    getState: jest.fn(() => state),
  };

  // Allow forcing state for testing
  (mock as any).forceState = (newState: 'closed' | 'open' | 'half-open') => {
    state = newState;
  };

  return mock;
}

// ====================
// Event Store Mocking
// ====================

export interface MockEventStore {
  appendEvent: jest.Mock;
  getEvents: jest.Mock;
  getEventsByType: jest.Mock;
}

/**
 * Create a mock EventStore
 */
export function mockEventStore(): MockEventStore {
  const events: any[] = [];

  return {
    appendEvent: jest.fn((event: any) => {
      events.push({
        ...event,
        timestamp: event.timestamp || Date.now(),
      });
    }),
    getEvents: jest.fn(() => events),
    getEventsByType: jest.fn((type: string) =>
      events.filter((e) => e.type === type)
    ),
  };
}

// ====================
// Phase Config File Creation
// ====================

/**
 * Create a phase_transitions.yaml config file in temp directory
 * @param dir Temporary directory path
 * @param config Optional custom phase config (uses default 0→1→2→3 if not provided)
 */
export function createPhaseConfigFile(
  dir: string,
  config?: PhaseTransitionConfig
): void {
  const defaultConfig: PhaseTransitionConfig = {
    phases: {
      0: { next: [1], gates: [] },
      1: { next: [2], gates: [] },
      2: { next: [3], gates: ['review_passed'] },
      3: { next: [], gates: [] },
    },
  };

  const configToUse = config || defaultConfig;
  const configPath = path.join(dir, 'spec', 'phase_transitions.yaml');

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, yaml.stringify(configToUse), 'utf-8');
}

/**
 * Create a review_report.md file for ReviewGateChecker testing
 * @param dir Temporary directory path (project root)
 * @param passed Whether the review should pass
 */
export function createReviewReportFile(dir: string, passed: boolean): void {
  const reportPath = path.join(dir, '.specbmad', 'artifacts', 'review_report.md');

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });

  const content = passed
    ? `# Review Report\n\nStatus: **PASSED** ✅\n\nAll checks passed.`
    : `# Review Report\n\nStatus: **FAILED** ❌\n\nIssues found.`;

  fs.writeFileSync(reportPath, content, 'utf-8');
}

// ====================
// Spec File Creation
// ====================

/**
 * Create an intent.yaml spec file in temp directory
 * @param dir Temporary directory path
 * @param spec IntentSpec to write
 */
export function createIntentSpecFile(dir: string, spec: IntentSpec): void {
  const specPath = path.join(dir, 'spec', 'intent.yaml');

  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(specPath, yaml.stringify(spec), 'utf-8');
}

// ====================
// Assertion Helpers
// ====================

/**
 * Assert that a YAML file exists and is valid
 * @param filePath Path to YAML file
 */
export function assertYamlFileValid(filePath: string): void {
  expect(fs.existsSync(filePath)).toBe(true);

  const content = fs.readFileSync(filePath, 'utf-8');
  expect(() => yaml.parse(content)).not.toThrow();
}

/**
 * Assert that a YAML file contains a specific key-value pair
 * @param filePath Path to YAML file
 * @param key Dot-notation key (e.g., 'metadata.phase')
 * @param value Expected value
 */
export function assertYamlFileContains(
  filePath: string,
  key: string,
  value: any
): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.parse(content);

  const keys = key.split('.');
  let actualValue: any = parsed;
  for (const k of keys) {
    actualValue = actualValue?.[k];
  }

  expect(actualValue).toEqual(value);
}

/**
 * Assert that a function throws an ArchitectureViolation error
 * @param fn Function to execute
 */
export function assertThrowsArchitectureViolation(fn: () => void): void {
  expect(fn).toThrow();
  try {
    fn();
  } catch (error: any) {
    expect(error.name).toBe('ArchitectureViolation');
  }
}

/**
 * Assert that a cache file exists in the cache directory
 * @param cacheDir Cache directory path
 */
export function assertCacheFileExists(cacheDir: string): void {
  const cacheFile = path.join(cacheDir, 'llm-cache.json');
  expect(fs.existsSync(cacheFile)).toBe(true);
}

/**
 * Assert that a phase state file exists and has the expected phase
 * @param stateFile Path to .specbmad/phase.state.json
 * @param expectedPhase Expected current phase
 */
export function assertPhaseStateFile(
  stateFile: string,
  expectedPhase: number
): void {
  expect(fs.existsSync(stateFile)).toBe(true);

  const content = fs.readFileSync(stateFile, 'utf-8');
  const state = JSON.parse(content);

  expect(state.currentPhase).toBe(expectedPhase);
}

// ====================
// Test Fixtures
// ====================

export const coreTestFixtures = {
  /**
   * Valid LLM options for testing
   */
  validLLMOptions: {
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 4000,
  } as LLMOptions,

  /**
   * Valid phase check context
   */
  validPhaseContext: {
    projectRoot: '/tmp/test-project',
    phase: 0,
    metadata: {},
  },

  /**
   * Valid IntentSpec fixture
   */
  validIntentSpec: {
    schema_version: 1,
    title: 'Test Specification',
    description: 'A test specification for unit testing',
    requirements: [
      {
        id: 'REQ-001',
        description: 'System should do something',
        priority: 'high',
      },
    ],
    metadata: {
      generated_by: 'spec-kit',
      timestamp: '2026-02-13T00:00:00Z',
      phase: 0,
    },
  } as IntentSpec,

  /**
   * Valid cache record
   */
  validCacheRecord: {
    response: 'Mock LLM response',
    timestamp: Date.now(),
  },

  /**
   * Valid gate result
   */
  validGateResult: {
    gateId: 'test_gate',
    passed: true,
    blocking: false,
    message: 'Gate passed',
  },
};
