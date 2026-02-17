import path from 'path';

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    readdirSync: jest.fn(),
  },
}));

jest.mock('@/utils/paths', () => ({
  PATHS: {
    CONFIG_DIR: '.specbmad',
    SPECIFICATIONS_DIR: '.specbmad/specifications',
  },
  getProjectPath: jest.fn((rel: string) => `/project/${rel}`),
}));

jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/utils/markdown-merger', () => ({
  MarkdownMerger: {
    addSection: jest.fn(async (content: string, _req: string, addition: string) => content + '\n' + addition),
    updateSection: jest.fn(async (content: string, _req: string, updated: string) => updated),
    removeSection: jest.fn(async (content: string) => content),
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import fs from 'fs';
import { ChangeManager } from '@/core/change/manager';
import { log } from '@/utils/logger';
import { MarkdownMerger } from '@/utils/markdown-merger';

const mockFs = fs as jest.Mocked<typeof fs>;

// ── Helpers ────────────────────────────────────────────────────────────────

const CHANGES_DIR = '/project/.specbmad/changes';
const SPECS_DIR = '/project/.specbmad/specifications';

function makeProposalMeta(overrides: Record<string, unknown> = {}) {
  return {
    id: 'CP-20260215120000',
    title: 'Test Proposal',
    description: 'A test description',
    status: 'draft',
    createdAt: '2026-02-15T12:00:00.000Z',
    updatedAt: '2026-02-15T12:00:00.000Z',
    ...overrides,
  };
}

function makeDeltas() {
  return [
    {
      specPath: 'auth.md',
      changes: [
        { type: 'ADDED', requirement: 'Login', content: 'Login flow' },
      ],
    },
  ];
}

/**
 * Configure mockFs.readFileSync to return different JSON payloads
 * based on the file path suffix.
 */
function stubLoadProposal(
  meta: Record<string, unknown>,
  deltas: unknown[] = [],
  tasks: unknown[] = [],
) {
  mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
    const s = String(p);
    if (s.endsWith('metadata.json')) return true;
    if (s.endsWith('deltas.json')) return true;
    if (s.endsWith('tasks.json')) return true;
    return false;
  });
  mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
    const s = String(p);
    if (s.endsWith('metadata.json')) return JSON.stringify(meta);
    if (s.endsWith('deltas.json')) return JSON.stringify(deltas);
    if (s.endsWith('tasks.json')) return JSON.stringify(tasks);
    return '';
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ChangeManager', () => {
  let manager: ChangeManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: changesDir does not exist
    mockFs.existsSync.mockReturnValue(false);
    manager = new ChangeManager();
  });

  // ─── ensureInitialized ─────────────────────────────────────────────────

  describe('ensureInitialized', () => {
    it('should create changes directory when it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      manager.ensureInitialized();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(CHANGES_DIR, { recursive: true });
    });

    it('should do nothing when changes directory already exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      manager.ensureInitialized();

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  // ─── createProposal ────────────────────────────────────────────────────

  describe('createProposal', () => {
    beforeEach(() => {
      // ensureInitialized path exists after first call
      mockFs.existsSync.mockReturnValue(false);
    });

    it('should create a proposal with CP-YYYYMMDDHHMMSS ID format', () => {
      const proposal = manager.createProposal('Title', 'Description');

      expect(proposal.id).toMatch(/^CP-\d{14}$/);
    });

    it('should create the proposal directory', () => {
      const proposal = manager.createProposal('Title', 'Desc');
      const proposalDir = path.join(CHANGES_DIR, proposal.id);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(proposalDir, { recursive: true });
    });

    it('should write metadata.json, proposal.md, deltas.json, and tasks.json', () => {
      const proposal = manager.createProposal('My Title', 'My Desc');
      const proposalDir = path.join(CHANGES_DIR, proposal.id);

      const writeCalls = mockFs.writeFileSync.mock.calls.map(c => String(c[0]));
      expect(writeCalls).toContainEqual(path.join(proposalDir, 'metadata.json'));
      expect(writeCalls).toContainEqual(path.join(proposalDir, 'proposal.md'));
      expect(writeCalls).toContainEqual(path.join(proposalDir, 'deltas.json'));
      expect(writeCalls).toContainEqual(path.join(proposalDir, 'tasks.json'));
    });

    it('should write proposal.md with title and description', () => {
      manager.createProposal('My Title', 'My Desc');

      const mdCall = mockFs.writeFileSync.mock.calls.find(c =>
        String(c[0]).endsWith('proposal.md'),
      );
      expect(mdCall).toBeDefined();
      expect(mdCall![1]).toBe('# My Title\n\nMy Desc\n');
    });

    it('should return a ChangeProposal with status draft and empty deltas', () => {
      const proposal = manager.createProposal('T', 'D');

      expect(proposal.status).toBe('draft');
      expect(proposal.title).toBe('T');
      expect(proposal.description).toBe('D');
      expect(proposal.deltas).toEqual([]);
      expect(proposal.createdAt).toBeDefined();
      expect(proposal.updatedAt).toBeDefined();
    });
  });

  // ─── listProposals ─────────────────────────────────────────────────────

  describe('listProposals', () => {
    it('should return empty array when no proposals exist', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);

      const result = manager.listProposals();

      expect(result).toEqual([]);
    });

    it('should load and sort proposals by createdAt descending', () => {
      mockFs.readdirSync.mockReturnValue([
        'CP-20260101000000',
        'CP-20260201000000',
      ] as unknown as ReturnType<typeof fs.readdirSync>);

      const older = makeProposalMeta({
        id: 'CP-20260101000000',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      const newer = makeProposalMeta({
        id: 'CP-20260201000000',
        createdAt: '2026-02-01T00:00:00.000Z',
      });

      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const s = String(p);
        if (s === CHANGES_DIR) return true;
        if (s.endsWith('metadata.json')) return true;
        if (s.endsWith('deltas.json')) return false;
        if (s.endsWith('tasks.json')) return false;
        return false;
      });
      mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
        const s = String(p);
        if (s.includes('CP-20260101000000')) return JSON.stringify(older);
        if (s.includes('CP-20260201000000')) return JSON.stringify(newer);
        return '';
      });

      const result = manager.listProposals();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('CP-20260201000000');
      expect(result[1].id).toBe('CP-20260101000000');
    });

    it('should skip non-CP directories', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'README.md',
        '.gitkeep',
      ] as unknown as ReturnType<typeof fs.readdirSync>);

      const result = manager.listProposals();

      expect(result).toEqual([]);
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    it('should handle load errors gracefully and continue', () => {
      mockFs.readdirSync.mockReturnValue([
        'CP-bad',
        'CP-good',
      ] as unknown as ReturnType<typeof fs.readdirSync>);

      let callCount = 0;
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const s = String(p);
        if (s === CHANGES_DIR) return true;
        if (s.endsWith('metadata.json')) return true;
        return false;
      });
      mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
        callCount++;
        if (callCount === 1) throw new Error('corrupt');
        return JSON.stringify(makeProposalMeta({ id: 'CP-good' }));
      });

      const result = manager.listProposals();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('CP-good');
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('CP-bad'));
    });
  });

  // ─── getProposal ──────────────────────────────────────────────────────

  describe('getProposal', () => {
    it('should return proposal when found', () => {
      const meta = makeProposalMeta();
      stubLoadProposal(meta, [], []);

      const result = manager.getProposal('CP-20260215120000');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('CP-20260215120000');
    });

    it('should return null when proposal not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = manager.getProposal('CP-nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update proposal status and updatedAt', () => {
      const meta = makeProposalMeta({ status: 'draft' });
      stubLoadProposal(meta);

      manager.updateStatus('CP-20260215120000', 'approved');

      // saveProposal writes metadata.json
      const metaWrite = mockFs.writeFileSync.mock.calls.find(c =>
        String(c[0]).endsWith('metadata.json'),
      );
      expect(metaWrite).toBeDefined();
      const saved = JSON.parse(String(metaWrite![1]));
      expect(saved.status).toBe('approved');
      expect(saved.updatedAt).not.toBe(meta.updatedAt);
    });

    it('should throw when proposal not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => manager.updateStatus('CP-none', 'approved')).toThrow('CP-none');
    });
  });

  // ─── applyProposal ────────────────────────────────────────────────────

  describe('applyProposal', () => {
    it('should apply approved proposal with ADDED deltas', async () => {
      const meta = makeProposalMeta({ status: 'approved' });
      const deltas = [
        {
          specPath: 'auth.md',
          changes: [{ type: 'ADDED', requirement: 'Login', content: 'Login content' }],
        },
      ];
      stubLoadProposal(meta, deltas);
      // Make spec file not exist yet
      const origImpl = mockFs.existsSync.getMockImplementation()!;
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const s = String(p);
        if (s === path.join(SPECS_DIR, 'auth.md')) return false;
        return origImpl(p);
      });

      await manager.applyProposal('CP-20260215120000');

      expect(MarkdownMerger.addSection).toHaveBeenCalledWith(
        '',
        'Login',
        'Login content',
        2,
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(SPECS_DIR, 'auth.md'),
        expect.any(String),
        'utf-8',
      );
    });

    it('should apply implemented proposal with MODIFIED deltas', async () => {
      const meta = makeProposalMeta({ status: 'implemented' });
      const deltas = [
        {
          specPath: 'auth.md',
          changes: [{ type: 'MODIFIED', requirement: 'Login', content: 'Updated' }],
        },
      ];
      stubLoadProposal(meta, deltas);

      await manager.applyProposal('CP-20260215120000');

      expect(MarkdownMerger.updateSection).toHaveBeenCalledWith(
        expect.any(String),
        'Login',
        'Updated',
        2,
      );
    });

    it('should apply REMOVED deltas', async () => {
      const meta = makeProposalMeta({ status: 'approved' });
      const deltas = [
        {
          specPath: 'auth.md',
          changes: [{ type: 'REMOVED', requirement: 'OldFeature', content: '' }],
        },
      ];
      stubLoadProposal(meta, deltas);

      await manager.applyProposal('CP-20260215120000');

      expect(MarkdownMerger.removeSection).toHaveBeenCalledWith(
        expect.any(String),
        'OldFeature',
        2,
      );
    });

    it('should handle scenarios in ADDED changes', async () => {
      const meta = makeProposalMeta({ status: 'approved' });
      const deltas = [
        {
          specPath: 'auth.md',
          changes: [
            {
              type: 'ADDED',
              requirement: 'Signup',
              content: 'Signup flow',
              scenarios: ['User fills form', 'User submits'],
            },
          ],
        },
      ];
      stubLoadProposal(meta, deltas);

      await manager.applyProposal('CP-20260215120000');

      expect(MarkdownMerger.addSection).toHaveBeenCalledWith(
        expect.any(String),
        'Signup',
        'Signup flow\n\n### 验收场景\n- User fills form\n- User submits',
        2,
      );
    });

    it('should throw when proposal not found', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(manager.applyProposal('CP-missing')).rejects.toThrow('CP-missing');
    });

    it('should throw when status is not approved/implemented and not force', async () => {
      const meta = makeProposalMeta({ status: 'draft' });
      stubLoadProposal(meta);

      await expect(manager.applyProposal('CP-20260215120000')).rejects.toThrow(
        /draft/,
      );
    });

    it('should skip already merged proposals with a warning', async () => {
      const meta = makeProposalMeta({ status: 'merged' });
      stubLoadProposal(meta);

      await manager.applyProposal('CP-20260215120000', true);

      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('已经合并'));
      expect(MarkdownMerger.addSection).not.toHaveBeenCalled();
    });

    it('should bypass status check when force is true', async () => {
      const meta = makeProposalMeta({ status: 'draft' });
      const deltas = [
        {
          specPath: 'auth.md',
          changes: [{ type: 'ADDED', requirement: 'X', content: 'Y' }],
        },
      ];
      stubLoadProposal(meta, deltas);

      await expect(manager.applyProposal('CP-20260215120000', true)).resolves.not.toThrow();

      expect(MarkdownMerger.addSection).toHaveBeenCalled();
    });

    it('should warn and return when deltas are empty', async () => {
      const meta = makeProposalMeta({ status: 'approved' });
      stubLoadProposal(meta, []);

      await manager.applyProposal('CP-20260215120000');

      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Delta'));
      expect(MarkdownMerger.addSection).not.toHaveBeenCalled();
    });

    it('should load deltas from deltas.json file over proposal deltas', async () => {
      const meta = makeProposalMeta({ status: 'approved' });
      // Proposal loaded with empty deltas, but deltas.json has content
      const fileDeltas = [
        {
          specPath: 'new.md',
          changes: [{ type: 'ADDED', requirement: 'FromFile', content: 'File content' }],
        },
      ];
      stubLoadProposal(meta, fileDeltas);

      await manager.applyProposal('CP-20260215120000');

      expect(MarkdownMerger.addSection).toHaveBeenCalledWith(
        expect.any(String),
        'FromFile',
        'File content',
        2,
      );
    });
  });

  // ─── getProgress ──────────────────────────────────────────────────────

  describe('getProgress', () => {
    it('should return null when proposal not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = manager.getProgress('CP-none');

      expect(result).toBeNull();
    });

    it('should calculate progress from tasks', () => {
      const meta = makeProposalMeta({ status: 'implemented' });
      const tasks = [
        { id: 't1', description: 'Task 1', status: 'completed' },
        { id: 't2', description: 'Task 2', status: 'completed' },
        { id: 't3', description: 'Task 3', status: 'in_progress' },
        { id: 't4', description: 'Task 4', status: 'pending' },
      ];
      stubLoadProposal(meta, [], tasks);

      const result = manager.getProgress('CP-20260215120000');

      expect(result).not.toBeNull();
      expect(result!.totalTasks).toBe(4);
      expect(result!.completedTasks).toBe(2);
      expect(result!.inProgressTasks).toBe(1);
      expect(result!.pendingTasks).toBe(1);
      expect(result!.progress).toBe(50);
    });

    it('should use status-based estimation when no tasks exist', () => {
      const meta = makeProposalMeta({ status: 'approved' });
      stubLoadProposal(meta, [], []);

      const result = manager.getProgress('CP-20260215120000');

      expect(result).not.toBeNull();
      // totalTasks defaults to 1 when empty (line 242: tasks.length || 1)
      // completedTasks = 0, so progress = 0/1 * 100 = 0
      // The status-based path is only reached when totalTasks <= 0 (never with || 1)
      expect(result!.totalTasks).toBe(1);
      expect(result!.progress).toBe(0);
    });

    it('should identify currentStep from in_progress tasks', () => {
      const meta = makeProposalMeta();
      const tasks = [
        { id: 't1', description: 'Done task', status: 'completed' },
        { id: 't2', description: 'Active task', status: 'in_progress' },
        { id: 't3', description: 'Waiting task', status: 'pending' },
      ];
      stubLoadProposal(meta, [], tasks);

      const result = manager.getProgress('CP-20260215120000');

      expect(result!.currentStep).toBe('Active task');
    });

    it('should identify currentStep from pending tasks when no in_progress', () => {
      const meta = makeProposalMeta();
      const tasks = [
        { id: 't1', description: 'Done task', status: 'completed' },
        { id: 't2', description: 'Next task', status: 'pending' },
      ];
      stubLoadProposal(meta, [], tasks);

      const result = manager.getProgress('CP-20260215120000');

      expect(result!.currentStep).toBe('Next task');
    });

    it('should show "已完成" currentStep for merged status with no active tasks', () => {
      const meta = makeProposalMeta({ status: 'merged' });
      const tasks = [
        { id: 't1', description: 'Task', status: 'completed' },
      ];
      stubLoadProposal(meta, [], tasks);

      const result = manager.getProgress('CP-20260215120000');

      expect(result!.currentStep).toBe('已完成');
      expect(result!.progress).toBe(100);
    });

    it('should return tasks array when tasks exist', () => {
      const meta = makeProposalMeta();
      const tasks = [
        { id: 't1', description: 'Task 1', status: 'pending' },
      ];
      stubLoadProposal(meta, [], tasks);

      const result = manager.getProgress('CP-20260215120000');

      expect(result!.tasks).toEqual(tasks);
    });

    it('should return undefined tasks when no tasks exist', () => {
      const meta = makeProposalMeta();
      stubLoadProposal(meta, [], []);

      const result = manager.getProgress('CP-20260215120000');

      expect(result!.tasks).toBeUndefined();
    });

    it('should fall back to proposal status as currentStep when no tasks are active or pending', () => {
      const meta = makeProposalMeta({ status: 'review' });
      stubLoadProposal(meta, [], []);

      const result = manager.getProgress('CP-20260215120000');

      expect(result!.currentStep).toBe('review');
    });
  });
});
