import fs from 'fs';
import path from 'path';
import { Project, ProjectStatus, TaskStatus } from '@/types';
import { config } from '@/utils/config';
import { log } from '@/utils/logger';

/**
 * 项目状态信息
 */
export interface ProjectStatusInfo {
  project: Partial<Project>;
  tasks: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    blocked: number;
    cancelled: number;
  };
  files: {
    specifications: string[];
    plans: string[];
    implementations: string[];
    tests: string[];
  };
  agents: {
    available: string[];
    active: string[];
  };
  lastActivity: Date;
  health: 'healthy' | 'warning' | 'error';
  issues: string[];
}

/**
 * 项目状态管理器
 */
export class ProjectStatusManager {
  private statusFile: string;
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.statusFile = path.join(projectRoot, '.specbmad', 'status.json');
  }

  /**
   * 获取项目状态
   */
  public async getStatus(): Promise<ProjectStatusInfo> {
    try {
      const status: ProjectStatusInfo = {
        project: await this.getProjectInfo(),
        tasks: await this.getTasksStatus(),
        files: await this.getFilesStatus(),
        agents: await this.getAgentsStatus(),
        lastActivity: await this.getLastActivity(),
        health: 'healthy',
        issues: []
      };

      // 评估项目健康状态
      status.health = this.evaluateHealth(status);
      status.issues = this.getHealthIssues(status);

      return status;
    } catch (error) {
      log.error(`获取项目状态失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 保存项目状态
   */
  public async saveStatus(status: Partial<ProjectStatusInfo>): Promise<void> {
    try {
      // 确保目录存在
      const statusDir = path.dirname(this.statusFile);
      if (!fs.existsSync(statusDir)) {
        fs.mkdirSync(statusDir, { recursive: true });
      }

      // 读取现有状态
      let existingStatus: Partial<ProjectStatusInfo> = {};
      if (fs.existsSync(this.statusFile)) {
        const content = fs.readFileSync(this.statusFile, 'utf-8');
        existingStatus = JSON.parse(content);
      }

      // 合并状态
      const mergedStatus = {
        ...existingStatus,
        ...status,
        lastActivity: new Date()
      };

      // 保存状态
      fs.writeFileSync(this.statusFile, JSON.stringify(mergedStatus, null, 2));
      log.debug('项目状态已保存');
    } catch (error) {
      log.error(`保存项目状态失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 更新任务状态
   */
  public async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    try {
      // TODO: 实现任务状态更新逻辑
      log.info(`任务 ${taskId} 状态更新为: ${status}`);
      
      // 更新项目状态
      await this.saveStatus({
        lastActivity: new Date()
      });
    } catch (error) {
      log.error(`更新任务状态失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 记录活动
   */
  public async recordActivity(activity: string, metadata?: Record<string, any>): Promise<void> {
    try {
      log.info(`项目活动: ${activity}`, metadata);
      
      // 更新最后活动时间
      await this.saveStatus({
        lastActivity: new Date()
      });
    } catch (error) {
      log.error(`记录活动失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检查项目是否已初始化
   */
  public isInitialized(): boolean {
    return fs.existsSync(path.join(this.projectRoot, '.specbmad.json'));
  }

  /**
   * 获取项目信息
   */
  private async getProjectInfo(): Promise<Partial<Project>> {
    const projectConfig = config.load();
    
    const projectInfo: Partial<Project> = {
      name: projectConfig.projectName || path.basename(this.projectRoot),
      version: projectConfig.version || '0.1.0',
      status: this.isInitialized() ? ProjectStatus.ACTIVE : ProjectStatus.INITIALIZING
    };

    if (projectConfig.description) {
      projectInfo.description = projectConfig.description;
    }

    return projectInfo;
  }

  /**
   * 获取任务状态统计
   */
  private async getTasksStatus(): Promise<ProjectStatusInfo['tasks']> {
    // TODO: 实现任务状态统计逻辑
    // 这里应该从任务存储中读取实际数据
    return {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      blocked: 0,
      cancelled: 0
    };
  }

  /**
   * 获取文件状态
   */
  private async getFilesStatus(): Promise<ProjectStatusInfo['files']> {
    const outputDir = config.get('outputDir') || './output';
    const files: ProjectStatusInfo['files'] = {
      specifications: [],
      plans: [],
      implementations: [],
      tests: []
    };

    try {
      if (fs.existsSync(outputDir)) {
        const entries = fs.readdirSync(outputDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isFile()) {
            const fileName = entry.name;
            const filePath = path.join(outputDir, fileName);
            
            if (fileName.includes('spec') || fileName.includes('requirement')) {
              files.specifications.push(filePath);
            } else if (fileName.includes('plan') || fileName.includes('design')) {
              files.plans.push(filePath);
            } else if (fileName.includes('impl') || fileName.includes('code')) {
              files.implementations.push(filePath);
            } else if (fileName.includes('test')) {
              files.tests.push(filePath);
            }
          }
        }
      }
    } catch (error) {
      log.debug(`读取文件状态失败: ${error}`);
    }

    return files;
  }

  /**
   * 获取代理状态
   */
  private async getAgentsStatus(): Promise<ProjectStatusInfo['agents']> {
    // TODO: 从LLM管理器获取代理状态
    return {
      available: [],
      active: []
    };
  }

  /**
   * 获取最后活动时间
   */
  private async getLastActivity(): Promise<Date> {
    try {
      if (fs.existsSync(this.statusFile)) {
        const content = fs.readFileSync(this.statusFile, 'utf-8');
        const status = JSON.parse(content);
        return new Date(status.lastActivity || Date.now());
      }
    } catch (error) {
      log.debug(`读取最后活动时间失败: ${error}`);
    }
    
    return new Date();
  }

  /**
   * 评估项目健康状态
   */
  private evaluateHealth(status: ProjectStatusInfo): 'healthy' | 'warning' | 'error' {
    const issues = this.getHealthIssues(status);
    
    if (issues.some(issue => issue.includes('错误') || issue.includes('失败'))) {
      return 'error';
    }
    
    if (issues.length > 0) {
      return 'warning';
    }
    
    return 'healthy';
  }

  /**
   * 获取健康问题
   */
  private getHealthIssues(status: ProjectStatusInfo): string[] {
    const issues: string[] = [];

    // 检查项目是否已初始化
    if (!this.isInitialized()) {
      issues.push('项目尚未初始化');
    }

    // 检查是否有可用的代理
    if (status.agents.available.length === 0) {
      issues.push('没有可用的AI代理');
    }

    // 检查是否有阻塞的任务
    if (status.tasks.blocked > 0) {
      issues.push(`有 ${status.tasks.blocked} 个任务被阻塞`);
    }

    // 检查最后活动时间
    const daysSinceLastActivity = (Date.now() - status.lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastActivity > 7) {
      issues.push('项目已超过7天没有活动');
    }

    return issues;
  }
}

// 导出默认实例
export const projectStatus = new ProjectStatusManager();