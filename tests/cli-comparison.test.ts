import { describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import type { DomComparisonRunReport } from '../src/types/comparison.js';
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

const artifactRun = {
  id: 'compare-run',
  command: 'compare',
  createdAt: '2026-07-18T00:00:00.000Z',
  directories: {
    root: '/tmp/toolkit/artifacts',
    run: '/tmp/toolkit/artifacts/compare-run',
    screenshots: '/tmp/toolkit/artifacts/compare-run/screenshots',
    snapshots: '/tmp/toolkit/artifacts/compare-run/snapshots',
    traces: '/tmp/toolkit/artifacts/compare-run/traces',
    reports: '/tmp/toolkit/artifacts/compare-run/reports',
  },
  metadataPath: '/tmp/toolkit/artifacts/compare-run/run.json',
};

const comparisonReport = {
  schemaVersion: '1.0' as const,
  toolkitVersion: '0.9.0',
  generatedAt: '2026-07-18T00:00:01.000Z',
  baseline: {
    name: 'login',
    version: 'v1',
    capturedAt: '2026-07-18T00:00:00.000Z',
    finalUrl: 'https://example.com/login',
    title: 'Login',
  },
  current: {
    capturedAt: '2026-07-18T00:00:01.000Z',
    finalUrl: 'https://example.com/login',
    title: 'Login',
  },
  options: {
    similarityThreshold: 0.7,
    includeUnchanged: false,
    maxReplacementLocators: 4,
    minimumLocatorScore: 60,
  },
  summary: {
    baselineElementCount: 2,
    currentElementCount: 2,
    matchedElementCount: 1,
    unchangedElementCount: 0,
    addedElementCount: 1,
    removedElementCount: 1,
    movedElementCount: 0,
    changedElementCount: 0,
    movedAndChangedElementCount: 0,
    driftElementCount: 2,
    driftDetected: true,
    matchMethods: { structural: 1, semantic: 0, similarity: 0 },
  },
  differences: [],
  warnings: [],
};

const report: DomComparisonRunReport = {
  baseline: {
    name: 'login',
    version: 'v1',
    directory: '/tmp/toolkit/artifacts/baselines/login/versions/v1',
    manifestPath: '/tmp/toolkit/artifacts/baselines/login/versions/v1/manifest.json',
    manifest: {
      schemaVersion: '1.0',
      toolkitVersion: '0.9.0',
      name: 'login',
      version: 'v1',
      createdAt: comparisonReport.baseline.capturedAt,
      requestedUrl: comparisonReport.baseline.finalUrl,
      finalUrl: comparisonReport.baseline.finalUrl,
      title: comparisonReport.baseline.title,
      sourceArtifactRunId: 'baseline-run',
      files: {
        domSnapshot: 'snapshots/dom.json',
        htmlSnapshot: 'snapshots/html.json',
        fingerprints: 'snapshots/fingerprints.json',
        htmlFrames: [],
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
        kinds: { button: 2 },
      },
      htmlSummary: {
        frameCount: 1,
        failedFrameCount: 0,
        visitedNodeCount: 4,
        serializedElementCount: 4,
        shadowRootCount: 0,
        omittedNodeCount: 0,
        omittedAttributeCount: 0,
        redactionCount: 0,
        truncatedFrameCount: 0,
      },
      fingerprintSummary: {
        elementCount: 2,
        uniqueSemanticHashCount: 2,
        duplicateSemanticGroupCount: 0,
        uniqueStructuralHashCount: 2,
      },
      warnings: [],
    },
  },
  currentSnapshot: {
    navigation: {
      requestedUrl: comparisonReport.current.finalUrl,
      finalUrl: comparisonReport.current.finalUrl,
      title: 'Login',
      status: 200,
      ok: true,
    },
    session: {
      id: artifactRun.id,
      browser: 'chromium',
      mode: 'ephemeral',
      headless: true,
      createdAt: artifactRun.createdAt,
      currentUrl: comparisonReport.current.finalUrl,
      pageCount: 1,
      traceActive: false,
      userDataDir: null,
      storageStatePath: null,
      artifactRun,
    },
    artifactRun,
    bundlePath: `${artifactRun.directories.reports}/snapshot.json`,
    domSnapshotPath: `${artifactRun.directories.snapshots}/dom.json`,
    htmlManifestPath: `${artifactRun.directories.snapshots}/html.json`,
    fingerprintPath: `${artifactRun.directories.snapshots}/fingerprints.json`,
    htmlFramePaths: [],
    manifest: {
      schemaVersion: '1.0',
      toolkitVersion: '0.9.0',
      createdAt: comparisonReport.current.capturedAt,
      requestedUrl: comparisonReport.current.finalUrl,
      finalUrl: comparisonReport.current.finalUrl,
      title: 'Login',
      files: {
        domSnapshot: 'snapshots/dom.json',
        htmlSnapshot: 'snapshots/html.json',
        fingerprints: 'snapshots/fingerprints.json',
        htmlFrames: [],
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
        kinds: { button: 2 },
      },
      htmlSummary: {
        frameCount: 1,
        failedFrameCount: 0,
        visitedNodeCount: 4,
        serializedElementCount: 4,
        shadowRootCount: 0,
        omittedNodeCount: 0,
        omittedAttributeCount: 0,
        redactionCount: 0,
        truncatedFrameCount: 0,
      },
      fingerprintSummary: {
        elementCount: 2,
        uniqueSemanticHashCount: 2,
        duplicateSemanticGroupCount: 0,
        uniqueStructuralHashCount: 2,
      },
      warnings: [],
    },
    close: {
      closedAt: comparisonReport.current.capturedAt,
      tracePath: null,
      screenshotPath: null,
      storageStatePath: null,
      warnings: [],
    },
  },
  artifactRun,
  reportPath: `${artifactRun.directories.reports}/dom-comparison.json`,
  comparison: comparisonReport,
  close: {
    closedAt: comparisonReport.current.capturedAt,
    tracePath: null,
    screenshotPath: null,
    storageStatePath: null,
    warnings: [],
  },
};

describe('compare CLI command', () => {
  it('passes comparison options and fails CI when requested', async () => {
    let output = '';
    const setExitCode = vi.fn();
    const baselineComparer = vi.fn(async () => report);
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      baselineComparer,
      setExitCode,
      writeOut: (value) => {
        output += value;
      },
    });

    await program.parseAsync([
      'node',
      'selector',
      'compare',
      'login',
      'https://example.com/login',
      '--baseline-version',
      'v1',
      '--similarity-threshold',
      '0.7',
      '--max-replacements',
      '4',
      '--minimum-score',
      '60',
      '--fail-on-drift',
    ]);

    expect(baselineComparer).toHaveBeenCalledWith(
      resolvedConfig.config,
      'login',
      'https://example.com/login',
      expect.objectContaining({
        version: 'v1',
        similarityThreshold: 0.7,
        maxReplacementLocators: 4,
        minimumLocatorScore: 60,
      }),
    );
    expect(output).toContain('DOM drift detected');
    expect(setExitCode).toHaveBeenCalledWith(1);
  });
});
