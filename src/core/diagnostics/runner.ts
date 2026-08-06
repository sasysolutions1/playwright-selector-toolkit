import { relative } from 'node:path';
import type { BrowserSessionHandle, OpenBrowserSessionOptions } from '../../types/browser.js';
import type { ToolkitConfig } from '../../types/config.js';
import type {
  DiagnosticEvidenceExecution,
  DiagnosticEvidenceFiles,
  DiagnosticEvidenceManifest,
  DiagnosticEvidenceOptions,
  DiagnosticEvidenceReport,
  DiagnosticFailure,
  DiagnosticOperation,
} from '../../types/diagnostics.js';
import type { DomSnapshot } from '../../types/dom.js';
import type {
  SanitizedHtmlFrameArtifact,
  SanitizedHtmlSnapshotManifest,
} from '../../types/snapshot.js';
import { DiagnosticError, normalizeError } from '../../errors/toolkit-error.js';
import { writeJsonArtifact, writeTextArtifact } from '../artifacts/manager.js';
import { openBrowserSession } from '../browser/session.js';
import { crawlDomSnapshot } from '../dom/crawler.js';
import { redactSensitiveText } from '../dom/redaction.js';
import { captureSanitizedHtml } from '../snapshot/html.js';
import { getToolkitVersion } from '../version.js';
import { createDiagnosticArchive } from './archive.js';
import { DiagnosticRecorder } from './collector.js';
import { captureDiagnosticPageMetadata } from './metadata.js';
import { resolveDiagnosticEvidenceOptions } from './options.js';
import { captureDiagnosticScreenshots } from './screenshots.js';

export interface DiagnosticEvidenceDependencies {
  readonly openSession?: (
    config: ToolkitConfig,
    options?: OpenBrowserSessionOptions,
  ) => Promise<BrowserSessionHandle>;
  readonly createArchive?: typeof createDiagnosticArchive;
  readonly now?: () => Date;
  readonly toolkitVersion?: () => string;
}

interface SnapshotArtifacts {
  readonly domSnapshotPath: string | null;
  readonly htmlManifestPath: string | null;
  readonly htmlFramePaths: readonly string[];
  readonly warnings: readonly string[];
}

function relativeToRun(run: BrowserSessionHandle['artifactRun'], path: string): string {
  return relative(run.directories.run, path).replaceAll('\\', '/');
}

function safeFrameName(index: number, framePath: string): string {
  const segment = framePath
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 100);
  return `${String(index + 1).padStart(3, '0')}-${segment || 'frame'}.html`;
}

function describeFailure(error: unknown, redact: boolean): DiagnosticFailure {
  const normalized = normalizeError(error);
  const sanitize = (value: string): string => (redact ? redactSensitiveText(value).value : value);
  return {
    name: sanitize(normalized.name),
    message: sanitize(normalized.message),
    stack: normalized.stack === undefined ? null : sanitize(normalized.stack),
  };
}

async function captureSnapshots(
  session: BrowserSessionHandle,
  requestedUrl: string,
  includeDomSnapshot: boolean,
  includeHtmlSnapshot: boolean,
  redact: boolean,
): Promise<SnapshotArtifacts> {
  const warnings: string[] = [];
  let domSnapshotPath: string | null = null;
  let htmlManifestPath: string | null = null;
  const htmlFramePaths: string[] = [];

  if (includeDomSnapshot) {
    try {
      const snapshot: DomSnapshot = await crawlDomSnapshot(session.page, requestedUrl, {
        scope: 'all',
        includeHidden: true,
        maxElements: 2_000,
        maxFrameDepth: 8,
        textLimit: 500,
        redact,
        ...(session.plugins === undefined ? {} : { pluginHost: session.plugins }),
      });
      domSnapshotPath = await writeJsonArtifact(
        session.artifactRun,
        'snapshots/diagnostic-dom.json',
        snapshot,
      );
    } catch (error) {
      warnings.push(
        `Could not capture diagnostic DOM snapshot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (includeHtmlSnapshot) {
    try {
      const capture = await captureSanitizedHtml(session.page, requestedUrl, {
        redact,
        maxFrameDepth: 8,
        maxFrameCharacters: 2_000_000,
        includeStyles: false,
      });
      const frameArtifacts: SanitizedHtmlFrameArtifact[] = [];
      for (const [index, frame] of capture.frames.entries()) {
        const relativePath = `snapshots/html/${safeFrameName(index, frame.framePath)}`;
        const path = await writeTextArtifact(session.artifactRun, relativePath, frame.html);
        htmlFramePaths.push(path);
        frameArtifacts.push({
          framePath: frame.framePath,
          parentFramePath: frame.parentFramePath,
          depth: frame.depth,
          index: frame.index,
          name: frame.name,
          url: frame.url,
          title: frame.title,
          hash: frame.hash,
          stats: frame.stats,
          relativePath,
          characterCount: frame.html.length,
        });
      }
      const manifest: SanitizedHtmlSnapshotManifest = {
        schemaVersion: capture.schemaVersion,
        toolkitVersion: capture.toolkitVersion,
        capturedAt: capture.capturedAt,
        requestedUrl: capture.requestedUrl,
        finalUrl: capture.finalUrl,
        title: capture.title,
        options: capture.options,
        summary: capture.summary,
        frames: frameArtifacts,
        failures: capture.failures,
        warnings: capture.warnings,
      };
      htmlManifestPath = await writeJsonArtifact(
        session.artifactRun,
        'snapshots/diagnostic-html.json',
        manifest,
      );
      warnings.push(...capture.warnings);
    } catch (error) {
      warnings.push(
        `Could not capture sanitized diagnostic HTML: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { domSnapshotPath, htmlManifestPath, htmlFramePaths, warnings };
}

function policyFailure(
  pageErrors: number,
  requestFailures: number,
  httpErrors: number,
  options: ReturnType<typeof resolveDiagnosticEvidenceOptions>,
): DiagnosticFailure | null {
  const reasons: string[] = [];
  if (options.failOnPageError && pageErrors > 0) reasons.push(`${pageErrors} page error(s)`);
  if (options.failOnRequestFailure && requestFailures > 0) {
    reasons.push(`${requestFailures} failed request(s)`);
  }
  if (options.failOnHttpError && httpErrors > 0) reasons.push(`${httpErrors} HTTP error(s)`);
  if (reasons.length === 0) return null;
  return {
    name: 'DiagnosticPolicyFailure',
    message: `Diagnostic failure policy matched: ${reasons.join(', ')}`,
    stack: null,
  };
}

export async function runWithDiagnosticEvidence<Value>(
  config: ToolkitConfig,
  url: string,
  operation: DiagnosticOperation<Value>,
  options: DiagnosticEvidenceOptions = {},
  dependencies: DiagnosticEvidenceDependencies = {},
): Promise<DiagnosticEvidenceExecution<Value>> {
  const resolved = resolveDiagnosticEvidenceOptions(options);
  const diagnosticConfig: ToolkitConfig = {
    ...config,
    trace: resolved.includeTrace ? 'on' : 'off',
    screenshots: 'off',
  };
  const now = dependencies.now ?? (() => new Date());
  const session = await (dependencies.openSession ?? openBrowserSession)(diagnosticConfig, {
    command: resolved.command,
    ...(resolved.name === undefined ? {} : { name: resolved.name }),
  });
  const recorder = new DiagnosticRecorder(session.page, {
    includeConsole: resolved.includeConsole,
    includeNetwork: resolved.includeNetwork,
    maxEntries: resolved.maxEntries,
    redact: resolved.redact,
    now,
  });
  recorder.start();

  let navigation = null;
  let metadata = null;
  let value: Value | null = null;
  let failure: DiagnosticFailure | null = null;
  const warnings: string[] = [];

  try {
    navigation = await session.navigate(url, resolved.waitUntil);
    if (resolved.waitAfterMs > 0) await session.page.waitForTimeout(resolved.waitAfterMs);
    value = await operation(session, session.page);
  } catch (error) {
    failure = describeFailure(error, resolved.redact);
  }

  try {
    if (!session.page.isClosed()) {
      metadata = await captureDiagnosticPageMetadata(session.page, session, resolved.redact, now);
    }
  } catch (error) {
    warnings.push(
      `Could not capture page metadata: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const screenshots = session.page.isClosed()
    ? { artifacts: [], failures: [] }
    : await captureDiagnosticScreenshots(session.page, session.artifactRun, {
        fullPage: resolved.fullPageScreenshot,
        viewport: resolved.viewportScreenshot,
        elements: resolved.elementScreenshots,
        maxElementScreenshots: resolved.maxElementScreenshots,
      });
  const snapshotArtifacts = session.page.isClosed()
    ? {
        domSnapshotPath: null,
        htmlManifestPath: null,
        htmlFramePaths: [],
        warnings: ['Page closed before diagnostic snapshots could be captured'],
      }
    : await captureSnapshots(
        session,
        url,
        resolved.includeDomSnapshot,
        resolved.includeHtmlSnapshot,
        resolved.redact,
      );
  warnings.push(...snapshotArtifacts.warnings);

  recorder.stop();
  const recorderSnapshot = recorder.snapshot();
  if (failure === null) {
    failure = policyFailure(
      recorderSnapshot.summary.pageErrorCount,
      recorderSnapshot.summary.requestFailureCount,
      recorderSnapshot.summary.httpErrorCount,
      resolved,
    );
  }
  const success = failure === null;

  const metadataPath = await writeJsonArtifact(
    session.artifactRun,
    'reports/page-metadata.json',
    metadata,
  );
  const eventsPath = await writeJsonArtifact(
    session.artifactRun,
    'reports/diagnostic-events.json',
    recorderSnapshot,
  );
  const sessionSummary = session.summary();
  const close = await session.close({
    success,
    reason: success ? 'Diagnostic evidence captured' : 'Diagnostic evidence captured after failure',
  });
  warnings.push(...close.warnings);

  const files: DiagnosticEvidenceFiles = {
    metadata: relativeToRun(session.artifactRun, metadataPath),
    events: relativeToRun(session.artifactRun, eventsPath),
    domSnapshot:
      snapshotArtifacts.domSnapshotPath === null
        ? null
        : relativeToRun(session.artifactRun, snapshotArtifacts.domSnapshotPath),
    htmlSnapshot:
      snapshotArtifacts.htmlManifestPath === null
        ? null
        : relativeToRun(session.artifactRun, snapshotArtifacts.htmlManifestPath),
    htmlFrames: snapshotArtifacts.htmlFramePaths.map((path) =>
      relativeToRun(session.artifactRun, path),
    ),
    screenshots: screenshots.artifacts.map((item) => relativeToRun(session.artifactRun, item.path)),
    trace: close.tracePath === null ? null : relativeToRun(session.artifactRun, close.tracePath),
  };
  const manifest: DiagnosticEvidenceManifest = {
    schemaVersion: '1.0',
    toolkitVersion: (dependencies.toolkitVersion ?? getToolkitVersion)(),
    createdAt: now().toISOString(),
    success,
    requestedUrl: url,
    finalUrl: navigation?.finalUrl ?? metadata?.url ?? null,
    title: navigation?.title ?? metadata?.title ?? null,
    navigation,
    metadata,
    recorder: recorderSnapshot,
    screenshots,
    files,
    failure,
    warnings,
  };
  const reportPath = await writeJsonArtifact(session.artifactRun, resolved.reportFile, manifest);
  const archivePath = resolved.archive
    ? await (dependencies.createArchive ?? createDiagnosticArchive)(
        session.artifactRun,
        resolved.archiveFile,
      )
    : null;

  return {
    value,
    evidence: {
      success,
      navigation,
      session: sessionSummary,
      artifactRun: session.artifactRun,
      reportPath,
      archivePath,
      manifest,
      close,
    },
  };
}

export async function captureDiagnosticEvidence(
  config: ToolkitConfig,
  url: string,
  options: DiagnosticEvidenceOptions = {},
  dependencies: DiagnosticEvidenceDependencies = {},
): Promise<DiagnosticEvidenceReport> {
  const result = await runWithDiagnosticEvidence(
    config,
    url,
    async () => undefined,
    options,
    dependencies,
  );
  return result.evidence;
}

export async function withFailureEvidence<Value>(
  config: ToolkitConfig,
  url: string,
  operation: DiagnosticOperation<Value>,
  options: DiagnosticEvidenceOptions = {},
  dependencies: DiagnosticEvidenceDependencies = {},
): Promise<Value> {
  const result = await runWithDiagnosticEvidence(config, url, operation, options, dependencies);
  if (!result.evidence.success) {
    throw new DiagnosticError(
      'DIAGNOSTIC_OPERATION_FAILED',
      result.evidence.manifest.failure?.message ?? 'Diagnostic operation failed',
      {
        details: {
          reportPath: result.evidence.reportPath,
          archivePath: result.evidence.archivePath,
          artifactDirectory: result.evidence.artifactRun.directories.run,
        },
      },
    );
  }
  return result.value as Value;
}

export function diagnosticEvidenceExitCode(report: DiagnosticEvidenceReport): number {
  return report.success ? 0 : 1;
}
