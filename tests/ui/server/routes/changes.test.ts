const mockListProposals = jest.fn().mockReturnValue([]);
const mockGetProposal = jest.fn();
const mockCreateProposal = jest.fn();
const mockUpdateStatus = jest.fn();
const mockApplyProposal = jest.fn();
const mockGetProgress = jest.fn();

jest.mock('@/core/change/manager', () => ({
  changeManager: {
    listProposals: mockListProposals,
    getProposal: mockGetProposal,
    createProposal: mockCreateProposal,
    updateStatus: mockUpdateStatus,
    applyProposal: mockApplyProposal,
    getProgress: mockGetProgress,
  },
}));

import { Request, Response, NextFunction } from 'express';
import { changesRouter } from '@/ui/server/routes/changes';

const mockNext: NextFunction = jest.fn();

function createMockRes(): Response {
  const res: Partial<Response> = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  };
  return res as Response;
}

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findHandler(routePath: string, method: string = 'get'): any {
  const layer = changesRouter.stack
    .find((l: any) => l.route?.path === routePath && l.route?.methods[method]);
  const handler = layer?.route?.stack[0]?.handle;
  if (!handler) throw new Error(`No handler found for ${method.toUpperCase()} ${routePath}`);
  return handler;
}

describe('changesRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('should list all proposals', () => {
      const proposals = [{ id: 'CP-1', title: 'Test' }];
      mockListProposals.mockReturnValue(proposals);

      const handler = findHandler('/');
      const req = createMockReq();
      const res = createMockRes();

      handler(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(proposals);
    });

    it('should return 500 on error', () => {
      mockListProposals.mockImplementation(() => { throw new Error('DB error'); });

      const handler = findHandler('/');
      const req = createMockReq();
      const res = createMockRes();

      handler(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /:id', () => {
    it('should return proposal by id', () => {
      const proposal = { id: 'CP-1', title: 'Test' };
      mockGetProposal.mockReturnValue(proposal);

      const handler = findHandler('/:id');
      const req = createMockReq({ params: { id: 'CP-1' } as any });
      const res = createMockRes();

      handler(req, res, mockNext);

      expect(mockGetProposal).toHaveBeenCalledWith('CP-1');
      expect(res.json).toHaveBeenCalledWith(proposal);
    });

    it('should return 404 for missing proposal', () => {
      mockGetProposal.mockReturnValue(null);

      const handler = findHandler('/:id');
      const req = createMockReq({ params: { id: 'CP-999' } as any });
      const res = createMockRes();

      handler(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /', () => {
    it('should create a new proposal', () => {
      const created = { id: 'CP-new', title: 'New', status: 'draft' };
      mockCreateProposal.mockReturnValue(created);

      const handler = findHandler('/', 'post');
      const req = createMockReq({ body: { title: 'New', description: 'Desc' } });
      const res = createMockRes();

      handler(req, res, mockNext);

      expect(mockCreateProposal).toHaveBeenCalledWith('New', 'Desc');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it('should return 400 when title is missing', () => {
      const handler = findHandler('/', 'post');
      const req = createMockReq({ body: {} });
      const res = createMockRes();

      handler(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should use empty string as default description', () => {
      mockCreateProposal.mockReturnValue({ id: 'CP-x' });

      const handler = findHandler('/', 'post');
      const req = createMockReq({ body: { title: 'Title only' } });
      const res = createMockRes();

      handler(req, res, mockNext);

      expect(mockCreateProposal).toHaveBeenCalledWith('Title only', '');
    });
  });

  describe('PATCH /:id/status', () => {
    it('should update proposal status', () => {
      const handler = findHandler('/:id/status', 'patch');
      const req = createMockReq({
        params: { id: 'CP-1' } as any,
        body: { status: 'approved' },
      });
      const res = createMockRes();

      handler(req, res, mockNext);

      expect(mockUpdateStatus).toHaveBeenCalledWith('CP-1', 'approved');
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 400 when status is missing', () => {
      const handler = findHandler('/:id/status', 'patch');
      const req = createMockReq({
        params: { id: 'CP-1' } as any,
        body: {},
      });
      const res = createMockRes();

      handler(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('POST /:id/apply', () => {
    it('should apply proposal', async () => {
      mockApplyProposal.mockResolvedValue(undefined);

      const handler = findHandler('/:id/apply', 'post');
      const req = createMockReq({
        params: { id: 'CP-1' } as any,
        body: { force: true },
      });
      const res = createMockRes();

      await handler(req, res, mockNext);

      expect(mockApplyProposal).toHaveBeenCalledWith('CP-1', true);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 500 on apply error', async () => {
      mockApplyProposal.mockRejectedValue(new Error('Apply failed'));

      const handler = findHandler('/:id/apply', 'post');
      const req = createMockReq({
        params: { id: 'CP-1' } as any,
        body: {},
      });
      const res = createMockRes();

      await handler(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /:id/progress', () => {
    it('should return progress for proposal', () => {
      const progress = { percentage: 50, stage: 'reviewing' };
      mockGetProgress.mockReturnValue(progress);

      const handler = findHandler('/:id/progress');
      const req = createMockReq({ params: { id: 'CP-1' } as any });
      const res = createMockRes();

      handler(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(progress);
    });

    it('should return 404 when no progress found', () => {
      mockGetProgress.mockReturnValue(null);

      const handler = findHandler('/:id/progress');
      const req = createMockReq({ params: { id: 'CP-999' } as any });
      const res = createMockRes();

      handler(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
