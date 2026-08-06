import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { createArtifactRun } from '../src/core/artifacts/manager.js';
import { captureSnapshotBundle } from '../src/core/snapshot/bundle.js';
import type { BrowserSessionHandle } from '../src/types/browser.js';
import type { ToolkitConfig } from '../src/types/config.js';
import type { DomSnapshot } from '../src/types/dom.js';
import type { SanitizedHtmlCapture } from '../src/types/snapshot.js';

function config(cwd: string): ToolkitConfig {
  return {
    cwd,
    artifactsDir: join(cwd, 'artifacts'),
    browser: 'chromium',
    headless: true,
    timeoutMs: 30_000,
    navigationTimeoutMs: 45_000,
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    screenshots: 'off',
  };
}

function domSnapshot(): DomSnapshot {
  return {
    schemaVersion: '1.0',
    toolkitVersion: '0.8.0-test',
    capturedAt: '2026-07-18T00:00:00.000Z',
    requestedUrl: 'https://example.test',
    finalUrl: 'https://example.test/',
    title: 'Fixture',
    options: {
      scope: 'interactive',
      includeHidden: false,
      maxElements: 500,
      maxFrameDepth: 8,
      textLimit: 200,
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
    frames: [
      {
        path: 'main',
        parentPath: null,
        depth: 0,
        index: 0,
        name: null,
        url: 'https://example.test/',
        title: 'Fixture',
        language: 'en',
        readyState: 'complete',
        shadowRootCount: 0,
        inspectedElementCount: 1,
        matchedElementCount: 1,
        truncated: false,
        elements: [
          {
            id: 'main-element-1',
            framePath: 'main',
            shadowPath: [],
            domPath: 'html > body > button#send',
            tagName: 'button',
            kind: 'button',
            role: 'button',
            accessibleName: 'Send',
            text: 'Send',
            label: null,
            placeholder: null,
            attributes: { id: 'send' },
            visibility: {
              visible: true,
              reason: 'visible',
              inViewport: true,
              boundingBox: { x: 0, y: 0, width: 100, height: 30 },
            },
            interactive: true,
            interactivitySources: ['native-control'],
            disabled: false,
            readonly: false,
            required: false,
            checked: null,
            selected: null,
            sensitive: false,
            redactionsApplied: 0,
          },
        ],
      },
    ],
    failures: [],
    warnings: [],
  };
}

function htmlCapture(): SanitizedHtmlCapture {
  return {
    schemaVersion: '1.0',
    toolkitVersion: '0.8.0-test',
    capturedAt: '2026-07-18T00:00:00.000Z',
    requestedUrl: 'https://example.test',
    finalUrl: 'https://example.test/',
    title: 'Fixture',
    options: {
      redact: true,
      maxFrameDepth: 8,
      maxFrameCharacters: 2_000_000,
      includeStyles: false,
    },
    summary: {
      frameCount: 1,
      failedFrameCount: 0,
      visitedNodeCount: 4,
      serializedElementCount: 3,
      shadowRootCount: 0,
      omittedNodeCount: 1,
      omittedAttributeCount: 1,
      redactionCount: 1,
      truncatedFrameCount: 0,
    },
    frames: [
      {
        framePath: 'main',
        parentFramePath: null,
        depth: 0,
        index: 0,
        name: null,
        url: 'https://example.test/',
        title: 'Fixture',
        html: '<!doctype html><html><body><button>Send</button></body></html>',
        hash: 'abc',
        stats: {
          visitedNodeCount: 4,
          serializedElementCount: 3,
          shadowRootCount: 0,
          omittedNodeCount: 1,
          omittedAttributeCount: 1,
          redactionCount: 1,
          truncated: false,
        },
      },
    ],
    failures: [],
    warnings: [],
  };
}

describe('snapshot bundle', () => {
  it('writes DOM, HTML, fingerprint, and bundle artifacts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'selector-snapshot-'));
    const toolkitConfig = config(cwd);
    const artifactRun = await createArtifactRun(toolkitConfig, {
      command: 'snapshot',
      id: '12345678-0000-0000-0000-000000000000',
      now: new Date('2026-07-18T00:00:00.000Z'),
    });
    const close = {
      closedAt: '2026-07-18T00:00:01.000Z',
      tracePath: null,
      screenshotPath: null,
      storageStatePath: null,
      warnings: [],
    } as const;
    const session = {
      browser: null,
      context: {} as BrowserSessionHandle['context'],
      page: {} as Page,
      artifactRun,
      navigate: vi.fn(async (url: string) => ({
        requestedUrl: url,
        finalUrl: 'https://example.test/',
        title: 'Fixture',
        status: 200,
        ok: true,
      })),
      summary: () => ({
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
      }),
      saveStorageState: vi.fn(async () => ''),
      close: vi.fn(async () => close),
    } satisfies BrowserSessionHandle;

    const report = await captureSnapshotBundle(
      toolkitConfig,
      'https://example.test',
      {},
      {
        openSession: async () => session,
        crawlDom: async () => domSnapshot(),
        captureHtml: async () => htmlCapture(),
      },
    );

    expect(report.htmlFramePaths).toHaveLength(1);
    expect(JSON.parse(await readFile(report.bundlePath, 'utf8'))).toMatchObject({
      schemaVersion: '1.0',
      files: {
        domSnapshot: 'snapshots/dom-snapshot.json',
        htmlSnapshot: 'snapshots/html-snapshot.json',
        fingerprints: 'snapshots/element-fingerprints.json',
      },
    });
    expect(await readFile(report.htmlFramePaths[0]!, 'utf8')).toContain('<button>Send</button>');
    expect(report.manifest.fingerprintSummary.elementCount).toBe(1);
  });

  it('rejects output files with invalid extensions', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'selector-snapshot-invalid-'));
    const toolkitConfig = config(cwd);
    const artifactRun = await createArtifactRun(toolkitConfig, {
      command: 'snapshot',
      id: '87654321-0000-0000-0000-000000000000',
    });
    const session = {
      browser: null,
      context: {} as BrowserSessionHandle['context'],
      page: {} as Page,
      artifactRun,
      navigate: async (url: string) => ({
        requestedUrl: url,
        finalUrl: url,
        title: '',
        status: 200,
        ok: true,
      }),
      summary: () => ({
        id: artifactRun.id,
        browser: 'chromium' as const,
        mode: 'ephemeral' as const,
        headless: true,
        createdAt: artifactRun.createdAt,
        currentUrl: 'https://example.test',
        pageCount: 1,
        traceActive: false,
        userDataDir: null,
        storageStatePath: null,
        artifactRun,
      }),
      saveStorageState: async () => '',
      close: async () => ({
        closedAt: new Date().toISOString(),
        tracePath: null,
        screenshotPath: null,
        storageStatePath: null,
        warnings: [],
      }),
    } satisfies BrowserSessionHandle;
    await expect(
      captureSnapshotBundle(
        toolkitConfig,
        'https://example.test',
        { domSnapshotFile: 'snapshot.txt' },
        {
          openSession: async () => session,
          crawlDom: async () => domSnapshot(),
          captureHtml: async () => htmlCapture(),
        },
      ),
    ).rejects.toMatchObject({ code: 'SNAPSHOT_OPTIONS_INVALID' });
  });
});
