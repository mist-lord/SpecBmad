import { Orchestrator, WorkflowStepConfig } from '@/core/workflow/orchestrator';

jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() }
}));

jest.mock('@/utils/config', () => ({
  config: { getAll: jest.fn(() => ({})), load: jest.fn() }
}));

jest.mock('@/utils/paths', () => ({
  PATHS: { CONFIG_DIR: '.specbmad', WORKFLOW_STATE_FILE: '.specbmad/workflow.state.json' },
  getProjectPath: jest.fn((p: string) => `/tmp/test/${p}`)
}));

// Mock heavy dependencies to avoid real LLM/agent calls
jest.mock('@/core/llm/manager', () => ({
  llmManager: {
    initialize: jest.fn(),
    getDefaultClient: jest.fn(() => ({
      name: 'Mock',
      generateText: jest.fn(async () => 'mocked response'),
      isAvailable: jest.fn(async () => true)
    }))
  }
}));

jest.mock('@/agents', () => ({
  registerBuiltInAgents: jest.fn()
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => '{}')
}));

jest.mock('@/agents/factory', () => ({
  AgentFactory: {
    create: jest.fn(() => ({
      execute: jest.fn(async () => ({
        success: true,
        output: 'done',
        artifacts: []
      }))
    }))
  }
}));

jest.mock('@/core/phase/gates', () => ({
  registerDefaultGates: jest.fn()
}));

jest.mock('@/core/phase/controller', () => ({
  PhaseController: jest.fn().mockImplementation(() => ({
    getCurrentPhase: jest.fn(() => 0),
    transitionTo: jest.fn(async () => ({
      success: true,
      timestamp: new Date().toISOString(),
      gateResults: []
    }))
  }))
}));

jest.mock('@/core/events/store', () => ({
  EventStore: jest.fn().mockImplementation(() => ({
    appendEvent: jest.fn()
  }))
}));

jest.mock('@/core/spec/spec-kit', () => ({
  specKit: {
    execute: jest.fn(async () => ({
      success: true,
      outputPath: '/tmp/spec.md'
    }))
  }
}));

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new Orchestrator();
  });

  describe('getWorkflowDefinition()', () => {
    it('should return default/full-development workflow', () => {
      const def = orchestrator.getWorkflowDefinition('default');
      expect(def.name).toBe('default');
      expect(def.steps).toHaveLength(4);
      expect(def.steps[0].agent).toBe('Analyst');
      expect(def.steps[1].agent).toBe('Architect');
      expect(def.steps[2].agent).toBe('Developer');
      expect(def.steps[3].agent).toBe('QA');
    });

    it('should return quick workflow (3 steps)', () => {
      const def = orchestrator.getWorkflowDefinition('quick');
      expect(def.steps).toHaveLength(3);
      expect(def.steps.map(s => s.id)).toEqual(['capture', 'design', 'build']);
    });

    it('should return design-only workflow (2 steps)', () => {
      const def = orchestrator.getWorkflowDefinition('design-only');
      expect(def.steps).toHaveLength(2);
      expect(def.steps.map(s => s.id)).toEqual(['capture', 'design']);
    });

    it('should return empty steps for unknown workflow', () => {
      const def = orchestrator.getWorkflowDefinition('non-existent');
      expect(def.steps).toEqual([]);
    });

    it('should read custom workflow from config if available', () => {
      const { config } = require('@/utils/config');
      config.getAll.mockReturnValue({
        workflows: {
          custom: {
            description: 'Custom flow',
            steps: [{ id: 'step1', name: 'Step 1', agent: 'Analyst' }]
          }
        }
      });

      const def = orchestrator.getWorkflowDefinition('custom');
      expect(def.steps).toHaveLength(1);
      expect(def.steps[0].id).toBe('step1');
    });
  });

  describe('resolveExecutionOrder()', () => {
    // Access private method via any cast
    const resolve = (steps: WorkflowStepConfig[]) =>
      (orchestrator as any).resolveExecutionOrder(steps);

    it('should return steps in order when no dependencies', () => {
      const steps: WorkflowStepConfig[] = [
        { id: 'a', name: 'A', agent: 'X' },
        { id: 'b', name: 'B', agent: 'Y' }
      ];
      const ordered = resolve(steps);
      expect(ordered.map((s: any) => s.id)).toEqual(['a', 'b']);
    });

    it('should sort by dependencies', () => {
      const steps: WorkflowStepConfig[] = [
        { id: 'build', name: 'Build', agent: 'Developer', dependencies: ['design'] },
        { id: 'design', name: 'Design', agent: 'Architect' },
        { id: 'review', name: 'Review', agent: 'QA', dependencies: ['build'] }
      ];
      const ordered = resolve(steps);
      const ids = ordered.map((s: any) => s.id);
      expect(ids.indexOf('design')).toBeLessThan(ids.indexOf('build'));
      expect(ids.indexOf('build')).toBeLessThan(ids.indexOf('review'));
    });

    it('should detect circular dependencies', () => {
      const steps: WorkflowStepConfig[] = [
        { id: 'a', name: 'A', agent: 'X', dependencies: ['b'] },
        { id: 'b', name: 'B', agent: 'Y', dependencies: ['a'] }
      ];
      expect(() => resolve(steps)).toThrow(/循环依赖|无法满足/);
    });

    it('should detect non-existent dependencies', () => {
      const steps: WorkflowStepConfig[] = [
        { id: 'a', name: 'A', agent: 'X', dependencies: ['missing'] }
      ];
      expect(() => resolve(steps)).toThrow(/不存在/);
    });
  });

  describe('executeWorkflow()', () => {
    it('should throw for empty workflow', async () => {
      const ctx = {
        projectState: { projectName: 'Test', workflow: { currentStep: '', completedSteps: [] } },
        workingDirectory: '/tmp'
      } as any;

      await expect(orchestrator.executeWorkflow('non-existent', ctx))
        .rejects.toThrow('工作流未定义或为空');
    });

    it('should skip pre-completed steps in resume mode', async () => {
      const { AgentFactory } = require('@/agents/factory');
      const mockExecute = jest.fn(async () => ({
        success: true,
        output: 'done',
        artifacts: []
      }));
      AgentFactory.create.mockReturnValue({ execute: mockExecute });

      const ctx = {
        projectState: {
          projectName: 'Test',
          workflow: {
            currentStep: 'design',
            completedSteps: ['capture']
          }
        },
        workingDirectory: '/tmp'
      } as any;

      const results = await orchestrator.executeWorkflow('default', ctx);

      // 'capture' was already completed so should be skipped; remaining 3 steps executed
      expect(results).toHaveLength(3);
      // AgentFactory.create should have been called for design, build, review but NOT capture
      const createdAgents = AgentFactory.create.mock.calls.map((c: any[]) => c[0]);
      expect(createdAgents).not.toContain('Analyst');
      expect(createdAgents).toContain('Architect');
      expect(createdAgents).toContain('Developer');
      expect(createdAgents).toContain('QA');
    });

    it('should execute all steps when no pre-completed steps', async () => {
      const { AgentFactory } = require('@/agents/factory');
      const mockExecute = jest.fn(async () => ({
        success: true,
        output: 'done',
        artifacts: []
      }));
      AgentFactory.create.mockReturnValue({ execute: mockExecute });

      const ctx = {
        projectState: {
          projectName: 'Test',
          workflow: { currentStep: '', completedSteps: [] }
        },
        workingDirectory: '/tmp'
      } as any;

      const results = await orchestrator.executeWorkflow('default', ctx);

      expect(results).toHaveLength(4);
      const createdAgents = AgentFactory.create.mock.calls.map((c: any[]) => c[0]);
      expect(createdAgents).toEqual(['Analyst', 'Architect', 'Developer', 'QA']);
    });

    it('should persist failed state when a step throws', async () => {
      const { AgentFactory } = require('@/agents/factory');
      const fs = require('fs');
      AgentFactory.create.mockReturnValue({
        execute: jest.fn(async () => { throw new Error('agent boom'); })
      });

      const ctx = {
        projectState: {
          projectName: 'Test',
          workflow: { currentStep: '', completedSteps: [] }
        },
        workingDirectory: '/tmp'
      } as any;

      await expect(orchestrator.executeWorkflow('default', ctx))
        .rejects.toThrow('agent boom');

      // Should have persisted failed state
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenPayload = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(writtenPayload.status).toBe('failed');
    });
  });

  describe('executePhaseWorkflow()', () => {
    const makeContext = (overrides: any = {}) => ({
      projectState: {
        projectName: 'Test',
        workflow: { currentStep: '', completedSteps: [] }
      },
      workingDirectory: '/tmp',
      inputData: {},
      ...overrides
    } as any);

    it('should call specKit.execute when requirement data is provided (Phase 0)', async () => {
      const { specKit } = require('@/core/spec/spec-kit');
      specKit.execute.mockResolvedValue({ success: true, outputPath: '/tmp/spec.md' });

      const ctx = makeContext({ inputData: { requirement: 'Build a TODO app' } });
      const results = await orchestrator.executePhaseWorkflow(ctx, 0, 0);

      expect(specKit.execute).toHaveBeenCalledWith({ input: 'Build a TODO app' });
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].output).toContain('需求已捕获');
    });

    it('should create Analyst agent when no requirement (Phase 0)', async () => {
      const { AgentFactory } = require('@/agents/factory');
      const mockExecute = jest.fn(async () => ({
        success: true,
        output: 'analyzed',
        artifacts: []
      }));
      AgentFactory.create.mockReturnValue({ execute: mockExecute });

      const ctx = makeContext();
      const results = await orchestrator.executePhaseWorkflow(ctx, 0, 0);

      expect(AgentFactory.create).toHaveBeenCalledWith('Analyst', expect.anything());
      expect(results).toHaveLength(1);
    });

    it('should throw when specKit fails (Phase 0)', async () => {
      const { specKit } = require('@/core/spec/spec-kit');
      specKit.execute.mockResolvedValue({ success: false, error: 'parse error' });

      const ctx = makeContext({ inputData: { requirement: 'something' } });

      await expect(orchestrator.executePhaseWorkflow(ctx, 0, 0))
        .rejects.toThrow('需求捕获失败: parse error');
    });

    it('should create Architect agent for Phase 1', async () => {
      const { AgentFactory } = require('@/agents/factory');
      const mockExecute = jest.fn(async () => ({
        success: true,
        output: 'designed',
        artifacts: []
      }));
      AgentFactory.create.mockReturnValue({ execute: mockExecute });

      const ctx = makeContext();
      const results = await orchestrator.executePhaseWorkflow(ctx, 1, 1);

      expect(AgentFactory.create).toHaveBeenCalledWith('Architect', expect.anything());
      expect(results).toHaveLength(1);
    });

    it('should create Developer agent for Phase 2', async () => {
      const { AgentFactory } = require('@/agents/factory');
      const mockExecute = jest.fn(async () => ({
        success: true,
        output: 'built',
        artifacts: []
      }));
      AgentFactory.create.mockReturnValue({ execute: mockExecute });

      const ctx = makeContext();
      const results = await orchestrator.executePhaseWorkflow(ctx, 2, 2);

      expect(AgentFactory.create).toHaveBeenCalledWith('Developer', expect.anything());
      expect(results).toHaveLength(1);
    });

    it('should create QA agent for Phase 3', async () => {
      const { AgentFactory } = require('@/agents/factory');
      const mockExecute = jest.fn(async () => ({
        success: true,
        output: 'reviewed',
        artifacts: []
      }));
      AgentFactory.create.mockReturnValue({ execute: mockExecute });

      const ctx = makeContext();
      const results = await orchestrator.executePhaseWorkflow(ctx, 3, 3);

      expect(AgentFactory.create).toHaveBeenCalledWith('QA', expect.anything());
      expect(results).toHaveLength(1);
    });

    it('should execute full phase 0→3 workflow', async () => {
      const { AgentFactory } = require('@/agents/factory');
      const { specKit } = require('@/core/spec/spec-kit');
      specKit.execute.mockResolvedValue({ success: true, outputPath: '/tmp/spec.md' });

      const mockExecute = jest.fn(async () => ({
        success: true,
        output: 'done',
        artifacts: []
      }));
      AgentFactory.create.mockReturnValue({ execute: mockExecute });

      const ctx = makeContext({ inputData: { requirement: 'full workflow' } });
      const results = await orchestrator.executePhaseWorkflow(ctx, 0, 3);

      // Phase 0 uses specKit, phases 1-3 use agents
      expect(specKit.execute).toHaveBeenCalled();
      expect(AgentFactory.create).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(4);
    });

    it('should throw on phase transition failure', async () => {
      const { AgentFactory } = require('@/agents/factory');
      const { PhaseController } = require('@/core/phase/controller');

      const mockController = {
        getCurrentPhase: jest.fn(() => 0),
        transitionTo: jest.fn(async () => ({
          success: false,
          error: 'gate check failed',
          timestamp: new Date().toISOString(),
          gateResults: []
        }))
      };
      PhaseController.mockImplementation(() => mockController);

      const mockExecute = jest.fn(async () => ({
        success: true,
        output: 'done',
        artifacts: []
      }));
      AgentFactory.create.mockReturnValue({ execute: mockExecute });

      const ctx = makeContext();
      // Executing phase 0→1 should fail at transition
      await expect(orchestrator.executePhaseWorkflow(ctx, 0, 1))
        .rejects.toThrow('Phase 迁移失败: gate check failed');
    });

    it('should execute only a subset of phases (startPhase=1, endPhase=2)', async () => {
      const { AgentFactory } = require('@/agents/factory');
      const { PhaseController } = require('@/core/phase/controller');

      // Ensure PhaseController returns a successful transition (reset from prior test)
      PhaseController.mockImplementation(() => ({
        getCurrentPhase: jest.fn(() => 0),
        transitionTo: jest.fn(async () => ({
          success: true,
          timestamp: new Date().toISOString(),
          gateResults: []
        }))
      }));

      const mockExecute = jest.fn(async () => ({
        success: true,
        output: 'done',
        artifacts: []
      }));
      AgentFactory.create.mockReturnValue({ execute: mockExecute });

      const ctx = makeContext();
      const results = await orchestrator.executePhaseWorkflow(ctx, 1, 2);

      expect(results).toHaveLength(2);
      const createdAgents = AgentFactory.create.mock.calls.map((c: any[]) => c[0]);
      expect(createdAgents).toEqual(['Architect', 'Developer']);
    });

    it('should throw when no LLM client is available', async () => {
      const { llmManager } = require('@/core/llm/manager');
      llmManager.getDefaultClient.mockReturnValueOnce(null);

      const ctx = makeContext();

      await expect(orchestrator.executePhaseWorkflow(ctx, 0, 0))
        .rejects.toThrow('未找到可用的默认 LLM 客户端');
    });
  });

  describe('executeWithRetry()', () => {
    const callRetry = (agent: any, context: any, step: any) =>
      (orchestrator as any).executeWithRetry(agent, context, step);

    const makeStep = (retries: number = 0, retryDelayMs: number = 1): WorkflowStepConfig => ({
      id: 'test-step',
      name: 'Test Step',
      agent: 'TestAgent',
      input: { retries, retryDelayMs }
    });

    const dummyContext = {
      projectState: { projectName: 'Test', workflow: { currentStep: '', completedSteps: [] } },
      workingDirectory: '/tmp'
    } as any;

    it('should succeed on first attempt', async () => {
      const agent = {
        execute: jest.fn(async () => ({ success: true, output: 'ok', artifacts: [] }))
      };

      const result = await callRetry(agent, dummyContext, makeStep(0));

      expect(result.success).toBe(true);
      expect(agent.execute).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure then succeed', async () => {
      const agent = {
        execute: jest.fn()
          .mockRejectedValueOnce(new Error('transient'))
          .mockResolvedValueOnce({ success: true, output: 'recovered', artifacts: [] })
      };

      const result = await callRetry(agent, dummyContext, makeStep(1, 1));

      expect(result.success).toBe(true);
      expect(result.output).toBe('recovered');
      expect(agent.execute).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exceeded', async () => {
      const agent = {
        execute: jest.fn().mockRejectedValue(new Error('persistent failure'))
      };

      await expect(callRetry(agent, dummyContext, makeStep(2, 1)))
        .rejects.toThrow('persistent failure');

      // 1 initial + 2 retries = 3 attempts
      expect(agent.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('persistWorkflowState() error handling', () => {
    it('should not crash when fs.writeFileSync throws', () => {
      const fs = require('fs');
      const { log } = require('@/utils/logger');

      fs.writeFileSync.mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      // Call private method - should not throw
      expect(() => {
        (orchestrator as any).persistWorkflowState(
          'default', 'step1', ['step1'], 'running', undefined, null
        );
      }).not.toThrow();

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('disk full')
      );
    });
  });

  describe('sampleResources()', () => {
    it('should capture memory and cpu metrics', () => {
      const sample = (orchestrator as any).sampleResources('before', 'step1');
      expect(sample).toHaveProperty('ts');
      expect(sample).toHaveProperty('phase', 'before');
      expect(sample).toHaveProperty('stepId', 'step1');
      expect(sample.memory).toHaveProperty('rss');
      expect(sample.memory).toHaveProperty('heapTotal');
      expect(sample.memory).toHaveProperty('heapUsed');
      expect(sample.cpu).toHaveProperty('user');
      expect(sample.cpu).toHaveProperty('system');
      expect(sample.gc).toHaveProperty('count');
    });
  });
});
