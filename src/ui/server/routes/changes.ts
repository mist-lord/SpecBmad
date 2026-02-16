import { Router, Request, Response } from 'express';
import { changeManager } from '@/core/change/manager';

export const changesRouter: Router = Router();

const getChangeId = (req: Request): string =>
  Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

// 获取所有变更提案
changesRouter.get('/', (req: Request, res: Response) => {
  try {
    const proposals = changeManager.listProposals();
    res.json(proposals);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 获取单个提案
changesRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const proposal = changeManager.getProposal(getChangeId(req));
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 创建新提案
changesRouter.post('/', (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const proposal = changeManager.createProposal(title, description || '');
    res.status(201).json(proposal);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 更新提案状态
changesRouter.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    changeManager.updateStatus(getChangeId(req), status);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 应用提案
changesRouter.post('/:id/apply', async (req: Request, res: Response) => {
  try {
    const { force } = req.body;
    await changeManager.applyProposal(getChangeId(req), force);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 获取提案进度
changesRouter.get('/:id/progress', (req: Request, res: Response) => {
  try {
    const progress = changeManager.getProgress(getChangeId(req));
    if (!progress) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});
