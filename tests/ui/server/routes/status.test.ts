jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() },
}));

const mockGetTasksStatus = jest.fn().mockResolvedValue([{ name: 'task-1', status: 'done' }]);
const mockGetAgentsStatus = jest.fn().mockResolvedValue([{ name: 'Analyst', active: true }]);
const mockGetFilesStatus = jest.fn().mockResolvedValue([{ path: 'src/index.ts', modified: true }]);

jest.mock('@/core/project/status', () => ({
  ProjectStatusManager: jest.fn().mockImplementation(() => ({
    getTasksStatus: mockGetTasksStatus,
    getAgentsStatus: mockGetAgentsStatus,
    getFilesStatus: mockGetFilesStatus,
  })),
}));

jest.mock('@/utils/config', () => ({
  ConfigManager: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockReturnValue({
      projectName: 'test-project',
      language: 'typescript',
      framework: 'express',
      type: 'web',
    }),
  })),
}));

import { Request, Response, NextFunction } from 'express';
import { statusRouter } from '@/ui/server/routes/status';

function createMockRes(): Response {
  const res: Partial<Response> = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  };
  return res as Response;
}

function createMockReq(overrides: Partial<Request> = {}): Request {
  return { ...overrides } as Request;
}

const mockNext: NextFunction = jest.fn();

describe('statusRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be a Router', () => {
    expect(statusRouter).toBeDefined();
    expect(typeof statusRouter).toBe('function');
  });

  it('should have GET / route handler', () => {
    const getRoutes = statusRouter.stack
      .filter((layer: any) => layer.route && layer.route.methods.get)
      .map((layer: any) => layer.route.path);
    expect(getRoutes).toContain('/');
  });

  it('GET / should return project status', async () => {
    const layer = statusRouter.stack
      .find((l: any) => l.route?.path === '/' && l.route?.methods.get);
    const handler = layer?.route?.stack[0]?.handle;

    expect(handler).toBeDefined();

    const req = createMockReq();
    const res = createMockRes();

    await handler!(req, res, mockNext);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        project: expect.objectContaining({
          name: 'test-project',
          language: 'typescript',
        }),
        status: expect.objectContaining({
          tasks: expect.any(Array),
          agents: expect.any(Array),
          files: expect.any(Array),
        }),
        timestamp: expect.any(String),
      })
    );
  });

  it('GET / should return 500 on error', async () => {
    mockGetTasksStatus.mockRejectedValueOnce(new Error('Status fetch failed'));

    const layer = statusRouter.stack
      .find((l: any) => l.route?.path === '/' && l.route?.methods.get);
    const handler = layer?.route?.stack[0]?.handle;

    const req = createMockReq();
    const res = createMockRes();

    await handler!(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Status fetch failed' })
    );
  });
});
