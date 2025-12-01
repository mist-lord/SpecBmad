import fs from 'fs';
import path from 'path';
import { Project, ProjectStatus, TaskStatus } from '@/types';
import { config } from '@/utils/config';
import { log } from '@/utils/logger';
import { PATHS, getProjectPath } from '@/utils/paths';

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
    this.statusFile = getProjectPath(PATHS.STATUS_FILE);
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
      log.info(`任务 ${taskId} 状态更新为: ${status}`);
      
      // 读取当前状态
      const currentStatus = await this.getStatus();
      
      // 更新任务统计（简化实现）
      const tasks = currentStatus.tasks;
      // 这里可以扩展为更详细的任务跟踪，目前只更新最后活动时间
      
      // 更新项目状态
      await this.saveStatus({
        tasks,
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
  public async getTasksStatus(): Promise<ProjectStatusInfo['tasks']> {
    const stats = {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      blocked: 0,
      cancelled: 0
    };

    try {
      // 尝试从 artifacts 目录读取任务文件
      const artifactsDir = getProjectPath(PATHS.ARTIFACTS_DIR);
      const tasksFile = path.join(artifactsDir, 'tasks.md');
      
      if (fs.existsSync(tasksFile)) {
        const content = fs.readFileSync(tasksFile, 'utf-8');
        // 任务统计：从 Markdown 任务文件中统计任务状态
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('- [ ]')) {
            stats.pending++;
            stats.total++;
          } else if (line.trim().startsWith('- [x]') || line.trim().startsWith('- [X]')) {
            stats.completed++;
            stats.total++;
          } else if (line.toLowerCase().includes('blocked') || line.toLowerCase().includes('阻塞')) {
            stats.blocked++;
          } else if (line.toLowerCase().includes('in progress') || line.toLowerCase().includes('进行中')) {
            stats.inProgress++;
          }
        }
      }

      // 尝试从工作流状态文件读取任务信息
      const workflowStateFile = getProjectPath(PATHS.WORKFLOW_STATE_FILE);
      if (fs.existsSync(workflowStateFile)) {
        const workflowState = JSON.parse(fs.readFileSync(workflowStateFile, 'utf-8'));
        if (workflowState.completedSteps) {
          stats.completed += workflowState.completedSteps.length;
          stats.total += workflowState.completedSteps.length;
        }
      }
    } catch (error) {
      log.debug(`读取任务状态失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    return stats;
  }

  /**
   * 获取文件状态
   */
  public async getFilesStatus(): Promise<ProjectStatusInfo['files']> {
    const files: ProjectStatusInfo['files'] = {
      specifications: [],
      plans: [],
      implementations: [],
      tests: []
    };

    try {
      // 从规范目录读取
      const specsDir = getProjectPath(PATHS.SPECIFICATIONS_DIR);
      if (fs.existsSync(specsDir)) {
        const entries = fs.readdirSync(specsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.json'))) {
            files.specifications.push(path.join(specsDir, entry.name));
          }
        }
      }

      // 从产物目录读取
      const artifactsDir = getProjectPath(PATHS.ARTIFACTS_DIR);
      if (fs.existsSync(artifactsDir)) {
        const entries = fs.readdirSync(artifactsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            const fileName = entry.name;
            const filePath = path.join(artifactsDir, fileName);
            
            if (fileName.includes('spec') || fileName.includes('requirement') || fileName.includes('analysis')) {
              files.specifications.push(filePath);
            } else if (fileName.includes('plan') || fileName.includes('planning') || fileName.includes('design')) {
              files.plans.push(filePath);
            } else if (fileName.includes('impl') || fileName.includes('implement') || fileName.includes('code')) {
              files.implementations.push(filePath);
            } else if (fileName.includes('test') || fileName.includes('qa')) {
              files.tests.push(filePath);
            }
          }
        }
      }

      // 从输出目录读取（如果配置了）
      const outputDir = config.get('outputDir');
      if (outputDir && fs.existsSync(outputDir)) {
        // 递归读取目录
        const readDirRecursive = (dir: string, baseDir: string = dir): void => {
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                readDirRecursive(fullPath, baseDir);
              } else if (entry.isFile()) {
                const fileName = entry.name;
                const relativePath = path.relative(baseDir, fullPath);
                
                if (fileName.includes('spec') || fileName.includes('requirement')) {
                  files.specifications.push(fullPath);
                } else if (fileName.includes('plan') || fileName.includes('design')) {
                  files.plans.push(fullPath);
                } else if (fileName.includes('impl') || fileName.includes('code')) {
                  files.implementations.push(fullPath);
                } else if (fileName.includes('test')) {
                  files.tests.push(fullPath);
                }
              }
            }
          } catch (error) {
            log.debug(`读取目录失败: ${dir}, ${error}`);
          }
        };
        readDirRecursive(outputDir);
      }
    } catch (error) {
      log.debug(`读取文件状态失败: ${error}`);
    }

    return files;
  }

  /**
   * 获取代理状态
   */
  public async getAgentsStatus(): Promise<ProjectStatusInfo['agents']> {
    const agents = {
      available: [] as string[],
      active: [] as string[]
    };

    try {
      // 从 LLM 管理器获取客户端状态
      const { llmManager } = await import('@/core/llm/manager');
      await llmManager.initialize();
      const clientStatus = await llmManager.getClientStatus();
      
      for (const client of clientStatus) {
        if (client.available) {
          agents.available.push(client.name);
        }
      }

      // 从 AgentFactory 获取已注册的代理
      const { AgentFactory } = await import('@/agents/factory');
      const registeredAgents = AgentFactory.getAvailableAgents();
      agents.available.push(...registeredAgents.filter(a => !agents.available.includes(a)));

      // 从配置中获取启用的代理
      const projectConfig = config.load();
      if (projectConfig.agents) {
        for (const [name, agentConfig] of Object.entries(projectConfig.agents)) {
          if (agentConfig.enabled && !agents.available.includes(name)) {
            agents.available.push(name);
          }
        }
      }
    } catch (error) {
      log.debug(`获取代理状态失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    return agents;
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