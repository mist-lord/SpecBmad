import fs from 'fs';
import path from 'path';
import { ChangeProposal, SpecDelta, ChangeProgress } from './types';
import { PATHS, getProjectPath } from '@/utils/paths';
import { log } from '@/utils/logger';
import { MarkdownMerger } from '@/utils/markdown-merger';

export class ChangeManager {
  private changesDir: string;

  constructor() {
    this.changesDir = getProjectPath(path.join(PATHS.CONFIG_DIR, 'changes'));
  }

  /**
   * 初始化变更目录
   */
  public ensureInitialized(): void {
    if (!fs.existsSync(this.changesDir)) {
      fs.mkdirSync(this.changesDir, { recursive: true });
    }
  }

  /**
   * 创建新提案
   */
  public createProposal(title: string, description: string): ChangeProposal {
    this.ensureInitialized();
    
    const timestamp = new Date().toISOString().replace(/[-T:.]/g, '').slice(0, 14);
    const id = `CP-${timestamp}`; // e.g., CP-20250127123000
    
    const proposal: ChangeProposal = {
      id,
      title,
      description,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deltas: []
    };

    const proposalDir = path.join(this.changesDir, id);
    fs.mkdirSync(proposalDir, { recursive: true });
    
    // 保存元数据
    this.saveProposal(proposal);
    
    // 创建模板文件
    fs.writeFileSync(path.join(proposalDir, 'proposal.md'), `# ${title}\n\n${description}\n`, 'utf-8');
    fs.writeFileSync(path.join(proposalDir, 'deltas.json'), JSON.stringify([], null, 2), 'utf-8');
    fs.writeFileSync(path.join(proposalDir, 'tasks.json'), JSON.stringify([], null, 2), 'utf-8');

    return proposal;
  }

  /**
   * 获取所有提案
   */
  public listProposals(): ChangeProposal[] {
    this.ensureInitialized();
    
    const proposals: ChangeProposal[] = [];
    const dirs = fs.readdirSync(this.changesDir);
    
    for (const dir of dirs) {
      if (dir.startsWith('CP-')) {
        try {
          const proposal = this.loadProposal(dir);
          if (proposal) {
            proposals.push(proposal);
          }
        } catch (e) {
          log.warn(`无法加载提案 ${dir}: ${e}`);
        }
      }
    }
    
    // 按创建时间倒序排序
    return proposals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * 加载单个提案
   */
  public getProposal(id: string): ChangeProposal | null {
    return this.loadProposal(id);
  }

  /**
   * 更新提案状态
   */
  public updateStatus(id: string, status: ChangeProposal['status']): void {
    const proposal = this.getProposal(id);
    if (!proposal) {
      throw new Error(`提案 ${id} 不存在`);
    }
    
    proposal.status = status;
    proposal.updatedAt = new Date().toISOString();
    this.saveProposal(proposal);
  }

  /**
   * 应用变更提案（合并到主规范）
   */
  public async applyProposal(id: string, force: boolean = false): Promise<void> {
    const proposal = this.getProposal(id);
    if (!proposal) {
      throw new Error(`提案 ${id} 不存在`);
    }

    // 检查状态
    const allowedStatuses = ['approved', 'implemented'];
    if (!allowedStatuses.includes(proposal.status) && !force) {
      throw new Error(`提案状态为 ${proposal.status}，必须为 approved 或 implemented 才能应用 (或使用 --force)`);
    }

    if (proposal.status === 'merged') {
      log.warn(`提案 ${id} 已经合并过了`);
      return;
    }

    // 加载最新的 deltas (可能在文件中有更新)
    const proposalDir = path.join(this.changesDir, id);
    const deltasPath = path.join(proposalDir, 'deltas.json');
    if (fs.existsSync(deltasPath)) {
      try {
        const fileDeltas = JSON.parse(fs.readFileSync(deltasPath, 'utf-8')) as SpecDelta[];
        // 简单的合并策略：文件中的内容优先
        if (fileDeltas && fileDeltas.length > 0) {
          proposal.deltas = fileDeltas;
        }
      } catch (e) {
        log.warn(`无法读取 deltas.json: ${e}`);
      }
    }

    if (!proposal.deltas || proposal.deltas.length === 0) {
      log.warn('提案中没有包含任何 Delta 变更');
      return;
    }

    log.info(`开始应用提案 ${id} 到主规范...`);

    // 应用每个 Delta
    for (const delta of proposal.deltas) {
      await this.applyDelta(delta);
    }

    // 更新状态
    this.updateStatus(id, 'merged');
    log.success(`提案 ${id} 已成功合并`);
  }

  private async applyDelta(delta: SpecDelta): Promise<void> {
    const specsDir = getProjectPath(PATHS.SPECIFICATIONS_DIR);
    const targetPath = path.join(specsDir, delta.specPath);
    
    // 确保目标目录存在
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    let content = '';
    if (fs.existsSync(targetPath)) {
      content = fs.readFileSync(targetPath, 'utf-8');
    } else {
      log.info(`创建新规范文件: ${delta.specPath}`);
    }

    for (const change of delta.changes) {
      if (change.type === 'ADDED') {
        let fullContent = change.content;
        if (change.scenarios && change.scenarios.length > 0) {
          fullContent += '\n\n### 验收场景\n' + change.scenarios.map(s => `- ${s}`).join('\n');
        }
        content = await MarkdownMerger.addSection(content, change.requirement, fullContent, 2);
      } else if (change.type === 'MODIFIED') {
        content = await MarkdownMerger.updateSection(content, change.requirement, change.content, 2);
      } else if (change.type === 'REMOVED') {
        content = await MarkdownMerger.removeSection(content, change.requirement, 2);
      }
    }

    fs.writeFileSync(targetPath, content, 'utf-8');
    log.info(`已更新规范: ${delta.specPath}`);
  }

  private loadProposal(id: string): ChangeProposal | null {
    const metaPath = path.join(this.changesDir, id, 'metadata.json');
    if (!fs.existsSync(metaPath)) {
      return null;
    }
    const proposal = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    
    // 尝试加载分离的 deltas 和 tasks
    const proposalDir = path.join(this.changesDir, id);
    const deltasPath = path.join(proposalDir, 'deltas.json');
    if (fs.existsSync(deltasPath)) {
      try {
        proposal.deltas = JSON.parse(fs.readFileSync(deltasPath, 'utf-8'));
      } catch {}
    }
    
    const tasksPath = path.join(proposalDir, 'tasks.json');
    if (fs.existsSync(tasksPath)) {
      try {
        proposal.tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
      } catch {}
    }

    return proposal;
  }

  private saveProposal(proposal: ChangeProposal): void {
    const dir = path.join(this.changesDir, proposal.id);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 分离存储，metadata 只存核心信息
    const { deltas, tasks, ...meta } = proposal;
    fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(meta, null, 2), 'utf-8');
    
    if (deltas) {
      fs.writeFileSync(path.join(dir, 'deltas.json'), JSON.stringify(deltas, null, 2), 'utf-8');
    }
    if (tasks) {
      fs.writeFileSync(path.join(dir, 'tasks.json'), JSON.stringify(tasks, null, 2), 'utf-8');
    }
  }

  /**
   * 获取变更提案的进度信息
   */
  public getProgress(id: string): ChangeProgress | null {
    const proposal = this.getProposal(id);
    if (!proposal) {
      return null;
    }

    const tasks = proposal.tasks || [];
    const totalTasks = tasks.length || 1; // 如果没有任务，至少有一个"应用变更"的步骤
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;

    // 计算进度百分比
    let progress = 0;
    if (totalTasks > 0) {
      progress = Math.round((completedTasks / totalTasks) * 100);
    } else {
      // 如果没有任务，根据状态估算进度
      switch (proposal.status) {
        case 'draft': progress = 0; break;
        case 'review': progress = 25; break;
        case 'approved': progress = 50; break;
        case 'implemented': progress = 75; break;
        case 'merged': progress = 100; break;
        default: progress = 0;
      }
    }

    // 确定当前步骤
    let currentStep: string | undefined;
    if (inProgressTasks > 0) {
      currentStep = tasks.find(t => t.status === 'in_progress')?.description;
    } else if (pendingTasks > 0) {
      currentStep = tasks.find(t => t.status === 'pending')?.description;
    } else if (proposal.status === 'merged') {
      currentStep = '已完成';
    } else {
      currentStep = proposal.status;
    }

    return {
      proposalId: id,
      totalTasks: totalTasks || 1,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      progress,
      currentStep,
      tasks: tasks.length > 0 ? tasks : undefined
    };
  }
}

export const changeManager = new ChangeManager();
