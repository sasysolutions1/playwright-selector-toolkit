import { extname } from 'node:path';
import { DiagnosticError } from '../../errors/toolkit-error.js';
import type {
  DiagnosticElementScreenshotRequest,
  DiagnosticEvidenceOptions,
  ResolvedDiagnosticEvidenceOptions,
} from '../../types/diagnostics.js';

export const DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS: ResolvedDiagnosticEvidenceOptions = {
  command: 'evidence',
  waitUntil: 'domcontentloaded',
  waitAfterMs: 0,
  includeTrace: true,
  includeConsole: true,
  includeNetwork: true,
  includeDomSnapshot: true,
  includeHtmlSnapshot: true,
  fullPageScreenshot: true,
  viewportScreenshot: true,
  elementScreenshots: [],
  maxEntries: 250,
  maxElementScreenshots: 20,
  redact: true,
  archive: true,
  reportFile: 'reports/diagnostic-evidence.json',
  archiveFile: 'reports/diagnostic-evidence.zip',
  failOnPageError: false,
  failOnRequestFailure: false,
  failOnHttpError: false,
};

function requireNonNegativeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DiagnosticError(
      'DIAGNOSTIC_OPTIONS_INVALID',
      `${field} must be a non-negative integer`,
      { details: { field, value }, exitCode: 2 },
    );
  }
  return value;
}

function requirePositiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DiagnosticError('DIAGNOSTIC_OPTIONS_INVALID', `${field} must be a positive integer`, {
      details: { field, value },
      exitCode: 2,
    });
  }
  return value;
}

function requireExtension(path: string, extension: string, field: string): string {
  if (extname(path).toLowerCase() !== extension) {
    throw new DiagnosticError('DIAGNOSTIC_OPTIONS_INVALID', `${field} must end in ${extension}`, {
      details: { field, path },
      exitCode: 2,
    });
  }
  return path;
}

function resolveElementRequests(
  requests: readonly DiagnosticElementScreenshotRequest[] | undefined,
): readonly DiagnosticElementScreenshotRequest[] {
  return (requests ?? []).map((request, index) => {
    const selector = request.selector.trim();
    if (selector === '') {
      throw new DiagnosticError(
        'DIAGNOSTIC_OPTIONS_INVALID',
        `elementScreenshots[${index}].selector must not be empty`,
        { exitCode: 2 },
      );
    }
    return {
      ...(request.id === undefined ? {} : { id: request.id.trim() }),
      selector,
      maxMatches: requirePositiveInteger(request.maxMatches ?? 1, 'maxMatches'),
    };
  });
}

export function resolveDiagnosticEvidenceOptions(
  options: DiagnosticEvidenceOptions = {},
): ResolvedDiagnosticEvidenceOptions {
  return {
    command: options.command ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.command,
    ...(options.name === undefined ? {} : { name: options.name }),
    waitUntil: options.waitUntil ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.waitUntil,
    waitAfterMs: requireNonNegativeInteger(
      options.waitAfterMs ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.waitAfterMs,
      'waitAfterMs',
    ),
    includeTrace: options.includeTrace ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.includeTrace,
    includeConsole: options.includeConsole ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.includeConsole,
    includeNetwork: options.includeNetwork ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.includeNetwork,
    includeDomSnapshot:
      options.includeDomSnapshot ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.includeDomSnapshot,
    includeHtmlSnapshot:
      options.includeHtmlSnapshot ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.includeHtmlSnapshot,
    fullPageScreenshot:
      options.fullPageScreenshot ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.fullPageScreenshot,
    viewportScreenshot:
      options.viewportScreenshot ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.viewportScreenshot,
    elementScreenshots: resolveElementRequests(options.elementScreenshots),
    maxEntries: requirePositiveInteger(
      options.maxEntries ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.maxEntries,
      'maxEntries',
    ),
    maxElementScreenshots: requirePositiveInteger(
      options.maxElementScreenshots ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.maxElementScreenshots,
      'maxElementScreenshots',
    ),
    redact: options.redact ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.redact,
    archive: options.archive ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.archive,
    reportFile: requireExtension(
      options.reportFile ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.reportFile,
      '.json',
      'reportFile',
    ),
    archiveFile: requireExtension(
      options.archiveFile ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.archiveFile,
      '.zip',
      'archiveFile',
    ),
    failOnPageError: options.failOnPageError ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.failOnPageError,
    failOnRequestFailure:
      options.failOnRequestFailure ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.failOnRequestFailure,
    failOnHttpError: options.failOnHttpError ?? DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS.failOnHttpError,
  };
}
