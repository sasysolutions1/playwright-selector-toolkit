import { describe, expect, it } from 'vitest';
import { createSelectorValidationReport } from '../src/core/validation/report.js';
import type { SelectorManifest, SelectorValidationResult } from '../src/types/validation.js';

const manifest: SelectorManifest = {
  schemaVersion: '1.0',
  name: 'Smoke',
  waitUntil: 'domcontentloaded',
  selectors: [
    {
      id: 'optional',
      name: 'Optional',
      required: false,
      framePath: 'main',
      locator: { type: 'css', selector: '#optional' },
      assertions: { count: 1 },
    },
  ],
};

const result: SelectorValidationResult = {
  id: 'optional',
  name: 'Optional',
  required: false,
  framePath: 'main',
  locator: { type: 'css', selector: '#optional' },
  playwright: 'page.locator("#optional")',
  status: 'fail',
  observed: { count: 0, visibleCount: 0, enabledCount: 0, editableCount: 0, durationMs: 1 },
  assertions: [
    { assertion: 'count', status: 'fail', expected: 'exactly 1', actual: 0, message: 'failed' },
  ],
  error: null,
};

describe('validation reports', () => {
  it('creates a versioned report and optional warning', () => {
    const report = createSelectorValidationReport({
      manifest,
      manifestPath: '/tmp/selectors.yaml',
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com/',
      title: 'Example',
      results: [result],
      toolkitVersion: '9.9.9',
      now: new Date('2026-07-18T00:00:00Z'),
    });
    expect(report).toMatchObject({
      schemaVersion: '1.0',
      toolkitVersion: '9.9.9',
      summary: { success: true, optionalFailures: 1 },
    });
    expect(report.warnings[0]).toContain('Optional selector optional');
  });
});
