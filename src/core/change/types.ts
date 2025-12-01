export type ChangeType = 'ADDED' | 'MODIFIED' | 'REMOVED';

export interface SpecDelta {
  specPath: string; // 关联的规范文件路径 (相对于 .specbmad/specifications)
  changes: {
    type: ChangeType;
    requirement: string; // 需求标题或ID
    content: string; // 变更内容 (Markdown)
    scenarios?: string[]; // 验收场景
  }[];
}

export interface ChangeProposal {
  id: string; // 自动生成的唯一ID (e.g., "CP-20250127-01")
  title: string; // 提案标题
  description: string; // 提案描述/原因
  status: 'draft' | 'review' | 'approved' | 'implemented' | 'merged' | 'rejected';
  author?: string;
  createdAt: string; // ISO Date
  updatedAt: string; // ISO Date
  
  // 关联的 Delta 规范变更
  deltas: SpecDelta[];
  
  // 关联的任务 (实施计划)
  tasks?: {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
  }[];
}

export interface ChangeProgress {
  proposalId: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  progress: number; // 0-100
  currentStep?: string;
  tasks?: ChangeProposal['tasks'];
}

