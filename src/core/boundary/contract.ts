/**
 * Contract Loader - Agent Permission Management
 *
 * Loads and validates agent contracts from YAML configuration files.
 * Provides runtime access to agent permissions for BoundaryGuard.
 *
 * @see ADR-ARCH-004-boundary-driven-architecture.md Section 3
 * @module core/boundary/contract
 *
 * Note: This is a basic implementation. Codex may enhance this with
 * additional features like schema versioning and validation.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  AgentContract,
  AgentContractsConfig,
  IContractLoader,
} from './types';

/**
 * Simple YAML parser for agent contracts
 * Note: For production, consider using a proper YAML library
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  let currentKey = '';
  let currentObject: Record<string, unknown> = result;
  const stack: { obj: Record<string, unknown>; indent: number }[] = [];
  let currentIndent = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);
    const match = trimmed.match(/^([^:]+):\s*(.*)$/);

    if (!match) continue;

    const [, key, value] = match;

    if (indent < currentIndent && stack.length > 0) {
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        const popped = stack.pop();
        if (popped && stack.length > 0) {
          currentObject = stack[stack.length - 1].obj;
        } else {
          currentObject = result;
        }
      }
    }

    if (value) {
      // Handle arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        currentObject[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''));
      } else {
        currentObject[key] = value.replace(/^["']|["']$/g, '');
      }
    } else {
      // Nested object
      const newObj: Record<string, unknown> = {};
      currentObject[key] = newObj;
      stack.push({ obj: currentObject, indent: currentIndent });
      currentObject = newObj;
      currentKey = key;
      currentIndent = indent;
    }
  }

  return result;
}

/**
 * Contract Loader Implementation
 *
 * @example
 * ```typescript
 * const loader = new ContractLoader();
 * await loader.loadContracts('.specbmad/agent-contracts.yaml');
 *
 * const devContract = loader.getContract('Developer');
 * console.log(devContract?.allowed_tools); // ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash']
 * ```
 */
export class ContractLoader implements IContractLoader {
  private contracts: Map<string, AgentContract> = new Map();
  private loaded = false;
  private configPath = '';

  /**
   * Load agent contracts from a YAML file
   */
  async loadContracts(configPath: string): Promise<void> {
    this.configPath = configPath;

    try {
      const absolutePath = path.isAbsolute(configPath)
        ? configPath
        : path.join(process.cwd(), configPath);

      const content = await fs.readFile(absolutePath, 'utf-8');
      const config = this.parseConfig(content);

      this.contracts.clear();

      for (const [name, contractData] of Object.entries(config.agents)) {
        const contract: AgentContract = {
          name,
          scope: contractData.scope ?? { read: [], write: [], forbidden: [] },
          allowed_tools: contractData.allowed_tools ?? [],
          allowed_paths: contractData.allowed_paths ?? [],
          input_schema: contractData.input_schema ?? '',
          output_schema: contractData.output_schema ?? '',
          success_criteria: contractData.success_criteria,
        };

        if (this.validateContract(contract)) {
          this.contracts.set(name, contract);
        }
      }

      this.loaded = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File not found, use default contracts
        this.loadDefaultContracts();
      } else {
        throw error;
      }
    }
  }

  /**
   * Get contract for a specific agent
   */
  getContract(agentName: string): AgentContract | undefined {
    if (!this.loaded) {
      this.loadDefaultContracts();
    }
    return this.contracts.get(agentName);
  }

  /**
   * Validate a contract's structure
   */
  validateContract(contract: AgentContract): boolean {
    if (!contract.name || typeof contract.name !== 'string') {
      return false;
    }

    if (!Array.isArray(contract.allowed_tools)) {
      return false;
    }

    if (!Array.isArray(contract.allowed_paths)) {
      return false;
    }

    return true;
  }

  /**
   * Get all loaded contracts
   */
  getAllContracts(): ReadonlyMap<string, AgentContract> {
    if (!this.loaded) {
      this.loadDefaultContracts();
    }
    return this.contracts;
  }

  /**
   * Check if contracts are loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Parse YAML config content
   */
  private parseConfig(content: string): AgentContractsConfig {
    // Try to use simple YAML parser
    // For production, replace with a proper YAML library like js-yaml
    const parsed = parseSimpleYaml(content);

    return {
      $schema: (parsed.$schema as string) ?? '',
      version: (parsed.version as string) ?? '1.0.0',
      agents: (parsed.agents as Record<string, Omit<AgentContract, 'name'>>) ?? {},
    };
  }

  /**
   * Load default contracts when no config file exists
   */
  private loadDefaultContracts(): void {
    const defaultContracts: AgentContract[] = [
      {
        name: 'Analyst',
        scope: {
          read: ['intent.yaml', 'user_stories.md'],
          write: ['requirements.yaml', 'spec.md'],
          forbidden: ['架构设计', '代码编写', '测试执行'],
        },
        allowed_tools: ['Read', 'Glob', 'Grep', 'Write'],
        allowed_paths: ['./spec/**', './docs/**'],
        input_schema: 'IntentSpec',
        output_schema: 'RequirementsSpec',
      },
      {
        name: 'Architect',
        scope: {
          read: ['spec.md', 'requirements.yaml'],
          write: ['architecture.md', 'plan.yaml', 'traceability.yaml'],
          forbidden: ['需求分析', '代码编写', '测试执行'],
        },
        allowed_tools: ['Read', 'Glob', 'Grep', 'Write'],
        allowed_paths: ['./spec/**', './docs/**', './design/**'],
        input_schema: 'RequirementsSpec',
        output_schema: 'DesignSpec',
      },
      {
        name: 'Developer',
        scope: {
          read: ['architecture.md', 'plan.yaml'],
          write: ['src/**', 'tests/**'],
          forbidden: ['需求分析', '架构设计'],
        },
        allowed_tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'],
        allowed_paths: ['./src/**', './tests/**', './config/**'],
        input_schema: 'DesignSpec',
        output_schema: 'CodeArtifacts',
      },
      {
        name: 'QA',
        scope: {
          read: ['spec.md', 'src/**', 'tests/**'],
          write: ['review_report.md'],
          forbidden: ['需求分析', '架构设计', '代码编写'],
        },
        allowed_tools: ['Read', 'Glob', 'Grep', 'Write'],
        allowed_paths: ['./spec/**', './src/**', './tests/**', './docs/review/**'],
        input_schema: 'CodeArtifacts',
        output_schema: 'ReviewReport',
      },
      {
        name: 'SecurityExpert',
        scope: {
          read: ['src/**', 'tests/**', 'config/**', 'spec/**', 'docs/**'],
          write: ['docs/security/**', 'docs/review/**'],
          forbidden: ['需求分析', '架构设计', '代码编写'],
        },
        allowed_tools: ['Read', 'Glob', 'Grep', 'Write'],
        allowed_paths: ['./src/**', './tests/**', './config/**', './spec/**', './docs/**'],
        input_schema: 'CodeArtifacts',
        output_schema: 'SecurityReport',
      },
    ];

    for (const contract of defaultContracts) {
      this.contracts.set(contract.name, contract);
    }

    this.loaded = true;
  }
}

/**
 * Create a contract loader
 */
export function createContractLoader(): ContractLoader {
  return new ContractLoader();
}

/**
 * Create and initialize a contract loader with a config path
 */
export async function createContractLoaderWithConfig(
  configPath: string
): Promise<ContractLoader> {
  const loader = new ContractLoader();
  await loader.loadContracts(configPath);
  return loader;
}
