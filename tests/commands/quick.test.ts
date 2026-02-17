jest.mock('fs', () => ({
  __esModule: true,
  default: {
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    success: jest.fn(),
  },
}));

const mockHandleError = jest.fn();
jest.mock('@/utils/error', () => ({
  handleError: (...args: unknown[]) => mockHandleError(...args),
}));

const mockGenerateByStack = jest.fn();
jest.mock('@/generator', () => ({
  generateByStack: (...args: unknown[]) => mockGenerateByStack(...args),
}));

const mockRunCommand = jest.fn();
jest.mock('@/commands/run', () => ({
  runCommand: (...args: unknown[]) => mockRunCommand(...args),
}));

const mockStart = jest.fn();
const mockEnd = jest.fn(() => ({ durationMs: 123 }));
jest.mock('@/utils/perf', () => ({
  PerfTracer: jest.fn().mockImplementation(() => ({
    start: mockStart,
    end: mockEnd,
  })),
}));

import path from 'path';
import fs from 'fs';
import { quickCommand } from '@/commands/quick';
import { log } from '@/utils/logger';

const mockFs = fs as unknown as {
  mkdirSync: jest.Mock;
  writeFileSync: jest.Mock;
};

describe('quickCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunCommand.mockResolvedValue('run-output-ok');
  });

  it('should reject empty text input early', async () => {
    await quickCommand({ text: '   ' });

    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('--text'));
    expect(mockGenerateByStack).not.toHaveBeenCalled();
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('should generate default ts-cli project and docs', async () => {
    await quickCommand({ text: 'build todo app' });

    const outDir = path.join(process.cwd(), 'generated', 'project');
    const docsDir = path.join(process.cwd(), 'docs');

    expect(mockGenerateByStack).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: 'ts-cli',
        projectDir: outDir,
        projectName: 'project',
      }),
    );
    expect(mockFs.mkdirSync).toHaveBeenCalledWith(docsDir, { recursive: true });
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      path.join(docsDir, '项目说明书.md'),
      expect.stringContaining('栈: ts-cli'),
      'utf-8',
    );
    expect(mockRunCommand).not.toHaveBeenCalled();
    expect(log.success).toHaveBeenCalledWith(expect.stringContaining('最小可运行 Demo 已生成'));
  });

  it('should select ts-api and auto run for api hints', async () => {
    await quickCommand({ text: 'build http api service', autoRun: true });

    const outDir = path.join(process.cwd(), 'generated', 'project');
    const docsDir = path.join(process.cwd(), 'docs');

    expect(mockGenerateByStack).toHaveBeenCalledWith(
      expect.objectContaining({ stack: 'ts-api' }),
    );
    expect(mockRunCommand).toHaveBeenCalledWith({ dir: outDir, stack: 'ts-api' });
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      path.join(docsDir, 'run-output.txt'),
      'run-output-ok',
      'utf-8',
    );
  });

  it('should select py-cli and auto run for python hints', async () => {
    await quickCommand({ text: 'use python to build cli', autoRun: true });

    expect(mockGenerateByStack).toHaveBeenCalledWith(
      expect.objectContaining({ stack: 'py-cli' }),
    );
    expect(mockRunCommand).toHaveBeenCalledWith(
      expect.objectContaining({ stack: 'py-cli' }),
    );
  });

  it('should map c++ gui to cpp-app generation and cpp-cli runtime', async () => {
    await quickCommand({ text: '用 c++ 做一个 GUI 应用', autoRun: true });

    expect(mockGenerateByStack).toHaveBeenCalledWith(
      expect.objectContaining({ stack: 'cpp-app' }),
    );
    expect(mockRunCommand).toHaveBeenCalledWith(
      expect.objectContaining({ stack: 'cpp-cli' }),
    );
  });

  it('should map plain c++ request to cpp-cli generation', async () => {
    await quickCommand({ text: 'write a c++ command line tool' });

    expect(mockGenerateByStack).toHaveBeenCalledWith(
      expect.objectContaining({ stack: 'cpp-cli' }),
    );
  });

  it('should honor forced stack and skip auto-run in dry-run mode', async () => {
    await quickCommand({ text: 'anything', stack: 'ts-chat', autoRun: true, dryRun: true });

    expect(mockGenerateByStack).toHaveBeenCalledWith(
      expect.objectContaining({ stack: 'ts-chat', dryRun: true }),
    );
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('should auto-run ts-cli for default stack', async () => {
    await quickCommand({ text: 'build local cli app', autoRun: true });

    expect(mockRunCommand).toHaveBeenCalledWith(
      expect.objectContaining({ stack: 'ts-cli' }),
    );
  });

  it('should call handleError and rethrow when generation fails', async () => {
    const err = new Error('gen failed');
    mockGenerateByStack.mockImplementationOnce(() => {
      throw err;
    });

    await expect(quickCommand({ text: 'boom' })).rejects.toThrow('gen failed');
    expect(mockHandleError).toHaveBeenCalledWith(err, { command: 'quick' });
  });
});
