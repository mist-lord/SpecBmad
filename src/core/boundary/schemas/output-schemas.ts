/**
 * Output Schema Definitions for Agent Validation
 *
 * Defines Zod schemas for validating agent outputs based on their contracts.
 * @see ADR-ARCH-004-boundary-driven-architecture.md - SEC-005
 * @see .specbmad/agent-contracts.yaml for schema name mappings
 */

import { z } from 'zod';

/**
 * Common metadata schema for all agent outputs
 */
const OutputMetadataSchema = z.object({
  timestamp: z.number().optional(),
  agent: z.string().optional(),
  version: z.string().optional(),
});

/**
 * RequirementsSpec - Output from Analyst agent
 * Contains analyzed requirements from user intent
 */
export const RequirementsSpecSchema = z.object({
  schema_version: z.number().default(1),
  requirements: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      description: z.string(),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
      type: z.enum(['functional', 'non-functional', 'constraint']).optional(),
    })
  ),
  constraints: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
      })
    )
    .optional(),
  metadata: OutputMetadataSchema.optional(),
});

/**
 * DesignSpec - Output from Architect agent
 * Contains system architecture and design decisions
 */
export const DesignSpecSchema = z.object({
  schema_version: z.number().default(1),
  architecture: z.object({
    type: z.string(), // e.g., 'monolith', 'microservices', 'serverless'
    components: z.array(
      z.object({
        name: z.string().min(1),
        description: z.string(),
        responsibilities: z.array(z.string()).optional(),
        dependencies: z.array(z.string()).optional(),
      })
    ),
  }),
  interfaces: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['api', 'event', 'file', 'database']).optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
  decisions: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        rationale: z.string(),
        alternatives: z.array(z.string()).optional(),
      })
    )
    .optional(),
  metadata: OutputMetadataSchema.optional(),
});

/**
 * CodeArtifacts - Output from Developer agent
 * Contains generated code files and related artifacts
 */
export const CodeArtifactsSchema = z.object({
  files: z.array(
    z.object({
      path: z.string().min(1),
      content: z.string(),
      language: z.string().optional(),
      action: z.enum(['create', 'update', 'delete']).optional(),
    })
  ),
  tests: z
    .array(
      z.object({
        path: z.string().min(1),
        content: z.string(),
        type: z.enum(['unit', 'integration', 'e2e']).optional(),
      })
    )
    .optional(),
  metadata: OutputMetadataSchema.optional(),
});

/**
 * QAReport - Output from QA agent
 * Contains test results and quality assessment
 */
export const QAReportSchema = z.object({
  summary: z.object({
    passed: z.number().int().min(0),
    failed: z.number().int().min(0),
    skipped: z.number().int().min(0).optional(),
    coverage: z.number().min(0).max(100).optional(),
  }),
  testResults: z
    .array(
      z.object({
        name: z.string(),
        status: z.enum(['passed', 'failed', 'skipped']),
        duration: z.number().optional(),
        error: z.string().optional(),
      })
    )
    .optional(),
  issues: z
    .array(
      z.object({
        severity: z.enum(['critical', 'high', 'medium', 'low']),
        description: z.string(),
        location: z.string().optional(),
      })
    )
    .optional(),
  metadata: OutputMetadataSchema.optional(),
});

/**
 * SecurityReport - Output from SecurityExpert agent
 * Contains security findings and recommendations
 */
export const SecurityReportSchema = z.object({
  summary: z.object({
    critical: z.number().int().min(0),
    high: z.number().int().min(0),
    medium: z.number().int().min(0),
    low: z.number().int().min(0),
  }),
  findings: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
      title: z.string(),
      description: z.string(),
      location: z.string().optional(),
      recommendation: z.string().optional(),
      cwe: z.string().optional(), // Common Weakness Enumeration
    })
  ),
  passed: z.boolean().optional(),
  metadata: OutputMetadataSchema.optional(),
});

/**
 * IntentSpec - Input to Analyst agent (also used as reference)
 * Represents the initial user intent/requirements
 */
export const IntentSpecSchema = z.object({
  schema_version: z.number().default(1),
  title: z.string().min(1),
  description: z.string(),
  goals: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  metadata: OutputMetadataSchema.optional(),
});

/**
 * Registry mapping schema names to Zod validators
 * Used by BoundaryGuard.validateOutput()
 */
export const OutputSchemaRegistry: Record<string, z.ZodSchema> = {
  RequirementsSpec: RequirementsSpecSchema,
  DesignSpec: DesignSpecSchema,
  CodeArtifacts: CodeArtifactsSchema,
  QAReport: QAReportSchema,
  SecurityReport: SecurityReportSchema,
  IntentSpec: IntentSpecSchema,
};

/**
 * Type exports for TypeScript consumers
 */
export type RequirementsSpec = z.infer<typeof RequirementsSpecSchema>;
export type DesignSpec = z.infer<typeof DesignSpecSchema>;
export type CodeArtifacts = z.infer<typeof CodeArtifactsSchema>;
export type QAReport = z.infer<typeof QAReportSchema>;
export type SecurityReport = z.infer<typeof SecurityReportSchema>;
export type IntentSpec = z.infer<typeof IntentSpecSchema>;
