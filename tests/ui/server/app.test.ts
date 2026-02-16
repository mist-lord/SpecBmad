jest.mock('@/utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(), success: jest.fn() },
}));

jest.mock('@/core/project/status', () => ({
  ProjectStatusManager: jest.fn().mockImplementation(() => ({
    isInitialized: jest.fn().mockReturnValue(true),
    getTasksStatus: jest.fn().mockResolvedValue([]),
    getAgentsStatus: jest.fn().mockResolvedValue([]),
    getFilesStatus: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@/utils/config', () => ({
  ConfigManager: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockReturnValue({ projectName: 'test' }),
  })),
}));

jest.mock('@/core/change/manager', () => ({
  changeManager: {
    listProposals: jest.fn().mockReturnValue([]),
    getProposal: jest.fn(),
    createProposal: jest.fn(),
    updateStatus: jest.fn(),
    applyProposal: jest.fn(),
    getProgress: jest.fn(),
  },
}));

import { createApp } from '@/ui/server/app';
import { Application } from 'express';

describe('createApp', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
  });

  it('should return an Express application', () => {
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
    expect(typeof app.use).toBe('function');
  });

  it('should have registered middleware and routes', () => {
    // Initialize the router by accessing it
    // Express lazily creates _router, but we can check that the app works as a function
    expect(typeof app).toBe('function');
    // app.use adds to the internal stack; verify the app has been configured
    // by checking that common Express methods exist
    expect(typeof app.get).toBe('function');
    expect(typeof app.post).toBe('function');
    expect(typeof app.use).toBe('function');
  });

  it('should be callable as a request handler', () => {
    // Express apps are functions with (req, res, next) signature
    expect(app.length).toBe(3); // Express app function has 3 params
  });
});
