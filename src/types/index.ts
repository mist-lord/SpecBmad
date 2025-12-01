// 基础类型定义
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// 项目相关类型
export interface Project extends BaseEntity {
  name: string;
  description?: string;
  version: string;
  status: ProjectStatus;
  config: ProjectConfig;
}

export enum ProjectStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export interface ProjectConfig {
  outputDir: string;
  templatesDir: string;
  defaultAgent: string;
  agents: AgentConfig[];
}

// AI 代理相关类型
export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  capabilities: AgentCapability[];
}

export enum AgentType {
  CLAUDE = 'claude',
  OPENAI = 'openai',
  CUSTOM = 'custom'
}

export enum AgentCapability {
  SPECIFICATION = 'specification',
  PLANNING = 'planning',
  TASK_DECOMPOSITION = 'task_decomposition',
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation'
}

// 任务相关类型
export interface Task extends BaseEntity {
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgent?: string;
  dependencies: string[];
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  metadata: Record<string, any>;
}

export enum TaskType {
  SPECIFICATION = 'specification',
  PLANNING = 'planning',
  IMPLEMENTATION = 'implementation',
  TESTING = 'testing',
  REVIEW = 'review',
  DOCUMENTATION = 'documentation'
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 文档相关类型
export interface Document extends BaseEntity {
  title: string;
  content: string;
  type: DocumentType;
  format: DocumentFormat;
  path: string;
  tags: string[];
  metadata: Record<string, any>;
}

export enum DocumentType {
  SPECIFICATION = 'specification',
  PLAN = 'plan',
  TASK_LIST = 'task_list',
  CODE = 'code',
  TEST = 'test',
  DOCUMENTATION = 'documentation'
}

export enum DocumentFormat {
  MARKDOWN = 'markdown',
  JSON = 'json',
  YAML = 'yaml',
  TEXT = 'text'
}

// 执行结果类型
export interface ExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
}

// 命令选项类型
export interface CommandOptions {
  verbose?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  force?: boolean;
  output?: string;
  format?: string;
}

// LLM 客户端接口
export interface LLMClient {
  name: string;
  type: AgentType;
  isAvailable(): Promise<boolean>;
  generateText(prompt: string, options?: LLMOptions): Promise<string>;
  generateStructured<T>(prompt: string, schema: any, options?: LLMOptions): Promise<T>;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  context?: string[];
}

// 事件系统类型
export interface Event<T = any> {
  type: string;
  payload: T;
  timestamp: Date;
  source?: string;
}

export type EventHandler<T = any> = (event: Event<T>) => void | Promise<void>;

// 插件系统类型
export interface Plugin {
  name: string;
  version: string;
  description?: string;
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
}

// 工作流类型
export interface Workflow extends BaseEntity {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  status: WorkflowStatus;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  dependencies: string[];
}

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// AI Agent 类型定义
export interface AgentContext {
  projectState: {
    projectName: string;
    workflow: {
      currentStep: string;
      completedSteps: string[];
    };
  };
  workingDirectory: string;
  inputData?: any;
  [key: string]: any;
}

export interface AgentMemory {
  shortTerm: Record<string, any>;
  longTerm: Record<string, any>;
  context: string[];
}

export interface LLMMetrics {
  model?: string;
  promptLength?: number;
  outputLength?: number;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  costUSD?: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface AgentResult {
  success: boolean;
  output: any;
  artifacts: string[];
  nextSteps?: string[];
  errors?: string[];
  metadata?: { metrics?: LLMMetrics; [key: string]: any };
}

export interface Agent {
  name: string;
  role: string;
  capabilities: string[];
  execute(context: AgentContext): Promise<AgentResult>;
  validate?(input: any): boolean;
}