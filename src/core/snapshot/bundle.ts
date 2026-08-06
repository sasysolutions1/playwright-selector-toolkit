import { extname, relative } from 'node:path';
import { writeJsonArtifact, writeTextArtifact } from '../artifacts/manager.js';
import { openBrowserSession } from '../browser/session.js';
import { crawlDomSnapshot } from '../dom/crawler.js';
import { SnapshotError } from '../../errors/toolkit-error.js';
import type { BrowserSessionHandle, OpenBrowserSessionOptions } from '../../types/browser.js';
import type { ToolkitConfig } from '../../types/config.js';
import type { DomSnapshot } from '../../types/dom.js';
import type {
  ElementFingerprintIndex,
  SanitizedHtmlFrameArtifact,
  SanitizedHtmlSnapshotManifest,
  SnapshotBundleManifest,
  SnapshotBundleOptions,
  SnapshotBundleReport,
} from '../../types/snapshot.js';
import { createElementFingerprintIndex } from './fingerprint.js';
import { captureSanitizedHtml } from './html.js';

export interface SnapshotBundleDependencies {
  readonly openSession?: (
    config: ToolkitConfig,
    options?: OpenBrowserSessionOptions,
  ) => Promise<BrowserSessionHandle>;
  readonly crawlDom?: typeof crawlDomSnapshot;
  readonly captureHtml?: typeof captureSanitizedHtml;
  readonly fingerprint?: (snapshot: DomSnapshot) => ElementFingerprintIndex;
  readonly writeJson?: typeof writeJsonArtifact;
  readonly writeText?: typeof writeTextArtifact;
}

function requireExtension(path: string, extension: string, description: string): string {
  if (extname(path).toLowerCase() !== extension) {
    throw new SnapshotError('SNAPSHOT_OPTIONS_INVALID', `${description} must end in ${extension}`, {
      details: { path, extension },
      exitCode: 2,
    });
  }
  return path;
}

function safeHtmlFrameName(index: number, framePath: string): string {
  const segment = framePath
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 100);
  return `${String(index + 1).padStart(3, '0')}-${segment || 'frame'}.html`;
}

export async function captureSnapshotBundle(
  config: ToolkitConfig,
  url: string,
  options: SnapshotBundleOptions = {},
  dependencies: SnapshotBundleDependencies = {},
): Promise<SnapshotBundleReport> {
  const session = await (dependencies.openSession ?? openBrowserSession)(config, {
    command: options.command ?? 'snapshot',
    ...(options.name === undefined ? {} : { name: options.name }),
  });

  try {
    const navigation = await session.navigate(url, options.waitUntil ?? 'domcontentloaded');
    const domSnapshot = await (dependencies.crawlDom ?? crawlDomSnapshot)(session.page, url, {
      scope: options.scope ?? 'interactive',
      includeHidden: options.includeHidden ?? false,
      ...(options.maxElements === undefined ? {} : { maxElements: options.maxElements }),
      ...(options.maxFrameDepth === undefined ? {} : { maxFrameDepth: options.maxFrameDepth }),
      ...(options.textLimit === undefined ? {} : { textLimit: options.textLimit }),
      redact: options.redact ?? true,
      ...(session.plugins === undefined ? {} : { pluginHost: session.plugins }),
    });
    const htmlCapture = await (dependencies.captureHtml ?? captureSanitizedHtml)(
      session.page,
      url,
      {
        redact: options.redact ?? true,
        ...(options.maxFrameDepth === undefined ? {} : { maxFrameDepth: options.maxFrameDepth }),
        ...(options.maxFrameCharacters === undefined
          ? {}
          : { maxFrameCharacters: options.maxFrameCharacters }),
        includeStyles: options.includeStyles ?? false,
      },
    );
    const fingerprintIndex = (dependencies.fingerprint ?? createElementFingerprintIndex)(
      domSnapshot,
    );

    const domRelative = requireExtension(
      options.domSnapshotFile ?? 'snapshots/dom-snapshot.json',
      '.json',
      'DOM snapshot file',
    );
    const htmlManifestRelative = requireExtension(
      options.htmlManifestFile ?? 'snapshots/html-snapshot.json',
      '.json',
      'HTML snapshot manifest',
    );
    const fingerprintRelative = requireExtension(
      options.fingerprintFile ?? 'snapshots/element-fingerprints.json',
      '.json',
      'Fingerprint file',
    );
    const bundleRelative = requireExtension(
      options.bundleFile ?? 'reports/snapshot-bundle.json',
      '.json',
      'Bundle manifest',
    );
    const htmlDirectory = (options.htmlDirectory ?? 'snapshots/html').replace(/\/+$/u, '');

    const writeJson = dependencies.writeJson ?? writeJsonArtifact;
    const writeText = dependencies.writeText ?? writeTextArtifact;
    const domSnapshotPath = await writeJson(session.artifactRun, domRelative, domSnapshot);
    const htmlFrameArtifacts: SanitizedHtmlFrameArtifact[] = [];
    const htmlFramePaths: string[] = [];
    for (const [index, frame] of htmlCapture.frames.entries()) {
      const relativePath = `${htmlDirectory}/${safeHtmlFrameName(index, frame.framePath)}`;
      const absolutePath = await writeText(session.artifactRun, relativePath, frame.html);
      htmlFramePaths.push(absolutePath);
      htmlFrameArtifacts.push({
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

    const htmlManifest: SanitizedHtmlSnapshotManifest = {
      schemaVersion: htmlCapture.schemaVersion,
      toolkitVersion: htmlCapture.toolkitVersion,
      capturedAt: htmlCapture.capturedAt,
      requestedUrl: htmlCapture.requestedUrl,
      finalUrl: htmlCapture.finalUrl,
      title: htmlCapture.title,
      options: htmlCapture.options,
      summary: htmlCapture.summary,
      frames: htmlFrameArtifacts,
      failures: htmlCapture.failures,
      warnings: htmlCapture.warnings,
    };
    const htmlManifestPath = await writeJson(
      session.artifactRun,
      htmlManifestRelative,
      htmlManifest,
    );
    const fingerprintPath = await writeJson(
      session.artifactRun,
      fingerprintRelative,
      fingerprintIndex,
    );

    const manifest: SnapshotBundleManifest = {
      schemaVersion: '1.0',
      toolkitVersion: domSnapshot.toolkitVersion,
      createdAt: domSnapshot.capturedAt,
      requestedUrl: url,
      finalUrl: navigation.finalUrl,
      title: navigation.title,
      files: {
        domSnapshot: relative(session.artifactRun.directories.run, domSnapshotPath),
        htmlSnapshot: relative(session.artifactRun.directories.run, htmlManifestPath),
        fingerprints: relative(session.artifactRun.directories.run, fingerprintPath),
        htmlFrames: htmlFrameArtifacts.map((frame) => frame.relativePath),
      },
      domSummary: domSnapshot.summary,
      htmlSummary: htmlCapture.summary,
      fingerprintSummary: fingerprintIndex.summary,
      warnings: [...domSnapshot.warnings, ...htmlCapture.warnings],
    };
    const bundlePath = await writeJson(session.artifactRun, bundleRelative, manifest);
    const sessionSummary = session.summary();
    const close = await session.close({ success: true });

    return {
      navigation,
      session: sessionSummary,
      artifactRun: session.artifactRun,
      bundlePath,
      domSnapshotPath,
      htmlManifestPath,
      fingerprintPath,
      htmlFramePaths,
      manifest,
      close,
    };
  } catch (error) {
    await session.close({ success: false, reason: 'Snapshot capture failed' });
    if (error instanceof SnapshotError) throw error;
    throw new SnapshotError(
      'SNAPSHOT_CAPTURE_FAILED',
      `Could not capture snapshot bundle at ${url}`,
      {
        cause: error,
        details: { url },
      },
    );
  }
}
