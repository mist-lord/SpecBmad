jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    success: jest.fn(),
  },
}));

import {
  BaseWorkflow,
  WorkflowConfig,
  WorkflowContext,
  WorkflowStep,
  WorkflowStepResult,
} from '@/core/workflow/base';
import { WorkflowStatus } from '@/types';

/**
 * Concrete test implementation of abstract BaseWorkflow
 */
class TestWorkflow extends BaseWorkflow {
  getWorkflowId(): string {
    return this.config.id;
  }
}

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
    id: 'test-workflow',
    name: 'Test Workflow',
    steps: [createStep()],
    ...overrides,
  };
}

describe('BaseWorkflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Constructor & State Initialization ───

  describe('constructor & state initialization', () => {
    it('should initialize with PENDING status', () => {
      const workflow = new TestWorkflow(createConfig());

      expect(workflow.getStatus()).toBe(WorkflowStatus.PENDING);
    });

    it('should set config and merge default context', () => {
      const workflow = new TestWorkflow(createConfig({ id: 'wf-1' }));

      expect(workflow.getWorkflowId()).toBe('wf-1');
      expect(workflow.getCurrentStep()).toBeUndefined();
      expect(workflow.getDuration()).toBe(0);
    });

    it('should merge provided partial context with defaults', () => {
      const workflow = new TestWorkflow(
        createConfig(),
        { projectPath: '/custom/path', data: { key: 'value' } }
      );

      const progress = workflow.getProgress();
      expect(progress.total).toBe(1);
      expect(progress.completed).toBe(0);
    });
  });

  // ─── execute() Lifecycle ───

  describe('execute() lifecycle', () => {
    it('should set status to RUNNING then COMPLETED on success', async () => {
      const workflow = new TestWorkflow(createConfig());

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(workflow.getStatus()).toBe(WorkflowStatus.COMPLETED);
    });

    it('should set status to FAILED when a step fails', async () => {
      const failStep = createStep({
        execute: jest.fn().mockResolvedValue({ success: false, error: 'step failed' }),
      });
      const workflow = new TestWorkflow(createConfig({ steps: [failStep] }));

      const result = await workflow.execute();

      expect(result.success).toBe(false);
      expect(workflow.getStatus()).toBe(WorkflowStatus.FAILED);
    });

    it('should set status to FAILED and return error on thrown exception', async () => {
      const throwStep = createStep({
        execute: jest.fn().mockRejectedValue(new Error('boom')),
      });
      const workflow = new TestWorkflow(createConfig({ steps: [throwStep] }));

      const result = await workflow.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
      expect(workflow.getStatus()).toBe(WorkflowStatus.FAILED);
    });

    it('should emit started and completed events on success', async () => {
      const workflow = new TestWorkflow(createConfig({ id: 'evt-wf' }));
      const startedListener = jest.fn();
      const completedListener = jest.fn();
      workflow.on('started', startedListener);
      workflow.on('completed', completedListener);

      await workflow.execute();

      expect(startedListener).toHaveBeenCalledWith({ workflowId: 'evt-wf' });
      expect(completedListener).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'evt-wf', success: true })
      );
    });

    it('should emit stepError when a step throws an exception', async () => {
      const throwStep = createStep({
        id: 'throw-step',
        execute: jest.fn().mockRejectedValue(new Error('unexpected')),
      });
      const workflow = new TestWorkflow(createConfig({ id: 'err-wf', steps: [throwStep] }));
      const stepErrorListener = jest.fn();
      workflow.on('stepError', stepErrorListener);

      const result = await workflow.execute();

      expect(result.success).toBe(false);
      expect(stepErrorListener).toHaveBeenCalledWith(
        expect.objectContaining({ stepId: 'throw-step', error: expect.stringContaining('unexpected') })
      );
    });
  });

  // ─── Sequential Step Execution ───

  describe('sequential step execution', () => {
    it('should execute steps in order', async () => {
      const order: string[] = [];
      const stepA = createStep({
        id: 'a',
        name: 'Step A',
        execute: jest.fn(async () => { order.push('a'); return { success: true }; }),
      });
      const stepB = createStep({
        id: 'b',
        name: 'Step B',
        execute: jest.fn(async () => { order.push('b'); return { success: true }; }),
      });
      const workflow = new TestWorkflow(createConfig({ steps: [stepA, stepB] }));

      await workflow.execute();

      expect(order).toEqual(['a', 'b']);
    });

    it('should stop on first failure in sequential mode', async () => {
      const stepA = createStep({
        id: 'a',
        execute: jest.fn().mockResolvedValue({ success: false, error: 'fail' }),
      });
      const stepB = createStep({
        id: 'b',
        execute: jest.fn().mockResolvedValue({ success: true }),
      });
      const workflow = new TestWorkflow(createConfig({ steps: [stepA, stepB] }));

      const result = await workflow.execute();

      expect(result.success).toBe(false);
      expect(stepB.execute).not.toHaveBeenCalled();
    });
  });

  // ─── Parallel Step Execution ───

  describe('parallel step execution', () => {
    it('should execute all steps concurrently via Promise.allSettled', async () => {
      const stepA = createStep({
        id: 'a',
        execute: jest.fn().mockResolvedValue({ success: true }),
      });
      const stepB = createStep({
        id: 'b',
        execute: jest.fn().mockResolvedValue({ success: true }),
      });
      const workflow = new TestWorkflow(
        createConfig({ steps: [stepA, stepB], parallel: true })
      );

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(stepA.execute).toHaveBeenCalled();
      expect(stepB.execute).toHaveBeenCalled();
    });

    it('should return failure if any parallel step fails', async () => {
      const stepA = createStep({
        id: 'a',
        execute: jest.fn().mockResolvedValue({ success: true }),
      });
      const stepB = createStep({
        id: 'b',
        execute: jest.fn().mockResolvedValue({ success: false, error: 'b failed' }),
      });
      const workflow = new TestWorkflow(
        createConfig({ steps: [stepA, stepB], parallel: true })
      );

      const result = await workflow.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('b failed');
    });

    it('should handle rejected promises in parallel mode', async () => {
      const stepA = createStep({
        id: 'a',
        execute: jest.fn().mockRejectedValue(new Error('rejected')),
      });
      const workflow = new TestWorkflow(
        createConfig({ steps: [stepA], parallel: true })
      );

      const result = await workflow.execute();

      expect(result.success).toBe(false);
    });
  });

  // ─── Step Validation ───

  describe('step validation', () => {
    it('should call validate before execute and proceed when valid', async () => {
      const step = createStep({
        validate: jest.fn().mockResolvedValue(true),
        execute: jest.fn().mockResolvedValue({ success: true }),
      });
      const workflow = new TestWorkflow(createConfig({ steps: [step] }));

      const result = await workflow.execute();

      expect(step.validate).toHaveBeenCalled();
      expect(step.execute).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should fail step when validate returns false', async () => {
      const step = createStep({
        validate: jest.fn().mockResolvedValue(false),
        execute: jest.fn().mockResolvedValue({ success: true }),
      });
      const workflow = new TestWorkflow(createConfig({ steps: [step] }));

      const result = await workflow.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('验证失败');
      expect(step.execute).not.toHaveBeenCalled();
    });
  });

  // ─── State Transitions ───

  describe('pause/resume/cancel state transitions', () => {
    it('should set PAUSED status and emit paused event', async () => {
      const workflow = new TestWorkflow(createConfig({ id: 'pause-wf' }));
      const pausedListener = jest.fn();
      workflow.on('paused', pausedListener);

      await workflow.pause();

      expect(workflow.getStatus()).toBe(WorkflowStatus.PAUSED);
      expect(pausedListener).toHaveBeenCalledWith({ workflowId: 'pause-wf' });
    });

    it('should set RUNNING status and emit resumed event', async () => {
      const workflow = new TestWorkflow(createConfig({ id: 'resume-wf' }));
      const resumedListener = jest.fn();
      workflow.on('resumed', resumedListener);

      await workflow.pause();
      await workflow.resume();

      expect(workflow.getStatus()).toBe(WorkflowStatus.RUNNING);
      expect(resumedListener).toHaveBeenCalledWith({ workflowId: 'resume-wf' });
    });

    it('should set CANCELLED status and emit cancelled event', async () => {
      const workflow = new TestWorkflow(createConfig({ id: 'cancel-wf' }));
      const cancelledListener = jest.fn();
      workflow.on('cancelled', cancelledListener);

      await workflow.cancel();

      expect(workflow.getStatus()).toBe(WorkflowStatus.CANCELLED);
      expect(cancelledListener).toHaveBeenCalledWith({ workflowId: 'cancel-wf' });
    });
  });

  // ─── Progress, Duration, CurrentStep ───

  describe('getProgress / getDuration / getCurrentStep', () => {
    it('should return correct progress after steps complete', async () => {
      const stepA = createStep({ id: 'a' });
      const stepB = createStep({ id: 'b' });
      const workflow = new TestWorkflow(createConfig({ steps: [stepA, stepB] }));

      await workflow.execute();

      const progress = workflow.getProgress();
      expect(progress).toEqual({ completed: 2, total: 2, percentage: 100 });
    });

    it('should return zero percentage when there are no steps', () => {
      const workflow = new TestWorkflow(createConfig({ steps: [] }));

      const progress = workflow.getProgress();
      expect(progress).toEqual({ completed: 0, total: 0, percentage: 0 });
    });

    it('should return positive duration after execution', async () => {
      const workflow = new TestWorkflow(createConfig());

      await workflow.execute();

      expect(workflow.getDuration()).toBeGreaterThanOrEqual(0);
    });

    it('should return zero duration before execution', () => {
      const workflow = new TestWorkflow(createConfig());

      expect(workflow.getDuration()).toBe(0);
    });
  });

  // ─── Event Emissions on Steps ───

  describe('step-level event emissions', () => {
    it('should emit stepStarted and stepCompleted for each step', async () => {
      const step = createStep({ id: 'evt-step' });
      const workflow = new TestWorkflow(createConfig({ id: 'wf', steps: [step] }));
      const stepStarted = jest.fn();
      const stepCompleted = jest.fn();
      workflow.on('stepStarted', stepStarted);
      workflow.on('stepCompleted', stepCompleted);

      await workflow.execute();

      expect(stepStarted).toHaveBeenCalledWith({ workflowId: 'wf', stepId: 'evt-step' });
      expect(stepCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'wf', stepId: 'evt-step', success: true })
      );
    });

    it('should emit stepError when step throws', async () => {
      const step = createStep({
        id: 'err-step',
        execute: jest.fn().mockRejectedValue(new Error('step error')),
      });
      const workflow = new TestWorkflow(createConfig({ id: 'wf', steps: [step] }));
      const stepError = jest.fn();
      workflow.on('stepError', stepError);

      await workflow.execute();

      expect(stepError).toHaveBeenCalledWith(
        expect.objectContaining({ stepId: 'err-step', error: expect.stringContaining('step error') })
      );
    });
  });
});
