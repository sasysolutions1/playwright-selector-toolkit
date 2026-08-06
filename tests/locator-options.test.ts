import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCATOR_GENERATION_OPTIONS,
  resolveLocatorGenerationOptions,
} from '../src/core/locator/options.js';

describe('locator generation options', () => {
  it('uses conservative defaults', () => {
    expect(resolveLocatorGenerationOptions()).toEqual(DEFAULT_LOCATOR_GENERATION_OPTIONS);
  });

  it('deduplicates and normalizes test-id attributes', () => {
    expect(
      resolveLocatorGenerationOptions({ testIdAttributes: ['data-QA', 'data-qa'] })
        .testIdAttributes,
    ).toEqual(['data-qa']);
  });

  it('rejects invalid limits and attributes', () => {
    for (const options of [
      { maxCandidatesPerElement: 0 },
      { testIdAttributes: ['id'] },
      { minimumRecommendedScore: 101 },
    ] as const) {
      try {
        resolveLocatorGenerationOptions(options);
        throw new Error('Expected locator option validation to fail');
      } catch (error) {
        expect(error).toMatchObject({ code: 'LOCATOR_OPTIONS_INVALID' });
      }
    }
  });
});
