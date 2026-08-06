import { describe, expect, it } from 'vitest';
import { ConfigError, normalizeError, toErrorReport } from '../src/errors/toolkit-error.js';

describe('structured toolkit errors', () => {
  it('preserves codes, details, and exit codes', () => {
    const error = new ConfigError('CONFIG_INVALID', 'Bad configuration', {
      details: { field: 'browser' },
      exitCode: 2,
    });

    expect(toErrorReport(error)).toEqual({
      name: 'ConfigError',
      code: 'CONFIG_INVALID',
      message: 'Bad configuration',
      exitCode: 2,
      details: { field: 'browser' },
    });
  });

  it('normalizes native errors', () => {
    expect(normalizeError(new Error('boom'))).toMatchObject({
      code: 'UNKNOWN_ERROR',
      message: 'boom',
    });
  });
});
