import { EventEmitter } from 'events';
import { BaseWorkflow, WorkflowConfig, WorkflowContext } from './base';
import { WorkflowStatus } from '@/types';
import { log } from '@/utils/logger';

/**
 * 工作流管理器
 */
export class WorkflowManager extends EventEmitter {
  private workflows: Map<string, BaseWorkflow> = new Map();
  private workflowConfigs: Map<string, WorkflowConfig> = new Map();

  constructor() {
    super();
  }

  /**
   * 注册工作流配置
   */
  registerWorkflow(config: WorkflowConfig): void {
    this.workflowConfigs.set(config.id, config);
    log.debug(`注册工作流: ${config.name}`);
  }

  /**
   * 创建工作流实例
   */
  createWorkflow(workflowId: string, context?: Partial<WorkflowContext>): BaseWorkflow | undefined {
    const config = this.workflowConfigs.get(workflowId);
    if (!config) {
      log.error(`未找到工作流配置: ${workflowId}`);
      return undefined;
    }

    // 创建具体的工作流实例
    const workflow = new ConcreteWorkflow(config, context);
    
    // 设置事件监听
    this.setupWorkflowListeners(workflow);
    
    this.workflows.set(workflow.getWorkflowId(), workflow);
    
    return workflow;
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(workflowId: string, context?: Partial<WorkflowContext>): Promise<any> {
    let workflow = this.workflows.get(workflowId);
    
    if (!workflow) {
      workflow = this.createWorkflow(workflowId, context);
      if (!workflow) {
        throw new Error(`无法创建工作流: ${workflowId}`);
      }
    }

    return workflow.execute();
  }

  /**
   * 获取工作流实例
   */
  getWorkflow(workflowId: string): BaseWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * 获取所有工作流
   */
  getAllWorkflows(): BaseWorkflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * 获取工作流状态
   */
  getWorkflowStatus(workflowId: string): WorkflowStatus | null {
    const workflow = this.workflows.get(workflowId);
    return workflow ? workflow.getStatus() : null;
  }

  /**
   * 暂停工作流
   */
  async pauseWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      await workflow.pause();
    }
  }

  /**
   * 恢复工作流
   */
  async resumeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      await workflow.resume();
    }
  }

  /**
   * 取消工作流
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      await workflow.cancel();
    }
  }

  /**
   * 移除工作流
   */
  removeWorkflow(workflowId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      workflow.removeAllListeners();
      this.workflows.delete(workflowId);
    }
  }

  /**
   * 清理所有工作流
   */
  cleanup(): void {
    for (const workflow of this.workflows.values()) {
      workflow.removeAllListeners();
    }
    this.workflows.clear();
  }

  /**
   * 设置工作流事件监听
   */
  private setupWorkflowListeners(workflow: BaseWorkflow): void {
    workflow.on('started', (data) => {
      this.emit('workflowStarted', data);
    });

    workflow.on('completed', (data) => {
      this.emit('workflowCompleted', data);
    });

    workflow.on('error', (data) => {
      this.emit('workflowError', data);
    });

    workflow.on('paused', (data) => {
      this.emit('workflowPaused', data);
    });

    workflow.on('resumed', (data) => {
      this.emit('workflowResumed', data);
    });

    workflow.on('cancelled', (data) => {
      this.emit('workflowCancelled', data);
    });

    workflow.on('stepStarted', (data) => {
      this.emit('stepStarted', data);
    });

    workflow.on('stepCompleted', (data) => {
      this.emit('stepCompleted', data);
    });

    workflow.on('stepError', (data) => {
      this.emit('stepError', data);
    });
  }
}

/**
 * 具体工作流实现
 */
class ConcreteWorkflow extends BaseWorkflow {
  getWorkflowId(): string {
    return this.config.id;
  }
}

// 导出单例实例
export const workflowManager = new WorkflowManager();