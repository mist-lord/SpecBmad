import { EventEmitter } from 'events';
import { WorkflowStatus } from '@/types';
import { log } from '@/utils/logger';

/**
 * 工作流步骤接口
 */
export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  dependencies?: string[];
  execute: (context: WorkflowContext) => Promise<WorkflowStepResult>;
  validate?: (context: WorkflowContext) => Promise<boolean>;
  rollback?: (context: WorkflowContext) => Promise<void>;
}

/**
 * 工作流上下文
 */
export interface WorkflowContext {
  workflowId: string;
  projectPath: string;
  data: Record<string, any>;
  results: Record<string, WorkflowStepResult>;
  metadata: Record<string, any>;
}

/**
 * 工作流步骤结果
 */
export interface WorkflowStepResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * 工作流配置
 */
export interface WorkflowConfig {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  parallel?: boolean;
  timeout?: number;
  retryCount?: number;
}

/**
 * 基础工作流类
 */
export abstract class BaseWorkflow extends EventEmitter {
  protected config: WorkflowConfig;
  protected context: WorkflowContext;
  protected status: WorkflowStatus = WorkflowStatus.PENDING;
  protected currentStep?: string;
  protected startTime?: Date;
  protected endTime?: Date;

  constructor(config: WorkflowConfig, context: Partial<WorkflowContext> = {}) {
    super();
    this.config = config;
    this.context = {
      workflowId: config.id,
      projectPath: process.cwd(),
      data: {},
      results: {},
      metadata: {},
      ...context
    };
  }

  /**
   * 执行工作流
   */
  async execute(): Promise<WorkflowStepResult> {
    try {
      this.status = WorkflowStatus.RUNNING;
      this.startTime = new Date();
      this.emit('started', { workflowId: this.config.id });
      
      log.info(`开始执行工作流: ${this.config.name}`);

      const result = await this.executeSteps();
      
      this.status = result.success ? WorkflowStatus.COMPLETED : WorkflowStatus.FAILED;
      this.endTime = new Date();
      
      this.emit('completed', { 
        workflowId: this.config.id, 
        success: result.success,
        duration: this.getDuration()
      });

      log.info(`工作流执行${result.success ? '成功' : '失败'}: ${this.config.name}`);
      
      return result;
    } catch (error) {
      this.status = WorkflowStatus.FAILED;
      this.endTime = new Date();
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`工作流执行异常: ${errorMessage}`);
      
      this.emit('error', { workflowId: this.config.id, error: errorMessage });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 执行工作流步骤
   */
  protected async executeSteps(): Promise<WorkflowStepResult> {
    if (this.config.parallel) {
      return this.executeStepsParallel();
    } else {
      return this.executeStepsSequential();
    }
  }

  /**
   * 顺序执行步骤
   */
  protected async executeStepsSequential(): Promise<WorkflowStepResult> {
    for (const step of this.config.steps) {
      const result = await this.executeStep(step);
      if (!result.success) {
        return result;
      }
    }
    
    return { success: true };
  }

  /**
   * 并行执行步骤
   */
  protected async executeStepsParallel(): Promise<WorkflowStepResult> {
    const promises = this.config.steps.map(step => this.executeStep(step));
    const results = await Promise.allSettled(promises);
    
    const failedResults = results.filter(result => 
      result.status === 'rejected' || 
      (result.status === 'fulfilled' && !result.value.success)
    );
    
    if (failedResults.length > 0) {
      const firstFailure = failedResults[0];
      if (!firstFailure) {
        return { success: false, error: '未知的并行执行错误' };
      }
      
      const error = firstFailure.status === 'rejected' 
        ? (firstFailure as PromiseRejectedResult).reason 
        : (firstFailure as PromiseFulfilledResult<WorkflowStepResult>).value.error;
      
      return {
        success: false,
        error: `并行执行失败: ${error}`
      };
    }
    
    return { success: true };
  }

  /**
   * 执行单个步骤
   */
  protected async executeStep(step: WorkflowStep): Promise<WorkflowStepResult> {
    try {
      this.currentStep = step.id;
      this.emit('stepStarted', { workflowId: this.config.id, stepId: step.id });
      
      log.debug(`执行步骤: ${step.name}`);

      // 验证步骤前置条件
      if (step.validate) {
        const isValid = await step.validate(this.context);
        if (!isValid) {
          throw new Error(`步骤验证失败: ${step.name}`);
        }
      }

      // 执行步骤
      const result = await step.execute(this.context);
      
      // 保存结果
      this.context.results[step.id] = result;
      
      this.emit('stepCompleted', { 
        workflowId: this.config.id, 
        stepId: step.id, 
        success: result.success 
      });

      if (result.success) {
        log.debug(`步骤执行成功: ${step.name}`);
      } else {
        log.error(`步骤执行失败: ${step.name} - ${result.error}`);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result = {
        success: false,
        error: errorMessage
      };
      
      this.context.results[step.id] = result;
      
      this.emit('stepError', { 
        workflowId: this.config.id, 
        stepId: step.id, 
        error: errorMessage 
      });
      
      return result;
    }
  }

  /**
   * 暂停工作流
   */
  async pause(): Promise<void> {
    this.status = WorkflowStatus.PAUSED;
    this.emit('paused', { workflowId: this.config.id });
    log.info(`工作流已暂停: ${this.config.name}`);
  }

  /**
   * 恢复工作流
   */
  async resume(): Promise<void> {
    this.status = WorkflowStatus.RUNNING;
    this.emit('resumed', { workflowId: this.config.id });
    log.info(`工作流已恢复: ${this.config.name}`);
  }

  /**
   * 取消工作流
   */
  async cancel(): Promise<void> {
    this.status = WorkflowStatus.CANCELLED;
    this.endTime = new Date();
    this.emit('cancelled', { workflowId: this.config.id });
    log.info(`工作流已取消: ${this.config.name}`);
  }

  /**
   * 获取工作流状态
   */
  getStatus(): WorkflowStatus {
    return this.status;
  }

  /**
   * 获取当前步骤
   */
  getCurrentStep(): string | undefined {
    return this.currentStep;
  }

  /**
   * 获取执行时长
   */
  getDuration(): number {
    if (!this.startTime) return 0;
    const endTime = this.endTime || new Date();
    return endTime.getTime() - this.startTime.getTime();
  }

  /**
   * 获取工作流进度
   */
  getProgress(): { completed: number; total: number; percentage: number } {
    const total = this.config.steps.length;
    const completed = Object.keys(this.context.results).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }
}