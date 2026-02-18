/**
 * Logger Format Tests
 *
 * Tests the winston format.printf callback (lines 9-24 of logger.ts)
 * and the non-production console transport (lines 60-67).
 *
 * We mock winston to capture the printf callback, then invoke it
 * with various log info objects to verify formatting behavior.
 */

let capturedPrintfFn: ((info: Record<string, any>) => string) | null = null;

jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn((..._args: any[]) => 'combined-format'),
    timestamp: jest.fn(() => 'timestamp-format'),
    errors: jest.fn(() => 'errors-format'),
    printf: jest.fn((fn: any) => {
      capturedPrintfFn = fn;
      return 'printf-format';
    }),
    colorize: jest.fn(() => 'colorize-format'),
    simple: jest.fn(() => 'simple-format'),
    json: jest.fn(() => 'json-format'),
  };

  const mockTransports = {
    Console: jest.fn(),
    File: jest.fn(),
  };

  const mockLoggerInstance = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn(),
  };

  return {
    format: mockFormat,
    transports: mockTransports,
    createLogger: jest.fn(() => mockLoggerInstance),
  };
});

jest.mock('chalk', () => {
  const makeFn = (color: string) => {
    const fn = (text: string) => `[${color}]${text}[/${color}]`;
    fn.green = (text: string) => `[green]${text}[/green]`;
    fn.red = (text: string) => `[red]${text}[/red]`;
    fn.blue = (text: string) => `[blue]${text}[/blue]`;
    return fn;
  };

  return {
    __esModule: true,
    default: {
      red: (text: string) => `[red]${text}[/red]`,
      yellow: (text: string) => `[yellow]${text}[/yellow]`,
      blue: (text: string) => `[blue]${text}[/blue]`,
      gray: (text: string) => `[gray]${text}[/gray]`,
      white: (text: string) => `[white]${text}[/white]`,
      green: (text: string) => `[green]${text}[/green]`,
    },
  };
});

// Import AFTER mocks are set up — this triggers module evaluation
// which calls winston.format.printf, capturing the callback
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import _winston from 'winston';

describe('Logger - Custom Format (printf callback)', () => {
  beforeAll(() => {
    // Force module load to capture printf callback
    require('@/utils/logger');
  });

  it('should capture the printf callback', () => {
    expect(capturedPrintfFn).not.toBeNull();
    expect(typeof capturedPrintfFn).toBe('function');
  });

  it('should format info-level messages with blue prefix', () => {
    const result = capturedPrintfFn!({
      level: 'info',
      message: 'hello world',
      timestamp: '2026-01-01 12:00:00',
    });

    expect(result).toContain('[gray]2026-01-01 12:00:00[/gray]');
    expect(result).toContain('[blue][INFO][/blue]');
    expect(result).toContain('hello world');
  });

  it('should format error-level messages with red prefix', () => {
    const result = capturedPrintfFn!({
      level: 'error',
      message: 'something broke',
      timestamp: '2026-01-01 12:00:00',
    });

    expect(result).toContain('[red][ERROR][/red]');
    expect(result).toContain('something broke');
  });

  it('should format warn-level messages with yellow prefix', () => {
    const result = capturedPrintfFn!({
      level: 'warn',
      message: 'be careful',
      timestamp: '2026-01-01 12:00:00',
    });

    expect(result).toContain('[yellow][WARN][/yellow]');
    expect(result).toContain('be careful');
  });

  it('should format debug-level messages with gray prefix', () => {
    const result = capturedPrintfFn!({
      level: 'debug',
      message: 'trace info',
      timestamp: '2026-01-01 12:00:00',
    });

    expect(result).toContain('[gray][DEBUG][/gray]');
    expect(result).toContain('trace info');
  });

  it('should use white for unknown log levels', () => {
    const result = capturedPrintfFn!({
      level: 'verbose',
      message: 'verbose msg',
      timestamp: '2026-01-01 12:00:00',
    });

    expect(result).toContain('[white][VERBOSE][/white]');
    expect(result).toContain('verbose msg');
  });

  it('should include stack trace when present', () => {
    const result = capturedPrintfFn!({
      level: 'error',
      message: 'error with stack',
      timestamp: '2026-01-01 12:00:00',
      stack: 'Error: something\n    at foo.ts:10\n    at bar.ts:20',
    });

    expect(result).toContain('error with stack');
    expect(result).toContain('\nError: something');
    expect(result).toContain('at foo.ts:10');
  });

  it('should not include stack trace when absent', () => {
    const result = capturedPrintfFn!({
      level: 'error',
      message: 'error without stack',
      timestamp: '2026-01-01 12:00:00',
    });

    expect(result).not.toContain('\n');
    expect(result).toContain('error without stack');
  });
});

describe('Logger - Format edge cases', () => {
  it('should handle empty message', () => {
    const result = capturedPrintfFn!({
      level: 'info',
      message: '',
      timestamp: '2026-01-01 12:00:00',
    });

    expect(result).toContain('[blue][INFO][/blue]');
  });

  it('should handle stack with empty string (falsy but defined)', () => {
    const result = capturedPrintfFn!({
      level: 'error',
      message: 'err',
      timestamp: '2026-01-01 12:00:00',
      stack: '',
    });

    // Empty string is falsy, so stack branch should NOT be taken
    expect(result).not.toContain('\n');
  });
});
