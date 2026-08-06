import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from 'playwright';
import type { ArtifactRun } from '../../types/artifacts.js';
import type {
  DiagnosticElementScreenshotRequest,
  DiagnosticScreenshotArtifact,
  DiagnosticScreenshotFailure,
  DiagnosticScreenshotReport,
} from '../../types/diagnostics.js';

export interface CaptureDiagnosticScreenshotsOptions {
  readonly fullPage?: boolean;
  readonly viewport?: boolean;
  readonly elements?: readonly DiagnosticElementScreenshotRequest[];
  readonly maxElementScreenshots?: number;
}

function safeName(value: string): string {
  const result = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
  return result === '' ? 'element' : result;
}

async function imageDimensions(
  page: Page,
  selector: string,
  index: number,
): Promise<{
  width: number | null;
  height: number | null;
}> {
  const box = await page
    .locator(selector)
    .nth(index)
    .boundingBox()
    .catch(() => null);
  return { width: box?.width ?? null, height: box?.height ?? null };
}

export async function captureDiagnosticScreenshots(
  page: Page,
  run: ArtifactRun,
  options: CaptureDiagnosticScreenshotsOptions = {},
): Promise<DiagnosticScreenshotReport> {
  const artifacts: DiagnosticScreenshotArtifact[] = [];
  const failures: DiagnosticScreenshotFailure[] = [];

  async function capturePage(kind: 'full-page' | 'viewport', fullPage: boolean): Promise<void> {
    const path = resolve(run.directories.screenshots, `${kind}.png`);
    try {
      await page.screenshot({ path, fullPage });
      await stat(path);
      const viewport = page.viewportSize();
      artifacts.push({
        kind,
        path,
        selector: null,
        matchIndex: null,
        width: viewport?.width ?? null,
        height: viewport?.height ?? null,
      });
    } catch (error) {
      failures.push({
        kind,
        selector: null,
        matchIndex: null,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (options.viewport ?? true) await capturePage('viewport', false);
  if (options.fullPage ?? true) await capturePage('full-page', true);

  let capturedElements = 0;
  const maximum = options.maxElementScreenshots ?? 20;
  for (const [requestIndex, request] of (options.elements ?? []).entries()) {
    if (capturedElements >= maximum) break;
    const locator = page.locator(request.selector);
    let count: number;
    try {
      count = await locator.count();
    } catch (error) {
      failures.push({
        kind: 'element',
        selector: request.selector,
        matchIndex: null,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const requestMaximum = Math.min(request.maxMatches ?? 1, maximum - capturedElements);
    if (count === 0) {
      failures.push({
        kind: 'element',
        selector: request.selector,
        matchIndex: null,
        message: 'Selector matched no elements',
      });
      continue;
    }

    for (let index = 0; index < Math.min(count, requestMaximum); index += 1) {
      const name = safeName(request.id ?? `selector-${requestIndex + 1}`);
      const path = resolve(
        run.directories.screenshots,
        `element-${name}-${String(index + 1).padStart(2, '0')}.png`,
      );
      try {
        const target = locator.nth(index);
        await target.scrollIntoViewIfNeeded();
        await target.screenshot({ path });
        const dimensions = await imageDimensions(page, request.selector, index);
        artifacts.push({
          kind: 'element',
          path,
          selector: request.selector,
          matchIndex: index,
          width: dimensions.width,
          height: dimensions.height,
        });
        capturedElements += 1;
      } catch (error) {
        failures.push({
          kind: 'element',
          selector: request.selector,
          matchIndex: index,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return { artifacts, failures };
}
