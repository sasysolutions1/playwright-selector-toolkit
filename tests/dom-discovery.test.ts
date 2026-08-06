import type { Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { discoverDom } from '../src/core/dom/discovery.js';
import type { ArtifactRun } from '../src/types/artifacts.js';
import type { BrowserSessionHandle } from '../src/types/browser.js';
import type { ToolkitConfig } from '../src/types/config.js';
import type { DomSnapshot } from '../src/types/dom.js';

const config: ToolkitConfig = {
  cwd: '/tmp/toolkit',
  artifactsDir: '/tmp/toolkit/artifacts',
  browser: 'chromium',
  headless: true,
  timeoutMs: 30_000,
  navigationTimeoutMs: 45_000,
  viewport: { width: 1440, height: 900 },
  trace: 'off',
  screenshots: 'off',
};

const artifactRun: ArtifactRun = {
  id: 'run-id',
  command: 'discover',
  createdAt: '2026-07-18T00:00:00.000Z',
  directories: {
    root: '/tmp/toolkit/artifacts',
    run: '/tmp/toolkit/artifacts/run-id',
    screenshots: '/tmp/toolkit/artifacts/run-id/screenshots',
    snapshots: '/tmp/toolkit/artifacts/run-id/snapshots',
    traces: '/tmp/toolkit/artifacts/run-id/traces',
    reports: '/tmp/toolkit/artifacts/run-id/reports',
  },
  metadataPath: '/tmp/toolkit/artifacts/run-id/run.json',
};

const snapshot: DomSnapshot = {
  schemaVersion: '1.0',
  toolkitVersion: '0.4.0',
  capturedAt: '2026-07-18T00:00:00.000Z',
  requestedUrl: 'https://example.test/',
  finalUrl: 'https://example.test/',
  title: 'Example',
  options: {
    scope: 'interactive',
    includeHidden: false,
    maxElements: 5_000,
    maxFrameDepth: 8,
    textLimit: 240,
    redact: true,
  },
  summary: {
    frameCount: 1,
    failedFrameCount: 0,
    shadowRootCount: 0,
    inspectedElementCount: 5,
    matchedElementCount: 2,
    visibleElementCount: 2,
    hiddenElementCount: 0,
    interactiveElementCount: 2,
    sensitiveElementCount: 0,
    redactionCount: 0,
    truncated: false,
    kinds: { button: 2 },
  },
  frames: [],
  failures: [],
  warnings: [],
};

function fakeSession() {
  return {
    browser: null,
    context: {} as BrowserSessionHandle['context'],
    page: {} as Page,
    artifactRun,
    navigate: vi.fn(async (url: string) => ({
      requestedUrl: url,
      finalUrl: url,
      title: 'Example',
      status: 200,
      ok: true,
    })),
    summary: vi.fn(() => ({
      id: artifactRun.id,
      browser: 'chromium' as const,
      mode: 'ephemeral' as const,
      headless: true,
      createdAt: artifactRun.createdAt,
      currentUrl: 'https://example.test/',
      pageCount: 1,
      traceActive: false,
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
  } satisfies BrowserSessionHandle;
}

describe('DOM discovery', () => {
  it('navigates, writes a snapshot, and closes successfully', async () => {
    const session = fakeSession();
    const writeSnapshot = vi.fn(async () => '/tmp/toolkit/artifacts/run-id/snapshots/dom.json');

    const report = await discoverDom(
      config,
      'https://example.test/',
      { snapshotFile: 'snapshots/dom.json' },
      {
        openSession: async () => session,
        crawler: async () => snapshot,
        writeSnapshot,
      },
    );

    expect(session.navigate).toHaveBeenCalledWith('https://example.test/', 'domcontentloaded');
    expect(writeSnapshot).toHaveBeenCalledWith(artifactRun, 'snapshots/dom.json', snapshot);
    expect(session.close).toHaveBeenCalledWith({ success: true });
    expect(report.summary.matchedElementCount).toBe(2);
  });

  it('rejects non-JSON snapshot filenames and closes as a failure', async () => {
    const session = fakeSession();

    await expect(
      discoverDom(
        config,
        'https://example.test/',
        { snapshotFile: 'snapshots/dom.txt' },
        {
          openSession: async () => session,
          crawler: async () => snapshot,
        },
      ),
    ).rejects.toMatchObject({ code: 'DOM_SNAPSHOT_FAILED' });

    expect(session.close).toHaveBeenCalledWith({ success: false, reason: 'DOM discovery failed' });
  });
});
