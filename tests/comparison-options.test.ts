import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOM_COMPARISON_OPTIONS,
  resolveDomComparisonOptions,
} from '../src/core/comparison/options.js';

describe('comparison options', () => {
  it('resolves defaults and overrides', () => {
    expect(resolveDomComparisonOptions()).toEqual(DEFAULT_DOM_COMPARISON_OPTIONS);
    expect(
      resolveDomComparisonOptions({ similarityThreshold: 0.8, includeUnchanged: true }),
    ).toMatchObject({
      similarityThreshold: 0.8,
      includeUnchanged: true,
    });
  });

  it('rejects invalid thresholds and limits', () => {
    try {
      resolveDomComparisonOptions({ similarityThreshold: 2 });
      throw new Error('expected invalid similarity threshold to throw');
    } catch (error) {
      expect(error).toMatchObject({ code: 'COMPARISON_OPTIONS_INVALID' });
    }

    try {
      resolveDomComparisonOptions({ maxReplacementLocators: -1 });
      throw new Error('expected invalid replacement limit to throw');
    } catch (error) {
      expect(error).toMatchObject({ code: 'COMPARISON_OPTIONS_INVALID' });
    }
  });
});
