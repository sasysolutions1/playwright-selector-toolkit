import { describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import type { ResolvedToolkitConfig } from '../src/types/config.js';
import type { SelectorValidationRunReport } from '../src/types/validation.js';

const resolvedConfig: ResolvedToolkitConfig = {
  config: {
    cwd: '/tmp/toolkit',
    artifactsDir: '/tmp/toolkit/artifacts',
    browser: 'chromium',
    headless: true,
    timeoutMs: 30_000,
    navigationTimeoutMs: 45_000,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshots: 'on-failure',
  },
  sources: { configFile: null, environmentVariables: [], cliOptions: [] },
};

function report(success: boolean): SelectorValidationRunReport {
  const artifactRun = {
    id: 'run',
    command: 'validate',
    createdAt: '2026-07-18T00:00:00.000Z',
    directories: {
      root: '/tmp/toolkit/artifacts',
      run: '/tmp/toolkit/artifacts/run',
      screenshots: '/tmp/toolkit/artifacts/run/screenshots',
      snapshots: '/tmp/toolkit/artifacts/run/snapshots',
      traces: '/tmp/toolkit/artifacts/run/traces',
      reports: '/tmp/toolkit/artifacts/run/reports',
    },
    metadataPath: '/tmp/toolkit/artifacts/run/run.json',
  };
  return {
    navigation: {
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com/',
      title: 'Example',
      status: 200,
      ok: true,
    },
    session: {
      id: 'run',
      browser: 'chromium',
      mode: 'ephemeral',
      headless: true,
      createdAt: '2026-07-18T00:00:00.000Z',
      currentUrl: 'https://example.com/',
      pageCount: 1,
      traceActive: true,
      userDataDir: null,
      storageStatePath: null,
      artifactRun,
    },
    artifactRun,
    manifestPath: '/tmp/selectors.yaml',
    reportPath: '/tmp/toolkit/artifacts/run/reports/selector-validation.json',
    summary: {
      total: 1,
      required: 1,
      optional: 0,
      passed: success ? 1 : 0,
      failed: success ? 0 : 1,
      errors: 0,
      requiredFailures: success ? 0 : 1,
      optionalFailures: 0,
      success,
    },
    results: [],
    warnings: [],
    close: {
      closedAt: '2026-07-18T00:00:01.000Z',
      tracePath: null,
      screenshotPath: null,
      storageStatePath: null,
      warnings: [],
    },
  };
}

describe('validate CLI command', () => {
  it('passes CLI options and returns exit code zero', async () => {
    let output = '';
    const setExitCode = vi.fn();
    const validator = vi.fn(async () => report(true));
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      selectorValidator: validator,
      writeOut: (value) => {
        output += value;
      },
      setExitCode,
    });
    await program.parseAsync([
      'node',
      'selector',
      'validate',
      'selectors.yaml',
      'https://example.com',
      '--report-file',
      'reports/smoke.json',
      '--wait-until',
      'load',
    ]);
    expect(validator).toHaveBeenCalledWith(
      resolvedConfig.config,
      'selectors.yaml',
      expect.objectContaining({
        url: 'https://example.com',
        reportFile: 'reports/smoke.json',
        waitUntil: 'load',
      }),
    );
    expect(setExitCode).toHaveBeenCalledWith(0);
    expect(output).toContain('Selector validation passed');
  });

  it('returns exit code one when a required selector fails', async () => {
    const setExitCode = vi.fn();
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      selectorValidator: async () => report(false),
      writeOut: () => undefined,
      setExitCode,
    });
    await program.parseAsync(['node', 'selector', 'validate', 'selectors.yaml']);
    expect(setExitCode).toHaveBeenCalledWith(1);
  });
});
