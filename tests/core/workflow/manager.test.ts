jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    success: jest.fn(),
  },
}));

import { WorkflowManager } from '@/core/workflow/manager';
import { WorkflowConfig, WorkflowStep } from '@/core/workflow/base';
import { WorkflowStatus } from '@/types';

function createStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    id: 'step-1',
    name: 'Test Step',
    execute: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

function createConfig(overrides: Partial<WorkflowConfig> = {}): WorkflowConfig {
  return {
    id: 'test-wf',
    name: 'Test Workflow',
    steps: [createStep()],
    ...overrides,
  };
}

describe('WorkflowManager', () => {
  let manager: WorkflowManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new WorkflowManager();
  });

  // ─── registerWorkflow ───

  describe('registerWorkflow', () => {
    it('should store config for later retrieval', () => {
      const config = createConfig({ id: 'reg-wf' });

      manager.registerWorkflow(config);
      const workflow = manager.createWorkflow('reg-wf');

      expect(workflow).toBeDefined();
    });
  });

  // ─── createWorkflow ───

  describe('createWorkflow', () => {
    it('should return a workflow instance for registered config', () => {
      manager.registerWorkflow(createConfig({ id: 'create-wf' }));

      const workflow = manager.createWorkflow('create-wf');

      expect(workflow).toBeDefined();
      expect(workflow!.getStatus()).toBe(WorkflowStatus.PENDING);
    });

    it('should return undefined for unregistered workflow id', () => {
      const workflow = manager.createWorkflow('nonexistent');

      expect(workflow).toBeUndefined();
    });

    it('should pass context to the created workflow', () => {
      manager.registerWorkflow(createConfig({ id: 'ctx-wf' }));

      const workflow = manager.createWorkflow('ctx-wf', {
        projectPath: '/custom',
        data: { key: 'val' },
      });

      expect(workflow).toBeDefined();
    });
  });

  // ─── executeWorkflow ───

  describe('executeWorkflow', () => {
    it('should auto-create and execute a registered workflow', async () => {
      manager.registerWorkflow(createConfig({ id: 'exec-wf' }));

      const result = await manager.executeWorkflow('exec-wf');

      expect(result.success).toBe(true);
    });

    it('should throw for unregistered workflow id', async () => {
      await expect(manager.executeWorkflow('missing')).rejects.toThrow('无法创建工作流');
    });

    it('should reuse existing workflow instance on second call', async () => {
      manager.registerWorkflow(createConfig({ id: 'reuse-wf' }));

      await manager.executeWorkflow('reuse-wf');
      const workflow = manager.getWorkflow('reuse-wf');

      expect(workflow).toBeDefined();
    });
  });

  // ─── getWorkflow / getAllWorkflows / getWorkflowStatus ───

  describe('getWorkflow / getAllWorkflows / getWorkflowStatus', () => {
    it('should return undefined for non-existent workflow', () => {
      expect(manager.getWorkflow('nope')).toBeUndefined();
    });

    it('should return all created workflows', () => {
      manager.registerWorkflow(createConfig({ id: 'wf-a', name: 'A' }));
      manager.registerWorkflow(createConfig({ id: 'wf-b', name: 'B' }));
      manager.createWorkflow('wf-a');
      manager.createWorkflow('wf-b');

      const all = manager.getAllWorkflows();

      expect(all).toHaveLength(2);
    });

    it('should return workflow status or null', async () => {
      manager.registerWorkflow(createConfig({ id: 'status-wf' }));
      manager.createWorkflow('status-wf');

      expect(manager.getWorkflowStatus('status-wf')).toBe(WorkflowStatus.PENDING);
      expect(manager.getWorkflowStatus('missing')).toBeNull();
    });
  });

  // ─── pause / resume / cancel ───

  describe('pauseWorkflow / resumeWorkflow / cancelWorkflow', () => {
    it('should delegate pause to workflow instance', async () => {
      manager.registerWorkflow(createConfig({ id: 'p-wf' }));
      manager.createWorkflow('p-wf');

      await manager.pauseWorkflow('p-wf');

      expect(manager.getWorkflowStatus('p-wf')).toBe(WorkflowStatus.PAUSED);
    });

    it('should delegate resume to workflow instance', async () => {
      manager.registerWorkflow(createConfig({ id: 'r-wf' }));
      manager.createWorkflow('r-wf');

      await manager.pauseWorkflow('r-wf');
      await manager.resumeWorkflow('r-wf');

      expect(manager.getWorkflowStatus('r-wf')).toBe(WorkflowStatus.RUNNING);
    });

    it('should delegate cancel to workflow instance', async () => {
      manager.registerWorkflow(createConfig({ id: 'c-wf' }));
      manager.createWorkflow('c-wf');

      await manager.cancelWorkflow('c-wf');

      expect(manager.getWorkflowStatus('c-wf')).toBe(WorkflowStatus.CANCELLED);
    });

    it('should no-op for missing workflow on pause/resume/cancel', async () => {
      await expect(manager.pauseWorkflow('ghost')).resolves.toBeUndefined();
      await expect(manager.resumeWorkflow('ghost')).resolves.toBeUndefined();
      await expect(manager.cancelWorkflow('ghost')).resolves.toBeUndefined();
    });
  });

  // ─── removeWorkflow ───

  describe('removeWorkflow', () => {
    it('should remove workflow and clean up listeners', () => {
      manager.registerWorkflow(createConfig({ id: 'rm-wf' }));
      manager.createWorkflow('rm-wf');

      manager.removeWorkflow('rm-wf');

      expect(manager.getWorkflow('rm-wf')).toBeUndefined();
    });

    it('should no-op for non-existent workflow', () => {
      expect(() => manager.removeWorkflow('missing')).not.toThrow();
    });
  });

  // ─── cleanup ───

  describe('cleanup', () => {
    it('should clear all workflows and listeners', () => {
      manager.registerWorkflow(createConfig({ id: 'cl-a' }));
      manager.registerWorkflow(createConfig({ id: 'cl-b' }));
      manager.createWorkflow('cl-a');
      manager.createWorkflow('cl-b');

      manager.cleanup();

      expect(manager.getAllWorkflows()).toHaveLength(0);
    });
  });

  // ─── Event Forwarding ───

  describe('event forwarding', () => {
    it('should forward started as workflowStarted', async () => {
      manager.registerWorkflow(createConfig({ id: 'ev-wf' }));
      const listener = jest.fn();
      manager.on('workflowStarted', listener);

      await manager.executeWorkflow('ev-wf');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'ev-wf' })
      );
    });

    it('should forward completed as workflowCompleted', async () => {
      manager.registerWorkflow(createConfig({ id: 'ev-wf2' }));
      const listener = jest.fn();
      manager.on('workflowCompleted', listener);

      await manager.executeWorkflow('ev-wf2');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'ev-wf2', success: true })
      );
    });

    it('should forward stepError when a step throws', async () => {
      const throwStep = createStep({
        id: 'bad-step',
        execute: jest.fn().mockRejectedValue(new Error('kaboom')),
      });
      manager.registerWorkflow(createConfig({ id: 'err-wf', steps: [throwStep] }));
      const stepErrorListener = jest.fn();
      const completedListener = jest.fn();
      manager.on('stepError', stepErrorListener);
      manager.on('workflowCompleted', completedListener);

      await manager.executeWorkflow('err-wf');

      expect(stepErrorListener).toHaveBeenCalledWith(
        expect.objectContaining({ stepId: 'bad-step', error: expect.stringContaining('kaboom') })
      );
      expect(completedListener).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'err-wf', success: false })
      );
    });

    it('should forward paused/resumed/cancelled events', async () => {
      manager.registerWorkflow(createConfig({ id: 'state-wf' }));
      manager.createWorkflow('state-wf');
      const pausedListener = jest.fn();
      const resumedListener = jest.fn();
      const cancelledListener = jest.fn();
      manager.on('workflowPaused', pausedListener);
      manager.on('workflowResumed', resumedListener);
      manager.on('workflowCancelled', cancelledListener);

      await manager.pauseWorkflow('state-wf');
      await manager.resumeWorkflow('state-wf');
      await manager.cancelWorkflow('state-wf');

      expect(pausedListener).toHaveBeenCalledWith({ workflowId: 'state-wf' });
      expect(resumedListener).toHaveBeenCalledWith({ workflowId: 'state-wf' });
      expect(cancelledListener).toHaveBeenCalledWith({ workflowId: 'state-wf' });
    });
  });
});
