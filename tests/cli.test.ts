import { describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import type { ArtifactRun } from '../src/types/artifacts.js';
import type { BrowserInspectionReport } from '../src/types/browser.js';
import type { ResolvedToolkitConfig } from '../src/types/config.js';
import type { DoctorReport } from '../src/types/doctor.js';
import type { DomDiscoveryReport } from '../src/types/dom.js';
import type { LocatorAnalysisReport } from '../src/types/locator.js';

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
  sources: {
    configFile: null,
    environmentVariables: [],
    cliOptions: [],
  },
};

const healthyReport: DoctorReport = {
  toolkitVersion: '9.9.9',
  checkedAt: '2026-07-17T00:00:00.000Z',
  cwd: '/tmp/toolkit',
  artifactsDir: '/tmp/toolkit/artifacts',
  checks: [],
  summary: { pass: 6, warn: 0, fail: 0 },
};

const browserInspection: BrowserInspectionReport = {
  navigation: {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com/',
    title: 'Example Domain',
    status: 200,
    ok: true,
  },
  session: {
    id: 'browser-run',
    browser: 'chromium',
    mode: 'ephemeral',
    headless: true,
    createdAt: '2026-07-17T00:00:00.000Z',
    currentUrl: 'https://example.com/',
    pageCount: 1,
    traceActive: true,
    userDataDir: null,
    storageStatePath: null,
    artifactRun: {
      id: 'browser-run',
      command: 'browser-inspect',
      createdAt: '2026-07-17T00:00:00.000Z',
      directories: {
        root: '/tmp/toolkit/artifacts',
        run: '/tmp/toolkit/artifacts/browser-run',
        screenshots: '/tmp/toolkit/artifacts/browser-run/screenshots',
        snapshots: '/tmp/toolkit/artifacts/browser-run/snapshots',
        traces: '/tmp/toolkit/artifacts/browser-run/traces',
        reports: '/tmp/toolkit/artifacts/browser-run/reports',
      },
      metadataPath: '/tmp/toolkit/artifacts/browser-run/run.json',
    },
  },
  close: {
    closedAt: '2026-07-17T00:00:01.000Z',
    tracePath: '/tmp/toolkit/artifacts/browser-run/traces/trace.zip',
    screenshotPath: null,
    storageStatePath: null,
    warnings: [],
  },
};

const domDiscoveryReport: DomDiscoveryReport = {
  navigation: browserInspection.navigation,
  session: browserInspection.session,
  artifactRun: browserInspection.session.artifactRun,
  snapshotPath: '/tmp/toolkit/artifacts/browser-run/snapshots/dom-snapshot.json',
  summary: {
    frameCount: 2,
    failedFrameCount: 0,
    shadowRootCount: 1,
    inspectedElementCount: 20,
    matchedElementCount: 4,
    visibleElementCount: 4,
    hiddenElementCount: 0,
    interactiveElementCount: 4,
    sensitiveElementCount: 1,
    redactionCount: 2,
    truncated: false,
    kinds: { button: 2, link: 1, 'text-input': 1 },
  },
  failures: [],
  warnings: [],
  close: browserInspection.close,
};

const locatorAnalysisReport: LocatorAnalysisReport = {
  navigation: browserInspection.navigation,
  session: browserInspection.session,
  artifactRun: browserInspection.session.artifactRun,
  snapshotPath: '/tmp/toolkit/artifacts/browser-run/snapshots/dom-snapshot.json',
  candidatePath: '/tmp/toolkit/artifacts/browser-run/reports/locator-candidates.json',
  domSummary: domDiscoveryReport.summary,
  summary: {
    elementCount: 4,
    candidateCount: 20,
    testedCandidateCount: 20,
    uniqueCandidateCount: 8,
    multipleCandidateCount: 10,
    missingCandidateCount: 2,
    errorCandidateCount: 0,
    elementsWithUniqueCandidate: 4,
    elementsWithoutCandidates: 0,
    strategies: { role: 4, css: 4, text: 4, 'test-id': 4, xpath: 4 },
    recommendedLocatorCount: 4,
    elementsWithRecommendation: 4,
    elementsWithoutRecommendation: 0,
    highConfidenceCandidateCount: 4,
    mediumConfidenceCandidateCount: 8,
    lowConfidenceCandidateCount: 8,
    averageStabilityScore: 58,
  },
  failures: [],
  warnings: [],
  recommendations: [
    {
      elementId: 'element-1',
      elementKind: 'button',
      framePath: 'main',
      playwright: 'page.getByRole("button", { name: "Save", exact: true })',
      strategy: 'role',
      score: 98,
      confidence: 'high',
    },
  ],
  close: browserInspection.close,
};

const artifactRun: ArtifactRun = {
  id: 'run-id',
  command: 'artifacts-init',
  createdAt: '2026-07-17T00:00:00.000Z',
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

describe('CLI', () => {
  it('prints the version command', async () => {
    let output = '';
    const program = createProgram({
      version: '9.9.9',
      writeOut: (value) => {
        output += value;
      },
    });

    await program.parseAsync(['node', 'selector', 'version']);
    expect(output).toBe('9.9.9\n');
  });

  it('prints doctor JSON and sets a successful exit code', async () => {
    let output = '';
    const setExitCode = vi.fn();
    const program = createProgram({
      version: '9.9.9',
      configResolver: async () => resolvedConfig,
      doctorRunner: async () => healthyReport,
      writeOut: (value) => {
        output += value;
      },
      setExitCode,
    });

    await program.parseAsync(['node', 'selector', 'doctor', '--json']);

    expect(JSON.parse(output)).toMatchObject({ toolkitVersion: '9.9.9' });
    expect(setExitCode).toHaveBeenCalledWith(0);
  });

  it('prints resolved configuration as JSON', async () => {
    let output = '';
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      writeOut: (value) => {
        output += value;
      },
    });

    await program.parseAsync(['node', 'selector', 'config', '--json']);
    expect(JSON.parse(output)).toMatchObject({ config: { browser: 'chromium' } });
  });

  it('inspects a browser URL with shared CLI configuration', async () => {
    let output = '';
    const browserInspector = vi.fn(async () => browserInspection);
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      browserInspector,
      writeOut: (value) => {
        output += value;
      },
    });

    await program.parseAsync([
      'node',
      'selector',
      '--navigation-timeout',
      '12000',
      'browser',
      'inspect',
      'https://example.com',
      '--name',
      'example',
    ]);

    expect(browserInspector).toHaveBeenCalledWith(
      resolvedConfig.config,
      'https://example.com',
      expect.objectContaining({
        command: 'browser-inspect',
        name: 'example',
        waitUntil: 'domcontentloaded',
      }),
    );
    expect(output).toContain('Browser inspection complete');
    expect(output).toContain('Example Domain');
  });

  it('discovers a redacted DOM inventory with shared browser options', async () => {
    let output = '';
    const domDiscoverer = vi.fn(async () => domDiscoveryReport);
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      domDiscoverer,
      writeOut: (value) => {
        output += value;
      },
    });

    await program.parseAsync([
      'node',
      'selector',
      'discover',
      'https://example.com',
      '--all-elements',
      '--include-hidden',
      '--max-elements',
      '250',
      '--max-frame-depth',
      '4',
      '--text-limit',
      '120',
      '--snapshot-file',
      'snapshots/login.json',
    ]);

    expect(domDiscoverer).toHaveBeenCalledWith(
      resolvedConfig.config,
      'https://example.com',
      expect.objectContaining({
        scope: 'all',
        includeHidden: true,
        maxElements: 250,
        maxFrameDepth: 4,
        textLimit: 120,
        redact: true,
        snapshotFile: 'snapshots/login.json',
      }),
    );
    expect(output).toContain('DOM discovery complete');
    expect(output).toContain('Elements recorded: 4');
  });

  it('generates locator candidates from the CLI', async () => {
    let output = '';
    const locatorAnalyzer = vi.fn(async () => locatorAnalysisReport);
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      locatorAnalyzer,
      writeOut: (value) => {
        output += value;
      },
    });
    await program.parseAsync([
      'node',
      'selector',
      'locators',
      'https://example.com',
      '--max-candidates',
      '8',
      '--no-xpath',
      '--no-live-test',
      '--candidate-file',
      'reports/login.json',
      '--minimum-score',
      '65',
    ]);
    expect(locatorAnalyzer).toHaveBeenCalledWith(
      resolvedConfig.config,
      'https://example.com',
      expect.objectContaining({
        maxCandidatesPerElement: 8,
        includeXPath: false,
        liveTest: false,
        candidateFile: 'reports/login.json',
        minimumRecommendedScore: 65,
      }),
    );
    expect(output).toContain('Locator candidate analysis complete');
    expect(output).toContain('Unique candidates: 8');
  });

  it('requires discover to receive a URL or baseUrl', async () => {
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      writeOut: () => undefined,
    });

    await expect(program.parseAsync(['node', 'selector', 'discover'])).rejects.toMatchObject({
      code: 'CLI_USAGE_ERROR',
      exitCode: 2,
    });
  });

  it('creates a named artifact run', async () => {
    let output = '';
    const artifactRunCreator = vi.fn(async () => artifactRun);
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      artifactRunCreator,
      writeOut: (value) => {
        output += value;
      },
    });

    await program.parseAsync(['node', 'selector', 'artifacts', 'init', '--name', 'login']);
    expect(artifactRunCreator).toHaveBeenCalledWith(
      resolvedConfig.config,
      expect.objectContaining({ command: 'artifacts-init', name: 'login' }),
    );
    expect(output).toContain('Artifact run created');
  });
});
