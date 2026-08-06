import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createArtifactRun } from '../src/core/artifacts/manager.js';
import { DiagnosticError } from '../src/errors/toolkit-error.js';
import {
  captureDiagnosticEvidence,
  runWithDiagnosticEvidence,
  withFailureEvidence,
} from '../src/core/diagnostics/runner.js';
import type { BrowserSessionHandle } from '../src/types/browser.js';
import type { ToolkitConfig } from '../src/types/config.js';

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function setup() {
  const cwd = await mkdtemp(join(tmpdir(), 'selector-diagnostic-runner-'));
  temporaryDirectories.push(cwd);
  const config: ToolkitConfig = {
    cwd,
    artifactsDir: join(cwd, 'artifacts'),
    browser: 'chromium',
    headless: true,
    timeoutMs: 30_000,
    navigationTimeoutMs: 45_000,
    viewport: { width: 1200, height: 800 },
    trace: 'off',
    screenshots: 'off',
  };
  const run = await createArtifactRun(config, { command: 'evidence' });
  const handlers = new Map<string, Set<(...args: never[]) => void>>();
  let currentUrl = 'about:blank';
  const page = {
    on: vi.fn((event: string, handler: (...args: never[]) => void) => {
      const existing = handlers.get(event) ?? new Set();
      existing.add(handler);
      handlers.set(event, existing);
      return page;
    }),
    off: vi.fn((event: string, handler: (...args: never[]) => void) => {
      handlers.get(event)?.delete(handler);
      return page;
    }),
    isClosed: vi.fn(() => false),
    url: vi.fn(() => currentUrl),
    title: vi.fn(async () => 'Diagnostic page'),
    frames: vi.fn(() => [page]),
    viewportSize: vi.fn(() => ({ width: 1200, height: 800 })),
    evaluate: vi.fn(async () => ({
      readyState: 'complete',
      contentType: 'text/html',
      characterSet: 'UTF-8',
      language: 'en-US',
      userAgent: 'Test Browser',
      platform: 'Linux',
      viewport: { width: 1200, height: 800, devicePixelRatio: 1 },
      document: { width: 1200, height: 800, scrollWidth: 1200, scrollHeight: 1600 },
    })),
    screenshot: vi.fn(async ({ path }: { path: string }) => writeFile(path, 'image')),
    locator: vi.fn(() => ({ count: vi.fn(async () => 0) })),
    waitForTimeout: vi.fn(async () => undefined),
  } as unknown as Page;
  const context = {} as BrowserContext;
  const browser = { version: () => '1.0' } as unknown as Browser;
  const close = vi.fn(async () => ({
    closedAt: '2026-07-18T12:00:01.000Z',
    tracePath: null,
    screenshotPath: null,
    storageStatePath: null,
    warnings: [],
  }));
  const session: BrowserSessionHandle = {
    browser,
    context,
    page,
    artifactRun: run,
    navigate: vi.fn(async (url: string) => {
      currentUrl = url;
      return { requestedUrl: url, finalUrl: url, title: 'Diagnostic page', status: 200, ok: true };
    }),
    summary: () => ({
      id: run.id,
      browser: 'chromium',
      mode: 'ephemeral',
      headless: true,
      createdAt: run.createdAt,
      currentUrl,
      pageCount: 1,
      traceActive: false,
      userDataDir: null,
      storageStatePath: null,
      artifactRun: run,
    }),
    saveStorageState: vi.fn(async () => '/tmp/storage.json'),
    close,
  };
  return { config, session, page, close };
}

describe('diagnostic evidence runner', () => {
  it('captures a successful operation without requiring a browser-specific snapshot implementation', async () => {
    const fixture = await setup();
    const result = await runWithDiagnosticEvidence(
      fixture.config,
      'https://example.com/?token=secret',
      async () => 'done',
      {
        includeTrace: false,
        includeDomSnapshot: false,
        includeHtmlSnapshot: false,
        fullPageScreenshot: false,
        viewportScreenshot: false,
        archive: false,
      },
      { openSession: async () => fixture.session, toolkitVersion: () => '0.10.0' },
    );

    expect(result.value).toBe('done');
    expect(result.evidence.success).toBe(true);
    expect(result.evidence.manifest.metadata?.url).toBe('https://example.com/');
    expect(result.evidence.archivePath).toBeNull();
    expect(JSON.parse(await readFile(result.evidence.reportPath, 'utf8'))).toMatchObject({
      schemaVersion: '1.0',
      success: true,
    });
  });

  it('packages operation failures as evidence and exposes the bundle path through withFailureEvidence', async () => {
    const fixture = await setup();
    const dependencies = {
      openSession: async () => fixture.session,
      createArchive: vi.fn(async () =>
        join(fixture.session.artifactRun.directories.reports, 'evidence.zip'),
      ),
      toolkitVersion: () => '0.10.0',
    };

    const report = await captureDiagnosticEvidence(
      fixture.config,
      'https://example.com/',
      {
        includeTrace: false,
        includeDomSnapshot: false,
        includeHtmlSnapshot: false,
        fullPageScreenshot: false,
        viewportScreenshot: false,
        archive: false,
      },
      dependencies,
    );
    expect(report.success).toBe(true);

    try {
      await withFailureEvidence(
        fixture.config,
        'https://example.com/',
        async () => {
          throw new Error('secret token=abc');
        },
        {
          includeTrace: false,
          includeDomSnapshot: false,
          includeHtmlSnapshot: false,
          fullPageScreenshot: false,
          viewportScreenshot: false,
        },
        dependencies,
      );
      throw new Error('Expected withFailureEvidence to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DiagnosticError);
      const diagnostic = error as DiagnosticError;
      expect(diagnostic.code).toBe('DIAGNOSTIC_OPERATION_FAILED');
      expect(String(diagnostic.details.archivePath)).toContain('evidence.zip');
    }
  });
});
