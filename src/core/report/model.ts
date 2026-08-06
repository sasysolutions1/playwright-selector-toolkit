import type { DiagnosticEvidenceManifest } from '../../types/diagnostics.js';
import type { DomComparisonReport } from '../../types/comparison.js';
import type { DomSnapshot } from '../../types/dom.js';
import type { HtmlReportSource, HtmlReportSourceSummary } from '../../types/html-report.js';
import type { LocatorReport } from '../../types/locator.js';
import type { SelectorValidationReport } from '../../types/validation.js';
import type { SelectorRepairReport } from '../../types/repair.js';
import type { MonitorHistoryReport } from '../../types/monitoring.js';

function generatedAt(source: HtmlReportSource): string | null {
  const value = source.data as unknown as Record<string, unknown>;
  const candidate = value.generatedAt ?? value.capturedAt ?? value.createdAt;
  return typeof candidate === 'string' ? candidate : null;
}

export function summarizeHtmlReportSource(source: HtmlReportSource): HtmlReportSourceSummary {
  if (source.kind === 'discovery') {
    const data = source.data as DomSnapshot;
    return {
      kind: source.kind,
      path: source.path,
      title: data.title || data.finalUrl,
      generatedAt: data.capturedAt,
      itemCount: data.summary.matchedElementCount,
    };
  }
  if (source.kind === 'locators') {
    const data = source.data as LocatorReport;
    return {
      kind: source.kind,
      path: source.path,
      title: data.title || data.finalUrl,
      generatedAt: data.generatedAt,
      itemCount: data.summary.candidateCount,
    };
  }
  if (source.kind === 'validation') {
    const data = source.data as SelectorValidationReport;
    return {
      kind: source.kind,
      path: source.path,
      title: data.manifestName,
      generatedAt: data.generatedAt,
      itemCount: data.summary.total,
    };
  }
  if (source.kind === 'repair') {
    const data = source.data as SelectorRepairReport;
    return {
      kind: source.kind,
      path: source.path,
      title: `${data.manifestName} repair`,
      generatedAt: data.generatedAt,
      itemCount: data.summary.failedSelectorCount,
    };
  }
  if (source.kind === 'comparison') {
    const data = source.data as DomComparisonReport;
    return {
      kind: source.kind,
      path: source.path,
      title: `${data.baseline.name} comparison`,
      generatedAt: data.generatedAt,
      itemCount: data.summary.driftElementCount,
    };
  }
  if (source.kind === 'monitoring-history') {
    const data = source.data as MonitorHistoryReport;
    return {
      kind: source.kind,
      path: source.path,
      title: `${data.monitorName} health trends`,
      generatedAt: data.generatedAt,
      itemCount: data.summary.checks,
    };
  }
  const data = source.data as DiagnosticEvidenceManifest;
  return {
    kind: source.kind,
    path: source.path,
    title: data.title ?? data.finalUrl ?? data.requestedUrl,
    generatedAt: generatedAt(source),
    itemCount:
      data.recorder.summary.consoleEntryCount +
      data.recorder.summary.pageErrorCount +
      data.recorder.summary.requestFailureCount +
      data.recorder.summary.httpErrorCount,
  };
}
