import type { Frame, Page } from 'playwright';
import { DomError } from '../../errors/toolkit-error.js';
import type {
  DomCrawlOptions,
  DomElementSnapshot,
  DomFrameSnapshot,
  DomSnapshot,
  DomSnapshotFailure,
  DomSnapshotSummary,
  FrameDocumentPayload,
  ResolvedDomCrawlOptions,
} from '../../types/dom.js';
import { getToolkitVersion } from '../version.js';
import { inspectFrameDocument } from './frame-script.js';
import { resolveDomCrawlOptions } from './options.js';

export interface DomCrawlerDependencies {
  readonly now?: () => Date;
  readonly toolkitVersion?: () => string;
  readonly inspectFrame?: (
    frame: Frame,
    options: ResolvedDomCrawlOptions,
  ) => Promise<FrameDocumentPayload>;
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

function qualifyElements(
  framePath: string,
  elements: readonly Omit<DomElementSnapshot, 'framePath'>[],
): readonly DomElementSnapshot[] {
  const idPrefix = framePath.replace(/[^a-z0-9]+/giu, '-').replace(/^-+|-+$/gu, '') || 'frame';
  return elements.map((element) => ({
    ...element,
    id: `${idPrefix}-${element.id}`,
    framePath,
  }));
}

function applyPluginRedactions(
  element: DomElementSnapshot,
  pluginHost: DomCrawlOptions['pluginHost'],
): DomElementSnapshot {
  if (pluginHost === undefined || pluginHost.size === 0) return element;
  let redactionsApplied = element.redactionsApplied;
  const redact = (value: string | null, field: string): string | null => {
    if (value === null) return null;
    const redacted = pluginHost.redactText(value, {
      field,
      elementId: element.id,
      framePath: element.framePath,
    });
    if (redacted !== value) redactionsApplied += 1;
    return redacted;
  };
  const attributes: Record<string, string> = {};
  for (const [name, value] of Object.entries(element.attributes)) {
    attributes[name] = redact(value, `attribute:${name}`) ?? '';
  }
  return {
    ...element,
    accessibleName: redact(element.accessibleName, 'accessibleName'),
    text: redact(element.text, 'text'),
    label: redact(element.label, 'label'),
    placeholder: redact(element.placeholder, 'placeholder'),
    attributes,
    redactionsApplied,
    sensitive: element.sensitive || redactionsApplied > element.redactionsApplied,
  };
}

export function summarizeDomSnapshot(
  frames: readonly DomFrameSnapshot[],
  failures: readonly DomSnapshotFailure[],
): DomSnapshotSummary {
  const kinds: Record<string, number> = {};
  let shadowRootCount = 0;
  let inspectedElementCount = 0;
  let matchedElementCount = 0;
  let visibleElementCount = 0;
  let hiddenElementCount = 0;
  let interactiveElementCount = 0;
  let sensitiveElementCount = 0;
  let redactionCount = 0;
  let truncated = false;

  for (const frame of frames) {
    shadowRootCount += frame.shadowRootCount;
    inspectedElementCount += frame.inspectedElementCount;
    matchedElementCount += frame.matchedElementCount;
    truncated ||= frame.truncated;

    for (const element of frame.elements) {
      kinds[element.kind] = (kinds[element.kind] ?? 0) + 1;
      if (element.visibility.visible) visibleElementCount += 1;
      else hiddenElementCount += 1;
      if (element.interactive) interactiveElementCount += 1;
      if (element.sensitive) sensitiveElementCount += 1;
      redactionCount += element.redactionsApplied;
    }
  }

  return {
    frameCount: frames.length,
    failedFrameCount: failures.length,
    shadowRootCount,
    inspectedElementCount,
    matchedElementCount,
    visibleElementCount,
    hiddenElementCount,
    interactiveElementCount,
    sensitiveElementCount,
    redactionCount,
    truncated,
    kinds,
  };
}

export async function crawlDomSnapshot(
  page: Page,
  requestedUrl: string,
  crawlOptions: DomCrawlOptions = {},
  dependencies: DomCrawlerDependencies = {},
): Promise<DomSnapshot> {
  const options = resolveDomCrawlOptions(crawlOptions);
  const frames: DomFrameSnapshot[] = [];
  const failures: DomSnapshotFailure[] = [];
  const warnings: string[] = [];
  const inspectFrame =
    dependencies.inspectFrame ??
    (async (frame: Frame, frameOptions: ResolvedDomCrawlOptions) =>
      frame.evaluate(inspectFrameDocument, frameOptions));
  let remainingElements = options.maxElements;

  async function visitFrame(
    frame: Frame,
    path: string,
    parentPath: string | null,
    depth: number,
    index: number,
  ): Promise<void> {
    if (depth > options.maxFrameDepth) {
      warnings.push(`Skipped ${path}: maximum frame depth ${options.maxFrameDepth} was reached.`);
      return;
    }

    const url = frame.url();
    if (remainingElements <= 0) {
      warnings.push(
        `Skipped ${path}: the global element limit ${options.maxElements} was reached.`,
      );
      return;
    }

    try {
      const payload = await inspectFrame(frame, {
        ...options,
        maxElements: remainingElements,
      });
      const elements = qualifyElements(path, payload.elements).map((element) =>
        applyPluginRedactions(element, crawlOptions.pluginHost),
      );
      remainingElements -= elements.length;
      frames.push({
        path,
        parentPath,
        depth,
        index,
        name: frame.name() || null,
        url,
        title: payload.title,
        language: payload.language,
        readyState: payload.readyState,
        shadowRootCount: payload.shadowRootCount,
        inspectedElementCount: payload.inspectedElementCount,
        matchedElementCount: elements.length,
        truncated: payload.truncated || remainingElements <= 0,
        elements,
      });
    } catch (error) {
      if (depth === 0) {
        throw new DomError('DOM_CRAWL_FAILED', 'Could not inspect the main document', {
          cause: error,
          details: { framePath: path, url },
        });
      }
      failures.push({ framePath: path, url, message: describeError(error) });
      warnings.push(`Could not inspect frame ${path}: ${describeError(error)}`);
    }

    const children = frame.childFrames();
    for (const [childIndex, child] of children.entries()) {
      await visitFrame(
        child,
        childFramePath(path, childIndex, child.name()),
        path,
        depth + 1,
        childIndex,
      );
    }
  }

  try {
    await visitFrame(page.mainFrame(), 'main', null, 0, 0);
    const finalUrl =
      crawlOptions.pluginHost?.sanitizeUrl(page.url(), {
        field: 'snapshot.finalUrl',
        elementId: null,
        framePath: null,
      }) ?? page.url();
    const title = await page.title().catch(() => '');
    const summary = summarizeDomSnapshot(frames, failures);
    return {
      schemaVersion: '1.0',
      toolkitVersion: dependencies.toolkitVersion?.() ?? getToolkitVersion(),
      capturedAt: (dependencies.now?.() ?? new Date()).toISOString(),
      requestedUrl:
        crawlOptions.pluginHost?.sanitizeUrl(requestedUrl, {
          field: 'snapshot.requestedUrl',
          elementId: null,
          framePath: null,
        }) ?? requestedUrl,
      finalUrl,
      title,
      options,
      summary,
      frames,
      failures,
      warnings,
    };
  } catch (error) {
    if (error instanceof DomError) throw error;
    throw new DomError('DOM_CRAWL_FAILED', 'Could not crawl the current DOM', {
      cause: error,
      details: { requestedUrl, finalUrl: page.url() },
    });
  }
}
