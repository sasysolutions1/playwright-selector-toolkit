import { createHash } from 'node:crypto';
import type { Frame, Page } from 'playwright';
import { SnapshotError } from '../../errors/toolkit-error.js';
import type {
  FrameHtmlPayload,
  ResolvedSanitizedHtmlOptions,
  SanitizedHtmlCapture,
  SanitizedHtmlFrameCapture,
  SanitizedHtmlSnapshotSummary,
} from '../../types/snapshot.js';
import type { DomSnapshotFailure } from '../../types/dom.js';
import { getToolkitVersion } from '../version.js';
import { resolveSanitizedHtmlOptions } from './options.js';
import { serializeSanitizedFrameHtml } from './frame-html-script.js';

export interface SanitizedHtmlDependencies {
  readonly now?: () => Date;
  readonly toolkitVersion?: () => string;
  readonly inspectFrame?: (
    frame: Frame,
    options: ResolvedSanitizedHtmlOptions,
  ) => Promise<FrameHtmlPayload>;
}

function safeFrameSegment(value: string): string {
  const normalized = value
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 50);
  return normalized === '' ? 'unnamed' : normalized;
}

function childFramePath(parentPath: string, index: number, name: string): string {
  return `${parentPath}/frame[${index}]:${safeFrameSegment(name)}`;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown frame error';
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function summarizeSanitizedHtml(
  frames: readonly SanitizedHtmlFrameCapture[],
  failures: readonly DomSnapshotFailure[],
): SanitizedHtmlSnapshotSummary {
  return frames.reduce<SanitizedHtmlSnapshotSummary>(
    (summary, frame) => ({
      frameCount: summary.frameCount + 1,
      failedFrameCount: failures.length,
      visitedNodeCount: summary.visitedNodeCount + frame.stats.visitedNodeCount,
      serializedElementCount: summary.serializedElementCount + frame.stats.serializedElementCount,
      shadowRootCount: summary.shadowRootCount + frame.stats.shadowRootCount,
      omittedNodeCount: summary.omittedNodeCount + frame.stats.omittedNodeCount,
      omittedAttributeCount: summary.omittedAttributeCount + frame.stats.omittedAttributeCount,
      redactionCount: summary.redactionCount + frame.stats.redactionCount,
      truncatedFrameCount: summary.truncatedFrameCount + (frame.stats.truncated ? 1 : 0),
    }),
    {
      frameCount: 0,
      failedFrameCount: failures.length,
      visitedNodeCount: 0,
      serializedElementCount: 0,
      shadowRootCount: 0,
      omittedNodeCount: 0,
      omittedAttributeCount: 0,
      redactionCount: 0,
      truncatedFrameCount: 0,
    },
  );
}

export async function captureSanitizedHtml(
  page: Page,
  requestedUrl: string,
  input: Parameters<typeof resolveSanitizedHtmlOptions>[0] = {},
  dependencies: SanitizedHtmlDependencies = {},
): Promise<SanitizedHtmlCapture> {
  const options = resolveSanitizedHtmlOptions(input);
  const frames: SanitizedHtmlFrameCapture[] = [];
  const failures: DomSnapshotFailure[] = [];
  const warnings: string[] = [];
  const inspectFrame =
    dependencies.inspectFrame ??
    (async (frame, resolved) => frame.evaluate(serializeSanitizedFrameHtml, resolved));

  async function visit(
    frame: Frame,
    framePath: string,
    parentFramePath: string | null,
    depth: number,
    index: number,
  ): Promise<void> {
    if (depth > options.maxFrameDepth) {
      warnings.push(`Skipped ${framePath}: maximum frame depth ${options.maxFrameDepth} exceeded`);
      return;
    }

    const url = frame.url();
    try {
      const payload = await inspectFrame(frame, options);
      frames.push({
        framePath,
        parentFramePath,
        depth,
        index,
        name: frame.name() === '' ? null : frame.name(),
        url,
        title: payload.title,
        html: payload.html,
        hash: sha256(payload.html),
        stats: payload.stats,
      });
    } catch (error) {
      if (depth === 0) {
        throw new SnapshotError('HTML_SNAPSHOT_FAILED', 'Could not serialize the main document', {
          cause: error,
          details: { framePath, url },
        });
      }
      const message = describeError(error);
      failures.push({ framePath, url, message });
      warnings.push(`Could not serialize frame ${framePath}: ${message}`);
    }

    for (const [childIndex, child] of frame.childFrames().entries()) {
      await visit(
        child,
        childFramePath(framePath, childIndex, child.name()),
        framePath,
        depth + 1,
        childIndex,
      );
    }
  }

  try {
    await visit(page.mainFrame(), 'main', null, 0, 0);
    const finalUrl = page.url();
    const title = await page.title().catch(() => '');
    return {
      schemaVersion: '1.0',
      toolkitVersion: dependencies.toolkitVersion?.() ?? getToolkitVersion(),
      capturedAt: (dependencies.now?.() ?? new Date()).toISOString(),
      requestedUrl,
      finalUrl,
      title,
      options,
      summary: summarizeSanitizedHtml(frames, failures),
      frames,
      failures,
      warnings,
    };
  } catch (error) {
    if (error instanceof SnapshotError) throw error;
    throw new SnapshotError('HTML_SNAPSHOT_FAILED', 'Could not capture sanitized HTML', {
      cause: error,
      details: { requestedUrl, finalUrl: page.url() },
    });
  }
}
