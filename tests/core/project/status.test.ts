/**
 * Tests for ProjectStatusManager
 *
 * @see src/core/project/status.ts
 */

import path from 'path';

// --- Mock fs before importing source ---
const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
};
jest.mock('fs', () => ({ default: mockFs, ...mockFs }));

// --- Mock logger ---
jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    success: jest.fn(),
  },
}));

// --- Mock config ---
const mockConfigData: Record<string, any> = {
  projectName: 'test-project',
  version: '1.0.0',
  description: 'A test project',
};
const mockConfigObj = {
  load: jest.fn().mockReturnValue(mockConfigData),
  get: jest.fn((key: string) => mockConfigData[key]),
  set: jest.fn(),
  save: jest.fn(),
  getAll: jest.fn(() => mockConfigData),
};
jest.mock('@/utils/config', () => ({
  config: mockConfigObj,
}));

// --- Mock paths ---
jest.mock('@/utils/paths', () => ({
  PATHS: {
    STATUS_FILE: '.specbmad/status.json',
    ARTIFACTS_DIR: '.specbmad/artifacts',
    SPECIFICATIONS_DIR: '.specbmad/specifications',
    WORKFLOW_STATE_FILE: '.specbmad/workflow.state.json',
  },
  getProjectPath: jest.fn((rel: string) => `/fake/root/${rel}`),
}));

// --- Mock dynamic imports ---
const mockLlmManager = {
  initialize: jest.fn().mockResolvedValue(undefined),
  getClientStatus: jest.fn().mockResolvedValue([
    { name: 'claude', available: true },
    { name: 'openai', available: false },
  ]),
};
jest.mock('@/core/llm/manager', () => ({
  llmManager: mockLlmManager,
}));

const mockAgentFactory = {
  getAvailableAgents: jest.fn().mockReturnValue(['Analyst', 'Architect']),
};
jest.mock('@/agents/factory', () => ({
  AgentFactory: mockAgentFactory,
}));

import { ProjectStatusManager, ProjectStatusInfo } from '@/core/project/status';
import { log } from '@/utils/logger';

describe('ProjectStatusManager', () => {
  let manager: ProjectStatusManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: project is initialized
    mockFs.existsSync.mockReturnValue(false);
    manager = new ProjectStatusManager('/fake/root');
  });

  // ---------------------------------------------------------------
  // isInitialized
  // ---------------------------------------------------------------
  describe('isInitialized', () => {
    it('should return true when .specbmad.json exists', () => {
      mockFs.existsSync.mockImplementation((p: string) =>
        p === path.join('/fake/root', '.specbmad.json')
      );

      expect(manager.isInitialized()).toBe(true);
    });

    it('should return false when .specbmad.json does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(manager.isInitialized()).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // getStatus
  // ---------------------------------------------------------------
  describe('getStatus', () => {
    beforeEach(() => {
      // Make isInitialized return true by default for getStatus tests
      mockFs.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.endsWith('.specbmad.json')) return true;
        return false;
      });
    });

    it('should aggregate all sub-statuses into a ProjectStatusInfo', async () => {
      const status = await manager.getStatus();

      expect(status).toHaveProperty('project');
      expect(status).toHaveProperty('tasks');
      expect(status).toHaveProperty('files');
      expect(status).toHaveProperty('agents');
      expect(status).toHaveProperty('lastActivity');
      expect(status).toHaveProperty('health');
      expect(status).toHaveProperty('issues');
    });

    it('should call evaluateHealth and getHealthIssues on the result', async () => {
      const status = await manager.getStatus();

      // With initialized project and agents available, should be healthy
      expect(status.health).toBe('healthy');
      expect(Array.isArray(status.issues)).toBe(true);
    });

    it('should throw and log error when a sub-status call fails', async () => {
      // Make config.load throw to break getProjectInfo
      mockConfigObj.load.mockImplementationOnce(() => {
        throw new Error('Config load failed');
      });

      await expect(manager.getStatus()).rejects.toThrow('Config load failed');
      expect(log.error).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // saveStatus
  // ---------------------------------------------------------------
  describe('saveStatus', () => {
    it('should create directory if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await manager.saveStatus({ health: 'healthy' });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it('should read existing status file and merge with new status', async () => {
      const existing = { health: 'warning', issues: ['old issue'] };

      mockFs.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('status.json')) return true;
        // directory exists
        return true;
      });
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existing));

      await manager.saveStatus({ health: 'healthy' });

      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
      const writtenContent = JSON.parse(
        (mockFs.writeFileSync as jest.Mock).mock.calls[0][1]
      );
      // New health value should override old
      expect(writtenContent.health).toBe('healthy');
      // Old issues should remain via spread
      expect(writtenContent.issues).toEqual(['old issue']);
      // lastActivity should be set
      expect(writtenContent.lastActivity).toBeDefined();
    });

    it('should handle missing existing file gracefully', async () => {
      mockFs.existsSync.mockImplementation((p: string) => {
        // Directory exists but status file does not
        if (typeof p === 'string' && p.includes('status.json')) return false;
        return true;
      });

      await manager.saveStatus({ health: 'healthy' });

      expect(mockFs.readFileSync).not.toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
      const writtenContent = JSON.parse(
        (mockFs.writeFileSync as jest.Mock).mock.calls[0][1]
      );
      expect(writtenContent.health).toBe('healthy');
    });

    it('should throw when writeFileSync fails', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      await expect(manager.saveStatus({ health: 'error' })).rejects.toThrow('Disk full');
      expect(log.error).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // updateTaskStatus
  // ---------------------------------------------------------------
  describe('updateTaskStatus', () => {
    it('should call getStatus then saveStatus', async () => {
      // Setup so getStatus works
      mockFs.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.endsWith('.specbmad.json')) return true;
        return false;
      });

      const getStatusSpy = jest.spyOn(manager, 'getStatus');
      const saveStatusSpy = jest.spyOn(manager, 'saveStatus').mockResolvedValue(undefined);

      await manager.updateTaskStatus('task-1', 'completed' as any);

      expect(getStatusSpy).toHaveBeenCalled();
      expect(saveStatusSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tasks: expect.any(Object),
          lastActivity: expect.any(Date),
        })
      );

      getStatusSpy.mockRestore();
      saveStatusSpy.mockRestore();
    });

    it('should throw when getStatus fails', async () => {
      jest.spyOn(manager, 'getStatus').mockRejectedValueOnce(new Error('status error'));

      await expect(manager.updateTaskStatus('task-1', 'pending' as any)).rejects.toThrow('status error');
    });
  });

  // ---------------------------------------------------------------
  // recordActivity
  // ---------------------------------------------------------------
  describe('recordActivity', () => {
    it('should call saveStatus with lastActivity', async () => {
      const saveStatusSpy = jest.spyOn(manager, 'saveStatus').mockResolvedValue(undefined);

      await manager.recordActivity('deployment', { env: 'staging' });

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('deployment'),
        expect.objectContaining({ env: 'staging' })
      );
      expect(saveStatusSpy).toHaveBeenCalledWith(
        expect.objectContaining({ lastActivity: expect.any(Date) })
      );

      saveStatusSpy.mockRestore();
    });

    it('should not throw when saveStatus fails (swallows error)', async () => {
      jest.spyOn(manager, 'saveStatus').mockRejectedValueOnce(new Error('write fail'));

      // recordActivity catches errors internally - should not throw
      await expect(manager.recordActivity('test')).resolves.toBeUndefined();
      expect(log.error).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // getTasksStatus
  // ---------------------------------------------------------------
  describe('getTasksStatus', () => {
    it('should parse markdown checkboxes from tasks.md', async () => {
      mockFs.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('tasks.md')) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(
        '- [ ] Task A\n- [x] Task B\n- [X] Task C\n- [ ] Task D\n'
      );

      const tasks = await manager.getTasksStatus();

      expect(tasks.pending).toBe(2);
      expect(tasks.completed).toBe(2);
      expect(tasks.total).toBe(4);
    });

    it('should detect blocked and in-progress lines', async () => {
      mockFs.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('tasks.md')) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(
        '- [ ] Task A\nStatus: blocked\nStatus: In Progress\n'
      );

      const tasks = await manager.getTasksStatus();

      expect(tasks.blocked).toBe(1);
      expect(tasks.inProgress).toBe(1);
    });

    it('should read workflow state completedSteps', async () => {
      mockFs.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('workflow.state.json')) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ completedSteps: ['step1', 'step2', 'step3'] })
      );

      const tasks = await manager.getTasksStatus();

      expect(tasks.completed).toBe(3);
      expect(tasks.total).toBe(3);
    });

    it('should handle both tasks.md and workflow state simultaneously', async () => {
      let callCount = 0;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('tasks.md')) {
          return '- [x] Done task\n- [ ] Pending task\n';
        }
        if (typeof p === 'string' && p.includes('workflow.state.json')) {
          return JSON.stringify({ completedSteps: ['s1'] });
        }
        return '{}';
      });

      const tasks = await manager.getTasksStatus();

      expect(tasks.completed).toBe(2); // 1 from tasks.md + 1 from workflow
      expect(tasks.pending).toBe(1);
      expect(tasks.total).toBe(3);
    });

    it('should return zero counts when no files exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const tasks = await manager.getTasksStatus();

      expect(tasks.total).toBe(0);
      expect(tasks.pending).toBe(0);
      expect(tasks.completed).toBe(0);
      expect(tasks.blocked).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // getFilesStatus
  // ---------------------------------------------------------------
  describe('getFilesStatus', () => {
    it('should read specification files from specs directory', async () => {
      mockFs.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('specifications')) return true;
        return false;
      });
      mockFs.readdirSync.mockReturnValue([
        { name: 'req.md', isFile: () => true, isDirectory: () => false },
        { name: 'schema.json', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true },
      ]);

      const files = await manager.getFilesStatus();

      expect(files.specifications).toHaveLength(2);
      expect(files.specifications[0]).toContain('req.md');
      expect(files.specifications[1]).toContain('schema.json');
    });

    it('should categorize artifact files by name keywords', async () => {
      mockFs.existsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('artifacts')) return true;
        return false;
      });
      mockFs.readdirSync.mockReturnValue([
        { name: 'spec-overview.md', isFile: () => true, isDirectory: () => false },
        { name: 'planning-doc.md', isFile: () => true, isDirectory: () => false },
        { name: 'implementation-v1.ts', isFile: () => true, isDirectory: () => false },
        { name: 'test-results.md', isFile: () => true, isDirectory: () => false },
      ]);

      const files = await manager.getFilesStatus();

      expect(files.specifications.length).toBeGreaterThanOrEqual(1);
      expect(files.plans.length).toBeGreaterThanOrEqual(1);
      expect(files.implementations.length).toBeGreaterThanOrEqual(1);
      expect(files.tests.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty arrays when directories do not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const files = await manager.getFilesStatus();

      expect(files.specifications).toEqual([]);
      expect(files.plans).toEqual([]);
      expect(files.implementations).toEqual([]);
      expect(files.tests).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // getAgentsStatus
  // ---------------------------------------------------------------
  describe('getAgentsStatus', () => {
    it('should return available agents from llmManager and AgentFactory', async () => {
      const agents = await manager.getAgentsStatus();

      expect(mockLlmManager.initialize).toHaveBeenCalled();
      expect(mockLlmManager.getClientStatus).toHaveBeenCalled();
      expect(mockAgentFactory.getAvailableAgents).toHaveBeenCalled();

      // 'claude' is available from llmManager, 'openai' is not
      expect(agents.available).toContain('claude');
      expect(agents.available).not.toContain('openai');
      // 'Analyst' and 'Architect' from AgentFactory
      expect(agents.available).toContain('Analyst');
      expect(agents.available).toContain('Architect');
    });

    it('should handle import failure gracefully and return empty arrays', async () => {
      mockLlmManager.initialize.mockRejectedValueOnce(new Error('Module not found'));

      const agents = await manager.getAgentsStatus();

      expect(agents.available).toEqual([]);
      expect(agents.active).toEqual([]);
      expect(log.debug).toHaveBeenCalled();
    });

    it('should include agents from project config', async () => {
      mockConfigObj.load.mockReturnValue({
        ...mockConfigData,
        agents: {
          CustomAgent: { enabled: true },
          DisabledAgent: { enabled: false },
        },
      });

      const agents = await manager.getAgentsStatus();

      expect(agents.available).toContain('CustomAgent');
      expect(agents.available).not.toContain('DisabledAgent');
    });
  });

  // ---------------------------------------------------------------
  // evaluateHealth (tested indirectly via getStatus)
  // ---------------------------------------------------------------
  describe('evaluateHealth', () => {
    // Access private method via casting for focused unit tests
    const callEvaluateHealth = (mgr: any, status: ProjectStatusInfo) =>
      mgr.evaluateHealth(status);

    const baseStatus: ProjectStatusInfo = {
      project: { name: 'test' },
      tasks: { total: 5, pending: 2, inProgress: 1, completed: 2, blocked: 0, cancelled: 0 },
      files: { specifications: [], plans: [], implementations: [], tests: [] },
      agents: { available: ['claude'], active: [] },
      lastActivity: new Date(),
      health: 'healthy',
      issues: [],
    };

    it('should return "healthy" when no issues exist', () => {
      // isInitialized must return true
      mockFs.existsSync.mockReturnValue(true);

      const result = callEvaluateHealth(manager, baseStatus);

      expect(result).toBe('healthy');
    });

    it('should return "warning" when issues exist but none are errors', () => {
      mockFs.existsSync.mockReturnValue(false); // not initialized -> issue

      const statusWithNoAgents = {
        ...baseStatus,
        agents: { available: ['a'], active: [] },
      };

      const result = callEvaluateHealth(manager, statusWithNoAgents);

      expect(result).toBe('warning');
    });

    it('should return "error" when issues contain error keywords', () => {
      // Force getHealthIssues to return an issue containing error keywords
      mockFs.existsSync.mockReturnValue(false); // not initialized

      // We need an issue with error keyword. The Chinese word for error is in issues.
      // Make agents empty to get '没有可用的AI代理' which does not have error keywords
      // We need to mock getHealthIssues to produce error keywords
      // Actually, evaluateHealth calls getHealthIssues internally.
      // The only way to get error keywords is if the issue text contains '错误' or '失败'
      // None of the built-in issues contain these. Let's test via a direct approach.
      const spy = jest.spyOn(manager as any, 'getHealthIssues').mockReturnValue([
        '系统错误: 无法连接数据库',
      ]);

      const result = callEvaluateHealth(manager, baseStatus);

      expect(result).toBe('error');
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------
  // getHealthIssues (tested indirectly via getStatus)
  // ---------------------------------------------------------------
  describe('getHealthIssues', () => {
    const callGetHealthIssues = (mgr: any, status: ProjectStatusInfo) =>
      mgr.getHealthIssues(status);

    const baseStatus: ProjectStatusInfo = {
      project: { name: 'test' },
      tasks: { total: 5, pending: 2, inProgress: 1, completed: 2, blocked: 0, cancelled: 0 },
      files: { specifications: [], plans: [], implementations: [], tests: [] },
      agents: { available: ['claude'], active: [] },
      lastActivity: new Date(),
      health: 'healthy',
      issues: [],
    };

    it('should detect project not initialized', () => {
      mockFs.existsSync.mockReturnValue(false);

      const issues = callGetHealthIssues(manager, baseStatus);

      expect(issues).toEqual(expect.arrayContaining([
        expect.stringContaining('初始化'),
      ]));
    });

    it('should detect no available agents', () => {
      mockFs.existsSync.mockReturnValue(true); // initialized

      const statusNoAgents = {
        ...baseStatus,
        agents: { available: [], active: [] },
      };
      const issues = callGetHealthIssues(manager, statusNoAgents);

      expect(issues).toEqual(expect.arrayContaining([
        expect.stringContaining('代理'),
      ]));
    });

    it('should detect blocked tasks', () => {
      mockFs.existsSync.mockReturnValue(true);

      const statusBlocked = {
        ...baseStatus,
        tasks: { ...baseStatus.tasks, blocked: 3 },
      };
      const issues = callGetHealthIssues(manager, statusBlocked);

      expect(issues).toEqual(expect.arrayContaining([
        expect.stringContaining('3'),
      ]));
    });

    it('should detect inactivity greater than 7 days', () => {
      mockFs.existsSync.mockReturnValue(true);

      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const statusInactive = {
        ...baseStatus,
        lastActivity: eightDaysAgo,
      };
      const issues = callGetHealthIssues(manager, statusInactive);

      expect(issues).toEqual(expect.arrayContaining([
        expect.stringContaining('7'),
      ]));
    });

    it('should return empty array when project is healthy', () => {
      mockFs.existsSync.mockReturnValue(true); // initialized

      const issues = callGetHealthIssues(manager, baseStatus);

      expect(issues).toEqual([]);
    });
  });
});
