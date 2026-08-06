import { describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import type { ResolvedToolkitConfig } from '../src/types/config.js';
import type {
  BaselineRecord,
  BaselineSaveReport,
  SnapshotBundleReport,
} from '../src/types/snapshot.js';

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

const artifactRun = {
  id: 'snapshot-run',
  command: 'snapshot',
  createdAt: '2026-07-18T00:00:00.000Z',
  directories: {
    root: '/tmp/toolkit/artifacts',
    run: '/tmp/toolkit/artifacts/snapshot-run',
    screenshots: '/tmp/toolkit/artifacts/snapshot-run/screenshots',
    snapshots: '/tmp/toolkit/artifacts/snapshot-run/snapshots',
    traces: '/tmp/toolkit/artifacts/snapshot-run/traces',
    reports: '/tmp/toolkit/artifacts/snapshot-run/reports',
  },
  metadataPath: '/tmp/toolkit/artifacts/snapshot-run/run.json',
};

const manifest = {
  schemaVersion: '1.0' as const,
  toolkitVersion: '0.8.0',
  createdAt: '2026-07-18T00:00:00.000Z',
  requestedUrl: 'https://example.com',
  finalUrl: 'https://example.com/',
  title: 'Example',
  files: {
    domSnapshot: 'snapshots/dom-snapshot.json',
    htmlSnapshot: 'snapshots/html-snapshot.json',
    fingerprints: 'snapshots/element-fingerprints.json',
    htmlFrames: ['snapshots/html/001-main.html'],
  },
  domSummary: {
    frameCount: 1,
    failedFrameCount: 0,
    shadowRootCount: 0,
    inspectedElementCount: 2,
    matchedElementCount: 2,
    visibleElementCount: 2,
    hiddenElementCount: 0,
    interactiveElementCount: 2,
    sensitiveElementCount: 0,
    redactionCount: 0,
    truncated: false,
    kinds: { button: 1, link: 1 },
  },
  htmlSummary: {
    frameCount: 1,
    failedFrameCount: 0,
    visitedNodeCount: 8,
    serializedElementCount: 5,
    shadowRootCount: 0,
    omittedNodeCount: 1,
    omittedAttributeCount: 1,
    redactionCount: 2,
    truncatedFrameCount: 0,
  },
  fingerprintSummary: {
    elementCount: 2,
    uniqueSemanticHashCount: 2,
    duplicateSemanticGroupCount: 0,
    uniqueStructuralHashCount: 2,
  },
  warnings: [],
};

const snapshotReport: SnapshotBundleReport = {
  navigation: {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com/',
    title: 'Example',
    status: 200,
    ok: true,
  },
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
  bundlePath: '/tmp/toolkit/artifacts/snapshot-run/reports/snapshot-bundle.json',
  domSnapshotPath: '/tmp/toolkit/artifacts/snapshot-run/snapshots/dom-snapshot.json',
  htmlManifestPath: '/tmp/toolkit/artifacts/snapshot-run/snapshots/html-snapshot.json',
  fingerprintPath: '/tmp/toolkit/artifacts/snapshot-run/snapshots/element-fingerprints.json',
  htmlFramePaths: ['/tmp/toolkit/artifacts/snapshot-run/snapshots/html/001-main.html'],
  manifest,
  close: {
    closedAt: '2026-07-18T00:00:01.000Z',
    tracePath: null,
    screenshotPath: null,
    storageStatePath: null,
    warnings: [],
  },
};

const baseline: BaselineRecord = {
  name: 'login',
  version: '2026-07-18T00-00-00-000Z-snapshot',
  directory: '/tmp/toolkit/artifacts/baselines/login/versions/version',
  manifestPath: '/tmp/toolkit/artifacts/baselines/login/versions/version/manifest.json',
  manifest: {
    schemaVersion: '1.0',
    toolkitVersion: '0.8.0',
    name: 'login',
    version: '2026-07-18T00-00-00-000Z-snapshot',
    createdAt: manifest.createdAt,
    requestedUrl: manifest.requestedUrl,
    finalUrl: manifest.finalUrl,
    title: manifest.title,
    sourceArtifactRunId: artifactRun.id,
    files: manifest.files,
    domSummary: manifest.domSummary,
    htmlSummary: manifest.htmlSummary,
    fingerprintSummary: manifest.fingerprintSummary,
    warnings: [],
  },
};

describe('snapshot and baseline CLI commands', () => {
  it('passes snapshot flags and formats the result', async () => {
    let output = '';
    const snapshotCapturer = vi.fn(async () => snapshotReport);
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      snapshotCapturer,
      writeOut: (value) => {
        output += value;
      },
    });
    await program.parseAsync([
      'node',
      'selector',
      'snapshot',
      'https://example.com',
      '--all-elements',
      '--include-hidden',
      '--max-frame-characters',
      '50000',
      '--include-styles',
    ]);
    expect(snapshotCapturer).toHaveBeenCalledWith(
      resolvedConfig.config,
      'https://example.com',
      expect.objectContaining({
        scope: 'all',
        includeHidden: true,
        maxFrameCharacters: 50_000,
        includeStyles: true,
      }),
    );
    expect(output).toContain('Snapshot bundle captured');
    expect(output).toContain('Semantic fingerprints: 2');
  });

  it('saves, lists, and shows baselines', async () => {
    let output = '';
    const baselineCapturer = vi.fn(async (): Promise<BaselineSaveReport> => ({
      snapshot: snapshotReport,
      baseline,
    }));
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      baselineCapturer,
      baselineLister: async () => [
        {
          name: baseline.name,
          latestVersion: baseline.version,
          createdAt: baseline.manifest.createdAt,
          finalUrl: baseline.manifest.finalUrl,
          title: baseline.manifest.title,
          manifestPath: baseline.manifestPath,
        },
      ],
      baselineLoader: async () => baseline,
      writeOut: (value) => {
        output += value;
      },
    });

    await program.parseAsync([
      'node',
      'selector',
      'baseline',
      'save',
      'login',
      'https://example.com',
    ]);
    expect(baselineCapturer).toHaveBeenCalledWith(
      resolvedConfig.config,
      'login',
      'https://example.com',
      expect.objectContaining({ command: 'baseline-save', name: 'login' }),
    );
    expect(output).toContain('Baseline saved');

    output = '';
    await program.parseAsync(['node', 'selector', 'baseline', 'list']);
    expect(output).toContain('Saved baselines: 1');

    output = '';
    await program.parseAsync(['node', 'selector', 'baseline', 'show', 'login']);
    expect(output).toContain('Name: login');
  });
});
