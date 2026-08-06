import { describe, expect, it } from 'vitest';
import { DEFAULT_DOM_CRAWL_OPTIONS, resolveDomCrawlOptions } from '../src/core/dom/options.js';

describe('DOM crawl options', () => {
  it('uses safe defaults', () => {
    expect(resolveDomCrawlOptions()).toEqual(DEFAULT_DOM_CRAWL_OPTIONS);
    expect(DEFAULT_DOM_CRAWL_OPTIONS).toMatchObject({
      scope: 'interactive',
      includeHidden: false,
      redact: true,
    });
  });

  it('accepts explicit limits and all-element mode', () => {
    expect(
      resolveDomCrawlOptions({
        scope: 'all',
        includeHidden: true,
        maxElements: 250,
        maxFrameDepth: 3,
        textLimit: 0,
        redact: false,
      }),
    ).toMatchObject({
      scope: 'all',
      includeHidden: true,
      maxElements: 250,
      maxFrameDepth: 3,
      textLimit: 0,
      redact: false,
    });
  });

  it('rejects unsafe or invalid limits with a stable code', () => {
    try {
      resolveDomCrawlOptions({ maxElements: 0 });
      throw new Error('Expected maxElements validation to fail');
    } catch (error) {
      expect(error).toMatchObject({ code: 'DOM_OPTIONS_INVALID', exitCode: 2 });
    }

    try {
      resolveDomCrawlOptions({ maxFrameDepth: 33 });
      throw new Error('Expected maxFrameDepth validation to fail');
    } catch (error) {
      expect(error).toMatchObject({ code: 'DOM_OPTIONS_INVALID' });
    }
  });
});
