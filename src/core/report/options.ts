import { ReportError } from '../../errors/toolkit-error.js';
import type { HtmlReportOptions, ResolvedHtmlReportOptions } from '../../types/html-report.js';

export const DEFAULT_HTML_REPORT_OPTIONS: Omit<ResolvedHtmlReportOptions, 'name'> = {
  command: 'report',
  title: 'Playwright Selector Toolkit Report',
  outputFile: 'reports/selector-report.html',
  manifestFile: 'reports/selector-report.json',
  embedImages: true,
  maxImageBytes: 5_000_000,
  maxItemsPerSection: 100,
  maxDirectoryDepth: 6,
  interactive: true,
};

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ReportError('REPORT_OPTIONS_INVALID', `${field} must be a positive integer`, {
      details: { field, value },
      exitCode: 2,
    });
  }
  return value;
}

export function resolveHtmlReportOptions(
  options: HtmlReportOptions = {},
): ResolvedHtmlReportOptions {
  const title = (options.title ?? DEFAULT_HTML_REPORT_OPTIONS.title).trim();
  if (title === '') {
    throw new ReportError('REPORT_OPTIONS_INVALID', 'title cannot be empty', { exitCode: 2 });
  }
  return {
    command: options.command ?? DEFAULT_HTML_REPORT_OPTIONS.command,
    ...(options.name === undefined ? {} : { name: options.name }),
    title,
    outputFile: options.outputFile ?? DEFAULT_HTML_REPORT_OPTIONS.outputFile,
    manifestFile: options.manifestFile ?? DEFAULT_HTML_REPORT_OPTIONS.manifestFile,
    embedImages: options.embedImages ?? DEFAULT_HTML_REPORT_OPTIONS.embedImages,
    maxImageBytes: positiveInteger(
      options.maxImageBytes ?? DEFAULT_HTML_REPORT_OPTIONS.maxImageBytes,
      'maxImageBytes',
    ),
    maxItemsPerSection: positiveInteger(
      options.maxItemsPerSection ?? DEFAULT_HTML_REPORT_OPTIONS.maxItemsPerSection,
      'maxItemsPerSection',
    ),
    maxDirectoryDepth: positiveInteger(
      options.maxDirectoryDepth ?? DEFAULT_HTML_REPORT_OPTIONS.maxDirectoryDepth,
      'maxDirectoryDepth',
    ),
    interactive: options.interactive ?? DEFAULT_HTML_REPORT_OPTIONS.interactive,
  };
}
