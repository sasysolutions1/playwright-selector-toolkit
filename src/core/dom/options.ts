import { DomError } from '../../errors/toolkit-error.js';
import type { DomCrawlOptions, ResolvedDomCrawlOptions } from '../../types/dom.js';

export const DEFAULT_DOM_CRAWL_OPTIONS: ResolvedDomCrawlOptions = {
  scope: 'interactive',
  includeHidden: false,
  maxElements: 5_000,
  maxFrameDepth: 8,
  textLimit: 240,
  redact: true,
};

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw new DomError(
      'DOM_OPTIONS_INVALID',
      `${name} must be an integer between ${minimum} and ${maximum}`,
      { details: { name, value: result, minimum, maximum }, exitCode: 2 },
    );
  }
  return result;
}

export function resolveDomCrawlOptions(options: DomCrawlOptions = {}): ResolvedDomCrawlOptions {
  if (options.scope !== undefined && options.scope !== 'interactive' && options.scope !== 'all') {
    throw new DomError('DOM_OPTIONS_INVALID', 'scope must be interactive or all', {
      details: { scope: options.scope },
      exitCode: 2,
    });
  }

  return {
    scope: options.scope ?? DEFAULT_DOM_CRAWL_OPTIONS.scope,
    includeHidden: options.includeHidden ?? DEFAULT_DOM_CRAWL_OPTIONS.includeHidden,
    maxElements: boundedInteger(
      options.maxElements,
      DEFAULT_DOM_CRAWL_OPTIONS.maxElements,
      1,
      100_000,
      'maxElements',
    ),
    maxFrameDepth: boundedInteger(
      options.maxFrameDepth,
      DEFAULT_DOM_CRAWL_OPTIONS.maxFrameDepth,
      0,
      32,
      'maxFrameDepth',
    ),
    textLimit: boundedInteger(
      options.textLimit,
      DEFAULT_DOM_CRAWL_OPTIONS.textLimit,
      0,
      10_000,
      'textLimit',
    ),
    redact: options.redact ?? DEFAULT_DOM_CRAWL_OPTIONS.redact,
  };
}
