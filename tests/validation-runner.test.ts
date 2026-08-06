import type { Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { runSelectorValidation } from '../src/core/validation/runner.js';
import type { BrowserSessionHandle } from '../src/types/browser.js';
import type { ToolkitConfig } from '../src/types/config.js';
import type { LoadedSelectorManifest } from '../src/types/validation.js';

const config: ToolkitConfig = {
  cwd: '/tmp/toolkit',
  artifactsDir: '/tmp/toolkit/artifacts',
  browser: 'chromium',
  headless: true,
  timeoutMs: 30_000,
  navigationTimeoutMs: 45_000,
  viewport: { width: 1440, height: 900 },
  trace: 'retain-on-failure',
  screenshots: 'on-failure',
};

const loaded: LoadedSelectorManifest = {
  sourcePath: '/tmp/selectors.yaml',
  manifest: {
    schemaVersion: '1.0',
    name: 'Smoke',
    url: 'https://example.com',
    waitUntil: 'domcontentloaded',
    selectors: [
      {
        id: 'save',
        name: 'Save',
        required: true,
        framePath: 'main',
        locator: { type: 'role', role: 'button', name: 'Save', exact: true },
        assertions: { count: 1 },
      },
    ],
  },
};

function session(): BrowserSessionHandle {
  const locator = {
    count: vi.fn(async () => 1),
    nth: vi.fn(() => ({
      isVisible: vi.fn(async () => true),
      isEnabled: vi.fn(async () => true),
      isEditable: vi.fn(async () => false),
    })),
  };
  const frame = {
    name: () => '',
    childFrames: () => [],
    getByRole: vi.fn(() => locator),
  };
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
    browser: null,
    context: {} as never,
    page: { mainFrame: () => frame } as unknown as Page,
    artifactRun,
    navigate: vi.fn(async (url: string) => ({
      requestedUrl: url,
      finalUrl: url,
      title: 'Example',
      status: 200,
      ok: true,
    })),
    summary: vi.fn(() => ({
      id: 'run',
      browser: 'chromium' as const,
      mode: 'ephemeral' as const,
      headless: true,
      createdAt: '2026-07-18T00:00:00.000Z',
      currentUrl: 'https://example.com',
      pageCount: 1,
      traceActive: true,
      userDataDir: null,
      storageStatePath: null,
      artifactRun,
    })),
    saveStorageState: vi.fn(async () => '/tmp/state.json'),
    close: vi.fn(async () => ({
      closedAt: '2026-07-18T00:00:01.000Z',
      tracePath: null,
      screenshotPath: null,
      storageStatePath: null,
      warnings: [],
    })),
  };
}

describe('selector validation runner', () => {
  it('loads, validates, writes a report, and closes the browser', async () => {
    const browserSession = session();
    const writer = vi.fn(async () => '/tmp/toolkit/artifacts/run/reports/selector-validation.json');
    const report = await runSelectorValidation(
      config,
      'selectors.yaml',
      {},
      {
        loadManifest: async () => loaded,
        openSession: async () => browserSession,
        writeArtifact: writer,
      },
    );
    expect(report.summary.success).toBe(true);
    expect(report.reportPath).toContain('selector-validation.json');
    expect(writer).toHaveBeenCalledOnce();
    expect(browserSession.close).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('requires a target URL from CLI, manifest, or config', async () => {
    const noUrl: LoadedSelectorManifest = {
      ...loaded,
      manifest: { ...loaded.manifest, url: undefined } as never,
    };
    await expect(
      runSelectorValidation(config, 'selectors.yaml', {}, { loadManifest: async () => noUrl }),
    ).rejects.toMatchObject({ code: 'VALIDATION_TARGET_REQUIRED', exitCode: 2 });
  });
});
