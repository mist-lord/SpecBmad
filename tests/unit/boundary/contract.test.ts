/**
 * Contract Loader Unit Tests
 *
 * Tests loading and validation of agent permission contracts.
 * @see ADR-ARCH-004-boundary-driven-architecture.md Section 3
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import {
  ContractLoader,
  createContractLoader,
  createContractLoaderWithConfig,
} from '@/core/boundary/contract';
import { AgentContract } from '@/core/boundary/types';

describe('ContractLoader', () => {
  let loader: ContractLoader;
  const testConfigPath = path.join(process.cwd(), '.specbmad', 'agent-contracts.yaml');

  beforeEach(() => {
    loader = new ContractLoader();
  });

  describe('Default Contracts', () => {
    it('should load default contracts when getContract called without loading', () => {
      const developerContract = loader.getContract('Developer');

      expect(developerContract).toBeDefined();
      expect(developerContract?.name).toBe('Developer');
      expect(developerContract?.allowed_tools).toContain('Bash');
    });

    it('should have all four default agents', () => {
      const agents = ['Analyst', 'Architect', 'Developer', 'QA'];

      for (const agent of agents) {
        const contract = loader.getContract(agent);
        expect(contract).toBeDefined();
        expect(contract?.name).toBe(agent);
      }
    });

    it('should return undefined for unknown agent', () => {
      const contract = loader.getContract('UnknownAgent');

      expect(contract).toBeUndefined();
    });
  });

  describe('Contract Validation', () => {
    it('should validate contract with all required fields', () => {
      const validContract: AgentContract = {
        name: 'TestAgent',
        scope: { read: [], write: [], forbidden: [] },
        allowed_tools: ['Read'],
        allowed_paths: ['src/**'],
        input_schema: 'TestInput',
        output_schema: 'TestOutput',
      };

      expect(loader.validateContract(validContract)).toBe(true);
    });

    it('should reject contract without name', () => {
      const invalidContract = {
        scope: { read: [], write: [], forbidden: [] },
        allowed_tools: ['Read'],
        allowed_paths: ['src/**'],
        input_schema: 'TestInput',
        output_schema: 'TestOutput',
      } as unknown as AgentContract;

      expect(loader.validateContract(invalidContract)).toBe(false);
    });

    it('should reject contract with invalid allowed_tools', () => {
      const invalidContract = {
        name: 'TestAgent',
        scope: { read: [], write: [], forbidden: [] },
        allowed_tools: 'not-an-array',
        allowed_paths: ['src/**'],
        input_schema: 'TestInput',
        output_schema: 'TestOutput',
      } as unknown as AgentContract;

      expect(loader.validateContract(invalidContract)).toBe(false);
    });

    it('should reject contract with invalid allowed_paths', () => {
      const invalidContract = {
        name: 'TestAgent',
        scope: { read: [], write: [], forbidden: [] },
        allowed_tools: ['Read'],
        allowed_paths: 'not-an-array',
        input_schema: 'TestInput',
        output_schema: 'TestOutput',
      } as unknown as AgentContract;

      expect(loader.validateContract(invalidContract)).toBe(false);
    });
  });

  describe('getAllContracts', () => {
    it('should return all loaded contracts', () => {
      const contracts = loader.getAllContracts();

      expect(contracts.size).toBeGreaterThan(0);
      expect(contracts.has('Developer')).toBe(true);
      expect(contracts.has('Analyst')).toBe(true);
    });
  });

  describe('isLoaded', () => {
    it('should return false initially', () => {
      const freshLoader = new ContractLoader();
      // Access internal state - contracts are loaded on first getContract call
      expect(freshLoader.isLoaded()).toBe(false);
    });

    it('should return true after getContract triggers default loading', () => {
      loader.getContract('Developer');
      expect(loader.isLoaded()).toBe(true);
    });
  });

  describe('loadContracts from YAML', () => {
    const tempConfigPath = path.join(process.cwd(), 'tests', 'fixtures', 'test-contracts.yaml');

    beforeAll(async () => {
      // Create test fixtures directory
      await fs.mkdir(path.dirname(tempConfigPath), { recursive: true });

      // Create test YAML file
      const yamlContent = `$schema: "https://specbmad.dev/schemas/agent-contracts/v1.0.0"
version: "1.0.0"

agents:
  TestAgent:
    allowed_tools: [Read, Write]
    allowed_paths: [test/**]
    input_schema: TestInput
    output_schema: TestOutput
`;
      await fs.writeFile(tempConfigPath, yamlContent);
    });

    afterAll(async () => {
      // Clean up test file
      try {
        await fs.unlink(tempConfigPath);
        await fs.rmdir(path.dirname(tempConfigPath));
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should load contracts from file when it exists', async () => {
      // Check if the real config file exists
      try {
        await fs.access(testConfigPath);
        await loader.loadContracts(testConfigPath);
        expect(loader.isLoaded()).toBe(true);
      } catch {
        // Config file doesn't exist, use default contracts
        loader.getContract('Developer');
        expect(loader.isLoaded()).toBe(true);
      }
    });

    it('should fall back to defaults when file not found', async () => {
      await loader.loadContracts('/non/existent/path.yaml');

      expect(loader.isLoaded()).toBe(true);
      expect(loader.getContract('Developer')).toBeDefined();
    });

    it('should get config path', async () => {
      await loader.loadContracts(testConfigPath);
      expect(loader.getConfigPath()).toBe(testConfigPath);
    });
  });

  describe('Default Contract Details', () => {
    it('should have correct Analyst contract', () => {
      const analyst = loader.getContract('Analyst');

      expect(analyst?.allowed_tools).toEqual(['Read', 'Glob', 'Grep', 'Write']);
      expect(analyst?.allowed_paths).toContain('./spec/**');
      expect(analyst?.allowed_paths).toContain('./docs/**');
      expect(analyst?.scope.forbidden).toContain('架构设计');
    });

    it('should have correct Developer contract', () => {
      const developer = loader.getContract('Developer');

      expect(developer?.allowed_tools).toContain('Bash');
      expect(developer?.allowed_tools).toContain('Edit');
      expect(developer?.allowed_paths).toContain('./src/**');
      expect(developer?.allowed_paths).toContain('./tests/**');
    });

    it('should have correct QA contract', () => {
      const qa = loader.getContract('QA');

      expect(qa?.allowed_tools).not.toContain('Bash');
      expect(qa?.allowed_tools).not.toContain('Edit');
      expect(qa?.scope.forbidden).toContain('代码编写');
    });

    it('should have correct SecurityExpert contract (ARCH-001)', () => {
      const securityExpert = loader.getContract('SecurityExpert');

      // SecurityExpert should be defined
      expect(securityExpert).toBeDefined();
      expect(securityExpert?.name).toBe('SecurityExpert');

      // Should have read-only access (no Bash, no Edit)
      expect(securityExpert?.allowed_tools).toContain('Read');
      expect(securityExpert?.allowed_tools).toContain('Glob');
      expect(securityExpert?.allowed_tools).toContain('Grep');
      expect(securityExpert?.allowed_tools).toContain('Write');
      expect(securityExpert?.allowed_tools).not.toContain('Bash');
      expect(securityExpert?.allowed_tools).not.toContain('Edit');

      // Should have access to source, tests, and docs for review
      expect(securityExpert?.allowed_paths).toContain('./src/**');
      expect(securityExpert?.allowed_paths).toContain('./tests/**');
      expect(securityExpert?.allowed_paths).toContain('./docs/**');
      expect(securityExpert?.allowed_paths).toContain('./spec/**');

      // Should be forbidden from writing code
      expect(securityExpert?.scope.forbidden).toContain('代码编写');
    });
  });

  describe('SecurityExpert Contract Integration', () => {
    it('should have all five default agents including SecurityExpert', () => {
      const agents = ['Analyst', 'Architect', 'Developer', 'QA', 'SecurityExpert'];

      for (const agent of agents) {
        const contract = loader.getContract(agent);
        expect(contract).toBeDefined();
        expect(contract?.name).toBe(agent);
      }
    });

    it('should allow SecurityExpert to read security-sensitive files', () => {
      const securityExpert = loader.getContract('SecurityExpert');

      // Verify paths include all areas a security expert needs to review
      const criticalPaths = ['./src/**', './tests/**', './config/**'];
      for (const criticalPath of criticalPaths) {
        expect(securityExpert?.allowed_paths).toContain(criticalPath);
      }
    });

    it('should have SecurityExpert output schema as SecurityReport', () => {
      const securityExpert = loader.getContract('SecurityExpert');

      expect(securityExpert?.output_schema).toBe('SecurityReport');
    });
  });
});

describe('Factory Functions', () => {
  it('should create contract loader with createContractLoader', () => {
    const loader = createContractLoader();

    expect(loader).toBeInstanceOf(ContractLoader);
  });

  it('should create and initialize loader with createContractLoaderWithConfig', async () => {
    // This will fall back to defaults since file may not exist
    const loader = await createContractLoaderWithConfig('.specbmad/agent-contracts.yaml');

    expect(loader).toBeInstanceOf(ContractLoader);
    expect(loader.isLoaded()).toBe(true);
  });
});
