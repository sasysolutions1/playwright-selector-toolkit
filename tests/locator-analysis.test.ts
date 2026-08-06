import type { Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { analyzeLocators } from '../src/core/locator/analysis.js';
import type { ArtifactRun } from '../src/types/artifacts.js';
import type { BrowserSessionHandle } from '../src/types/browser.js';
import type { ToolkitConfig } from '../src/types/config.js';
import type { DomSnapshot } from '../src/types/dom.js';
import type { ElementLocatorCandidates } from '../src/types/locator.js';

const config: ToolkitConfig = {
  cwd: '/tmp/toolkit',
  artifactsDir: '/tmp/toolkit/artifacts',
  browser: 'chromium',
  headless: true,
  timeoutMs: 30000,
  navigationTimeoutMs: 45000,
  viewport: { width: 1440, height: 900 },
  trace: 'off',
  screenshots: 'off',
};
const artifactRun: ArtifactRun = {
  id: 'run-id',
  command: 'locators',
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
  requestedUrl: 'https://example.test',
  finalUrl: 'https://example.test/',
  title: 'Fixture',
  options: {
    scope: 'interactive',
    includeHidden: false,
    maxElements: 5000,
    maxFrameDepth: 8,
    textLimit: 240,
    redact: true,
  },
  summary: {
    frameCount: 1,
    failedFrameCount: 0,
    shadowRootCount: 0,
    inspectedElementCount: 1,
    matchedElementCount: 1,
    visibleElementCount: 1,
    hiddenElementCount: 0,
    interactiveElementCount: 1,
    sensitiveElementCount: 0,
    redactionCount: 0,
    truncated: false,
    kinds: { button: 1 },
  },
  frames: [],
  failures: [],
  warnings: [],
};
const candidates: readonly ElementLocatorCandidates[] = [
  {
    element: {
      id: 'element-1',
      framePath: 'main',
      shadowPath: [],
      domPath: '#save',
      tagName: 'button',
      kind: 'button',
      role: 'button',
      accessibleName: 'Save',
      text: 'Save',
      label: null,
      placeholder: null,
      attributes: {},
      visibility: { visible: true, reason: 'visible', inViewport: true, boundingBox: null },
      sensitive: false,
    },
    candidates: [],
    recommendedCandidateId: null,
  },
];

function fakeSession(): BrowserSessionHandle {
  return {
    browser: null,
    context: {} as BrowserSessionHandle['context'],
    page: {} as Page,
    artifactRun,
    navigate: vi.fn(async (url: string) => ({
      requestedUrl: url,
      finalUrl: url,
      title: 'Fixture',
      status: 200,
      ok: true,
    })),
    summary: vi.fn(() => ({
      id: 'run-id',
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
  };
}

describe('locator analysis workflow', () => {
  it('writes DOM and candidate reports', async () => {
    const session = fakeSession();
    const writeArtifact = vi.fn(async (_run: ArtifactRun, path: string) => `/tmp/${path}`);
    const evaluator = vi.fn(async () => candidates);
    const report = await analyzeLocators(
      config,
      'https://example.test/',
      { snapshotFile: 'snapshots/dom.json', candidateFile: 'reports/candidates.json' },
      {
        openSession: async () => session,
        crawler: async () => snapshot,
        generator: () => candidates,
        evaluator,
        writeArtifact,
      },
    );
    expect(evaluator).toHaveBeenCalled();
    expect(writeArtifact).toHaveBeenCalledTimes(2);
    expect(report.candidatePath).toBe('/tmp/reports/candidates.json');
    expect(session.close).toHaveBeenCalledWith({ success: true });
  });

  it('skips live evaluation when requested', async () => {
    const session = fakeSession();
    const evaluator = vi.fn(async () => candidates);
    await analyzeLocators(
      config,
      'https://example.test/',
      { liveTest: false },
      {
        openSession: async () => session,
        crawler: async () => snapshot,
        generator: () => candidates,
        evaluator,
        writeArtifact: async (_run, path) => `/tmp/${path}`,
      },
    );
    expect(evaluator).not.toHaveBeenCalled();
  });

  it('rejects non-JSON report paths', async () => {
    const session = fakeSession();
    await expect(
      analyzeLocators(
        config,
        'https://example.test/',
        { candidateFile: 'report.txt', liveTest: false },
        {
          openSession: async () => session,
          crawler: async () => snapshot,
          generator: () => candidates,
          writeArtifact: async (_run, path) => `/tmp/${path}`,
        },
      ),
    ).rejects.toMatchObject({ code: 'LOCATOR_REPORT_FAILED' });
    expect(session.close).toHaveBeenCalledWith({
      success: false,
      reason: 'Locator analysis failed',
    });
  });
});
