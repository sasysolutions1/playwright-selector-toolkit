import { describe, expect, it } from 'vitest';
import { resolveHtmlReportOptions } from '../src/core/report/options.js';

describe('resolveHtmlReportOptions', () => {
  it('applies portable-report defaults', () => {
    expect(resolveHtmlReportOptions()).toMatchObject({
      embedImages: true,
      maxImageBytes: 5_000_000,
      maxItemsPerSection: 100,
      interactive: true,
    });
  });
  it('rejects invalid bounds', () => {
    expect(() => resolveHtmlReportOptions({ maxImageBytes: 0 })).toThrow(/positive integer/u);
    expect(() => resolveHtmlReportOptions({ title: '  ' })).toThrow(/cannot be empty/u);
    expect(resolveHtmlReportOptions({ interactive: false }).interactive).toBe(false);
  });
});
