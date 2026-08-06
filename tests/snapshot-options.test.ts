import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SANITIZED_HTML_OPTIONS,
  resolveSanitizedHtmlOptions,
} from '../src/core/snapshot/options.js';

describe('sanitized HTML options', () => {
  it('uses safe defaults', () => {
    expect(resolveSanitizedHtmlOptions()).toEqual(DEFAULT_SANITIZED_HTML_OPTIONS);
  });

  it('accepts explicit limits and style retention', () => {
    expect(
      resolveSanitizedHtmlOptions({
        redact: false,
        maxFrameDepth: 4,
        maxFrameCharacters: 50_000,
        includeStyles: true,
      }),
    ).toEqual({
      redact: false,
      maxFrameDepth: 4,
      maxFrameCharacters: 50_000,
      includeStyles: true,
    });
  });

  it('rejects unsafe limits', () => {
    try {
      resolveSanitizedHtmlOptions({ maxFrameCharacters: 10 });
      throw new Error('expected invalid options to throw');
    } catch (error) {
      expect(error).toMatchObject({ code: 'SNAPSHOT_OPTIONS_INVALID', exitCode: 2 });
    }
  });
});
