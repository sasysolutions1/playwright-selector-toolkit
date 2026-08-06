import { describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import type { DiagnosticEvidenceReport } from '../src/types/diagnostics.js';
import type { ResolvedToolkitConfig } from '../src/types/config.js';

const resolvedConfig: ResolvedToolkitConfig = {
  config: {
    cwd: '/tmp/toolkit',
    artifactsDir: '/tmp/toolkit/artifacts',
    browser: 'chromium',
    headless: true,
    timeoutMs: 30_000,
    navigationTimeoutMs: 45_000,
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    screenshots: 'off',
  },
  sources: { configFile: null, environmentVariables: [], cliOptions: [] },
};

function report(success: boolean): DiagnosticEvidenceReport {
  const artifactRun = {
    id: 'evidence-run',
    command: 'evidence',
    createdAt: '2026-07-18T12:00:00.000Z',
    directories: {
      root: '/tmp/toolkit/artifacts',
      run: '/tmp/toolkit/artifacts/evidence-run',
      screenshots: '/tmp/toolkit/artifacts/evidence-run/screenshots',
      snapshots: '/tmp/toolkit/artifacts/evidence-run/snapshots',
      traces: '/tmp/toolkit/artifacts/evidence-run/traces',
      reports: '/tmp/toolkit/artifacts/evidence-run/reports',
    },
    metadataPath: '/tmp/toolkit/artifacts/evidence-run/run.json',
  };
  return {
    success,
    navigation: null,
    session: {
      id: artifactRun.id,
      browser: 'chromium',
      mode: 'ephemeral',
      headless: true,
      createdAt: artifactRun.createdAt,
      currentUrl: 'https://example.com/',
      pageCount: 1,
      traceActive: false,
      userDataDir: null,
      storageStatePath: null,
      artifactRun,
    },
    artifactRun,
    reportPath: `${artifactRun.directories.reports}/diagnostic-evidence.json`,
    archivePath: `${artifactRun.directories.reports}/diagnostic-evidence.zip`,
    manifest: {
      schemaVersion: '1.0',
      toolkitVersion: '0.10.0',
      createdAt: artifactRun.createdAt,
      success,
      requestedUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      title: 'Example',
      navigation: null,
      metadata: null,
      recorder: {
        schemaVersion: '1.0',
        capturedAt: artifactRun.createdAt,
        console: [],
        pageErrors: [],
        requestFailures: [],
        httpErrors: [],
        summary: {
          consoleEntryCount: 0,
          pageErrorCount: 0,
          requestFailureCount: 0,
          httpErrorCount: 0,
          droppedConsoleEntries: 0,
          droppedPageErrors: 0,
          droppedRequestFailures: 0,
          droppedHttpErrors: 0,
          redactionCount: 0,
        },
      },
      screenshots: { artifacts: [], failures: [] },
      files: {
        metadata: 'reports/page-metadata.json',
        events: 'reports/diagnostic-events.json',
        domSnapshot: null,
        htmlSnapshot: null,
        htmlFrames: [],
        screenshots: [],
        trace: null,
      },
      failure: success ? null : { name: 'Error', message: 'failed', stack: null },
      warnings: [],
    },
    close: {
      closedAt: artifactRun.createdAt,
      tracePath: null,
      screenshotPath: null,
      storageStatePath: null,
      warnings: [],
    },
  };
}

describe('evidence CLI command', () => {
  it('maps evidence options and sets a failure exit code', async () => {
    const capturer = vi.fn(async () => report(false));
    const output: string[] = [];
    const exitCodes: number[] = [];
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      diagnosticEvidenceCapturer: capturer,
      writeOut: (value) => output.push(value),
      setExitCode: (value) => exitCodes.push(value),
    });

    await program.parseAsync([
      'node',
      'selector',
      '--json',
      'evidence',
      'https://example.com/',
      '--no-trace',
      '--no-html-snapshot',
      '--element',
      '#submit',
      '--max-entries',
      '12',
      '--fail-on-http-error',
    ]);

    expect(capturer).toHaveBeenCalledWith(
      resolvedConfig.config,
      'https://example.com/',
      expect.objectContaining({
        includeTrace: false,
        includeHtmlSnapshot: false,
        maxEntries: 12,
        failOnHttpError: true,
        elementScreenshots: [{ id: 'element-1', selector: '#submit', maxMatches: 1 }],
      }),
    );
    expect(exitCodes).toEqual([1]);
    expect(JSON.parse(output.join(''))).toMatchObject({ success: false });
  });
});
