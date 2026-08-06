import { describe, expect, it } from 'vitest';
import { resolveSelectorRepairOptions } from '../src/core/repair/options.js';

describe('selector repair options', () => {
  it('uses deterministic safe defaults', () => {
    expect(resolveSelectorRepairOptions()).toEqual({
      provider: 'none',
      model: null,
      apiBaseUrl: 'https://api.openai.com/v1',
      aiTimeoutMs: 30_000,
      includeOptional: false,
      maxSuggestions: 3,
      minimumScore: 55,
    });
  });

  it('resolves OpenAI defaults and trims a trailing slash', () => {
    const result = resolveSelectorRepairOptions({
      provider: 'openai',
      apiBaseUrl: 'https://example.test/v1///',
    });
    expect(result.provider).toBe('openai');
    expect(result.model).toBeTruthy();
    expect(result.apiBaseUrl).toBe('https://example.test/v1');
  });

  it.each([
    [{ maxSuggestions: 0 }, 'maxSuggestions'],
    [{ aiTimeoutMs: 0 }, 'aiTimeoutMs'],
    [{ minimumScore: 101 }, 'minimumScore'],
  ])('rejects invalid option %s', (input, message) => {
    expect(() => resolveSelectorRepairOptions(input)).toThrow(String(message));
  });
});
