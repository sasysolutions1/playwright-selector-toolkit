import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS,
  resolveDiagnosticEvidenceOptions,
} from '../src/core/diagnostics/options.js';
import { DiagnosticError } from '../src/errors/toolkit-error.js';

describe('diagnostic evidence options', () => {
  it('applies safe evidence defaults', () => {
    expect(resolveDiagnosticEvidenceOptions()).toEqual(DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS);
  });

  it('normalizes element screenshot requests and overrides', () => {
    const resolved = resolveDiagnosticEvidenceOptions({
      name: ' Login failure ',
      waitAfterMs: 250,
      includeTrace: false,
      elementScreenshots: [{ id: ' submit ', selector: ' button[type=submit] ', maxMatches: 2 }],
      maxEntries: 10,
      maxElementScreenshots: 4,
      reportFile: 'reports/custom.json',
      archiveFile: 'reports/custom.zip',
    });

    expect(resolved).toMatchObject({
      name: ' Login failure ',
      waitAfterMs: 250,
      includeTrace: false,
      maxEntries: 10,
      maxElementScreenshots: 4,
      reportFile: 'reports/custom.json',
      archiveFile: 'reports/custom.zip',
    });
    expect(resolved.elementScreenshots).toEqual([
      { id: 'submit', selector: 'button[type=submit]', maxMatches: 2 },
    ]);
  });

  it.each([
    [{ waitAfterMs: -1 }, 'waitAfterMs'],
    [{ maxEntries: 0 }, 'maxEntries'],
    [{ maxElementScreenshots: 0 }, 'maxElementScreenshots'],
    [{ reportFile: 'report.txt' }, 'reportFile'],
    [{ archiveFile: 'archive.tar' }, 'archiveFile'],
    [{ elementScreenshots: [{ selector: '  ' }] }, 'selector'],
  ])('rejects invalid options %#', (options, expected) => {
    expect(() => resolveDiagnosticEvidenceOptions(options)).toThrowError(DiagnosticError);
    try {
      resolveDiagnosticEvidenceOptions(options);
    } catch (error) {
      expect((error as Error).message).toContain(expected);
    }
  });
});
