/**
 * Tool Parameter Validator for BoundaryGuard
 *
 * Validates tool parameters against agent contracts, checking:
 * - Tool allowlist
 * - Path permissions
 * - Directory traversal attacks
 * - Spec protection
 * - Command injection (for Bash)
 *
 * @see ADR-ARCH-004-boundary-driven-architecture.md v2.1 Change 4
 * @module core/boundary/tool-validator
 */

import * as path from 'path';
import {
  AgentContract,
  IToolValidator,
  Permission,
  ToolCall,
  TOOL_PARAM_SCHEMAS,
  ToolName,
  ParamType,
  DEFAULT_BOUNDARY_GUARD_CONFIG,
} from './types';

/**
 * Dangerous patterns that may indicate command injection
 * @see Codex security review - HIGH finding: strengthen Bash validation
 */
const DANGEROUS_COMMAND_PATTERNS = [
  // Destructive commands
  /\brm\s+-rf\s/i, // rm -rf anywhere
  /\brm\s+-r\s/i, // rm -r anywhere
  /\brmdir\s/i, // rmdir
  /\bdel\s+\/[sf]/i, // del with force flags (Windows)
  /\bformat\s/i, // format command

  // Command chaining/injection
  /;\s*rm\s/i, // rm after semicolon
  /;\s*del\s/i, // del after semicolon
  /\|\s*rm\s/i, // rm after pipe
  /`.*`/, // backtick command substitution
  /\$\(.*\)/, // $() command substitution
  /\$\{.*\}/, // ${} variable expansion with commands

  // Dangerous redirects
  />\s*\/dev\//, // redirect to /dev/
  />\s*\/etc\//, // redirect to /etc/
  />\s*\/proc\//, // redirect to /proc/
  />\s*\/sys\//, // redirect to /sys/
  />\s*~\//, // redirect to home directory

  // Permission/ownership changes
  /;\s*chmod\s+[0-7]*7/i, // chmod with world-writable
  /\bchown\s/i, // chown
  /\bchgrp\s/i, // chgrp
  /\bsudo\s/i, // sudo
  /\bsu\s+-/i, // su -
  /\bdoas\s/i, // doas

  // Network/download execution
  /;\s*curl\s.*\|\s*sh/i, // curl | sh pattern
  /;\s*wget\s.*\|\s*sh/i, // wget | sh pattern
  /\bcurl\s.*\|\s*(ba)?sh/i, // curl | bash
  /\bwget\s.*\|\s*(ba)?sh/i, // wget | bash
  /\bpython\s+-c\s/i, // python -c
  /\bperl\s+-e\s/i, // perl -e
  /\bruby\s+-e\s/i, // ruby -e
  /\bnode\s+-e\s/i, // node -e

  // System destruction
  /&&\s*rm\s+-rf\s+\//i, // rm -rf / pattern
  /;\s*:\s*\(\)\s*\{/, // fork bomb pattern
  /\bdd\s+if=.*of=\/dev\//i, // dd to device
  /\bmkfs\./i, // mkfs
  /\bfdisk\s/i, // fdisk
  /\bparted\s/i, // parted

  // Credential/key access
  /\bcat\s+.*\.ssh\//i, // cat .ssh files
  /\bcat\s+.*\.gnupg\//i, // cat gnupg files
  /\bcat\s+.*\/etc\/shadow/i, // cat shadow
  /\bcat\s+.*\/etc\/passwd/i, // cat passwd (less dangerous but suspicious)

  // Environment manipulation
  /\bexport\s+PATH=/i, // export PATH
  /\bexport\s+LD_/i, // export LD_* (library injection)
  /\bunset\s+PATH/i, // unset PATH
];

/**
 * Tool Validator Implementation
 *
 * @example
 * ```typescript
 * const validator = new ToolValidator();
 * const contract = await loader.getContract('Developer');
 *
 * const permission = await validator.validateToolCall(
 *   { toolName: 'Write', toolInput: { file_path: 'src/index.ts' }, agentName: 'Developer' },
 *   contract
 * );
 *
 * if (!permission.allowed) {
 *   console.error(`Blocked: ${permission.reason}`);
 * }
 * ```
 */
export class ToolValidator implements IToolValidator {
  private readonly specProtectedPaths: readonly string[];

  constructor(specProtectedPaths?: readonly string[]) {
    this.specProtectedPaths =
      specProtectedPaths ?? DEFAULT_BOUNDARY_GUARD_CONFIG.specProtectedPaths;
  }

  /**
   * Validate a tool call against an agent's contract
   */
  async validateToolCall(
    toolCall: ToolCall,
    contract: AgentContract
  ): Promise<Permission> {
    const { toolName, toolInput } = toolCall;

    // 1. Check if tool is in allowed list
    if (!this.isToolAllowed(toolName, contract)) {
      return {
        allowed: false,
        reason: 'tool-not-allowed',
        details: {
          tool: toolName,
          allowedTools: contract.allowed_tools,
        },
      };
    }

    // 2. Get tool parameter schema - FAIL-CLOSED: reject unknown tools
    const schema = TOOL_PARAM_SCHEMAS[toolName as ToolName];
    if (!schema) {
      // Fail-closed: reject unknown tools without explicit schema
      // This prevents bypassing validation with unregistered tools
      return {
        allowed: false,
        reason: 'tool-not-allowed',
        details: {
          tool: toolName,
          reason: 'Unknown tool without registered schema (fail-closed)',
        },
      };
    }

    // 3. Validate each parameter based on its type
    for (const [paramName, paramType] of Object.entries(schema)) {
      const paramValue = toolInput[paramName];
      if (paramValue === undefined || paramValue === null) {
        continue; // Optional parameter
      }

      const validation = this.validateParameter(
        paramName,
        paramValue,
        paramType as ParamType,
        contract,
        toolName
      );

      if (!validation.allowed) {
        return validation;
      }
    }

    return { allowed: true, reason: 'allowed' };
  }

  /**
   * Check if a tool is in the contract's allowed list
   */
  isToolAllowed(toolName: string, contract: AgentContract): boolean {
    return contract.allowed_tools.includes(toolName);
  }

  /**
   * Check if a path is allowed by the contract
   */
  isPathAllowed(filePath: string, allowedPaths: readonly string[]): boolean {
    const normalizedPath = this.normalizePath(filePath);

    return allowedPaths.some((allowedPattern) => {
      const normalizedPattern = this.normalizePath(allowedPattern);

      // Handle glob patterns
      if (normalizedPattern.endsWith('**')) {
        const baseDir = normalizedPattern.slice(0, -2);
        return normalizedPath.startsWith(baseDir);
      }

      if (normalizedPattern.endsWith('*')) {
        const baseDir = normalizedPattern.slice(0, -1);
        return normalizedPath.startsWith(baseDir);
      }

      // Exact match or directory prefix
      return (
        normalizedPath === normalizedPattern ||
        normalizedPath.startsWith(normalizedPattern + '/')
      );
    });
  }

  /**
   * Detect directory traversal attempts
   */
  hasPathTraversal(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);

    // Check for path traversal patterns
    const traversalPatterns = [
      /\.\.[/\\]/, // ../
      /[/\\]\.\./, // /..
      /%2e%2e/i, // URL encoded ..
      /%252e/i, // Double URL encoded .
    ];

    for (const pattern of traversalPatterns) {
      if (pattern.test(filePath)) {
        return true;
      }
    }

    // Check if normalized path escapes current directory
    if (normalizedPath.startsWith('..')) {
      return true;
    }

    // Check for absolute paths that might escape sandbox
    if (
      path.isAbsolute(normalizedPath) &&
      !normalizedPath.startsWith(process.cwd())
    ) {
      // Allow absolute paths within project directory
      return false;
    }

    return false;
  }

  /**
   * Check if a path is spec-protected
   */
  isSpecProtected(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);

    return this.specProtectedPaths.some((specPath) => {
      const normalizedSpecPath = this.normalizePath(specPath);
      return (
        normalizedPath.startsWith(normalizedSpecPath) ||
        normalizedPath === normalizedSpecPath.slice(0, -1) // Handle trailing slash
      );
    });
  }

  /**
   * Check for dangerous command patterns
   */
  hasDangerousCommand(command: string): boolean {
    return DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(command));
  }

  /**
   * Validate a single parameter
   */
  private validateParameter(
    paramName: string,
    paramValue: unknown,
    paramType: ParamType,
    contract: AgentContract,
    toolName: string
  ): Permission {
    const valueStr = String(paramValue);

    switch (paramType) {
      case 'path':
        return this.validatePathParam(valueStr, contract, toolName);

      case 'content':
        return this.validateContentParam(valueStr, contract);

      case 'command':
        return this.validateCommandParam(valueStr, contract);

      case 'pattern':
        // Patterns are generally safe, just basic validation
        return { allowed: true, reason: 'allowed' };

      default:
        return { allowed: true, reason: 'allowed' };
    }
  }

  /**
   * Validate a path parameter
   *
   * SECURITY: All tools with path parameters are validated against allowed_paths.
   * This includes read tools (Read, Glob, Grep) to prevent arbitrary filesystem access.
   * @see Codex security review - CRITICAL finding
   */
  private validatePathParam(
    filePath: string,
    contract: AgentContract,
    toolName: string
  ): Permission {
    // 1. Check for directory traversal - applies to ALL tools
    if (this.hasPathTraversal(filePath)) {
      return {
        allowed: false,
        reason: 'path-traversal-detected',
        details: { path: filePath },
      };
    }

    // 2. Resolve and validate absolute paths
    // Absolute paths outside project root are rejected
    if (path.isAbsolute(filePath)) {
      const projectRoot = process.cwd();
      const realPath = path.resolve(filePath);
      if (!realPath.startsWith(projectRoot)) {
        return {
          allowed: false,
          reason: 'path-not-allowed',
          details: {
            path: filePath,
            reason: 'Absolute path outside project root',
            projectRoot,
          },
        };
      }
    }

    // 3. Check spec protection for write operations
    const writeTools = ['Write', 'Edit', 'Delete'];
    if (writeTools.includes(toolName) && this.isSpecProtected(filePath)) {
      return {
        allowed: false,
        reason: 'spec-protection',
        details: {
          path: filePath,
          protectedPaths: this.specProtectedPaths,
        },
      };
    }

    // 4. Check path allowlist for ALL tools (not just write tools)
    // CRITICAL FIX: Read/Glob/Grep must also be constrained
    if (!this.isPathAllowed(filePath, contract.allowed_paths)) {
      return {
        allowed: false,
        reason: 'path-not-allowed',
        details: {
          path: filePath,
          tool: toolName,
          allowedPaths: contract.allowed_paths,
        },
      };
    }

    return { allowed: true, reason: 'allowed' };
  }

  /**
   * Validate a content parameter
   */
  private validateContentParam(
    _content: string,
    _contract: AgentContract
  ): Permission {
    // Content validation is primarily for output schema validation
    // Basic validation here, detailed validation in schema validator
    return { allowed: true, reason: 'allowed' };
  }

  /**
   * Validate a command parameter (for Bash tool)
   */
  private validateCommandParam(
    command: string,
    contract: AgentContract
  ): Permission {
    // Check if Bash is even allowed
    if (!contract.allowed_tools.includes('Bash')) {
      return {
        allowed: false,
        reason: 'tool-not-allowed',
        details: { tool: 'Bash' },
      };
    }

    // Check for dangerous patterns
    if (this.hasDangerousCommand(command)) {
      return {
        allowed: false,
        reason: 'command-injection-detected',
        details: {
          command: command.substring(0, 100), // Truncate for logging
          pattern: 'dangerous command pattern detected',
        },
      };
    }

    return { allowed: true, reason: 'allowed' };
  }

  /**
   * Normalize a path for comparison
   */
  private normalizePath(filePath: string): string {
    // Remove leading ./
    let normalized = filePath.replace(/^\.\//, '');

    // Normalize path separators
    normalized = normalized.replace(/\\/g, '/');

    // Remove trailing slash for directories
    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }
}

/**
 * Create a tool validator with custom spec protected paths
 */
export function createToolValidator(
  specProtectedPaths?: readonly string[]
): ToolValidator {
  return new ToolValidator(specProtectedPaths);
}
