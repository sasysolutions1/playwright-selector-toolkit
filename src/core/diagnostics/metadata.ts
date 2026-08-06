import type { Page } from 'playwright';
import type { BrowserSessionHandle } from '../../types/browser.js';
import type { DiagnosticPageMetadata } from '../../types/diagnostics.js';
import { sanitizeUrl } from '../dom/redaction.js';

interface BrowserMetadataPayload {
  readonly readyState: string;
  readonly contentType: string;
  readonly characterSet: string;
  readonly language: string;
  readonly userAgent: string;
  readonly platform: string;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio: number;
  };
  readonly document: {
    readonly width: number;
    readonly height: number;
    readonly scrollWidth: number;
    readonly scrollHeight: number;
  };
}

export async function captureDiagnosticPageMetadata(
  page: Page,
  session: BrowserSessionHandle,
  redact = true,
  now: () => Date = () => new Date(),
): Promise<DiagnosticPageMetadata> {
  const payload = await page.evaluate<BrowserMetadataPayload>(() => {
    const root = document.documentElement;
    const body = document.body;
    return {
      readyState: document.readyState,
      contentType: document.contentType,
      characterSet: document.characterSet,
      language: document.documentElement.lang || navigator.language,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      document: {
        width: Math.max(root?.clientWidth ?? 0, body?.clientWidth ?? 0),
        height: Math.max(root?.clientHeight ?? 0, body?.clientHeight ?? 0),
        scrollWidth: Math.max(root?.scrollWidth ?? 0, body?.scrollWidth ?? 0),
        scrollHeight: Math.max(root?.scrollHeight ?? 0, body?.scrollHeight ?? 0),
      },
    };
  });

  return {
    capturedAt: now().toISOString(),
    url: sanitizeUrl(page.url(), redact).value,
    title: await page.title(),
    ...payload,
    frameCount: page.frames().length,
    browserVersion: session.browser?.version() ?? null,
  };
}
