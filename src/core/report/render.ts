import type { DiagnosticEvidenceManifest } from '../../types/diagnostics.js';
import type { DomComparisonReport, ElementDifference } from '../../types/comparison.js';
import type { DomSnapshot } from '../../types/dom.js';
import type { HtmlReportImage, HtmlReportSource } from '../../types/html-report.js';
import type { LocatorReport } from '../../types/locator.js';
import type { SelectorValidationReport } from '../../types/validation.js';
import type { SelectorRepairReport } from '../../types/repair.js';
import type { MonitorHistoryReport } from '../../types/monitoring.js';

export interface RenderHtmlReportOptions {
  readonly title: string;
  readonly maxItemsPerSection: number;
  readonly interactive?: boolean;
}

interface DashboardRow {
  readonly cells: readonly string[];
  readonly searchText: string;
  readonly facets: readonly string[];
  readonly issue: boolean;
}

interface DashboardSectionOptions {
  readonly sourceKind: HtmlReportSource['kind'];
  readonly issue: boolean;
  readonly interactive: boolean;
}

interface MetricFilter {
  readonly group: string;
  readonly value: string;
}

function printable(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return `${value}`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unprintable]';
  }
}

function escapeHtml(value: unknown): string {
  return printable(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function compact(value: string | null | undefined, fallback = '—'): string {
  return value === null || value === undefined || value === '' ? fallback : value;
}

function metric(
  label: string,
  value: unknown,
  tone = '',
  filter: MetricFilter | null = null,
  interactive = false,
): string {
  const content = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
  if (!interactive || filter === null) return `<div class="metric ${tone}">${content}</div>`;
  return `<button type="button" class="metric ${tone}" data-metric-filter data-filter-group="${escapeHtml(filter.group)}" data-filter-value="${escapeHtml(filter.value)}" title="Filter to ${escapeHtml(label)}">${content}</button>`;
}

function badge(text: string, tone = ''): string {
  return `<span class="badge ${tone}">${escapeHtml(text)}</span>`;
}

function code(value: string): string {
  return `<code>${escapeHtml(value)}</code>`;
}

function section(
  id: string,
  title: string,
  body: string,
  subtitle: string,
  options: DashboardSectionOptions,
): string {
  const collapse = options.interactive
    ? `<button type="button" class="section-toggle" data-section-toggle aria-expanded="true" aria-controls="${escapeHtml(id)}-body"><span aria-hidden="true">▾</span><span class="sr-only">Toggle ${escapeHtml(title)}</span></button>`
    : '';
  return `<section id="${escapeHtml(id)}" data-dashboard-section data-source-kind="${escapeHtml(options.sourceKind)}" data-section-issue="${options.issue ? 'true' : 'false'}"><header><div><h2>${escapeHtml(title)}</h2>${subtitle === '' ? '' : `<p>${escapeHtml(subtitle)}</p>`}</div>${collapse}</header><div id="${escapeHtml(id)}-body" data-section-body>${body}<p class="filter-empty" hidden>No rows match the current filters.</p></div></section>`;
}

function sourcePath(source: HtmlReportSource): string {
  return `<div class="source-path">Source: ${code(source.path)}</div>`;
}

function normalizeSearchText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().toLowerCase();
}

function table(
  headers: readonly string[],
  rows: readonly DashboardRow[],
  interactive: boolean,
): string {
  const headerCells = headers
    .map((item, index) =>
      interactive
        ? `<th><button type="button" class="sort-button" data-sort-index="${index}" aria-label="Sort by ${escapeHtml(item)}">${escapeHtml(item)} <span aria-hidden="true">↕</span></button></th>`
        : `<th>${escapeHtml(item)}</th>`,
    )
    .join('');
  const bodyRows = rows
    .map((row) => {
      const search = normalizeSearchText(`${row.searchText} ${row.cells.join(' ')}`);
      return `<tr data-dashboard-row data-search="${escapeHtml(search)}" data-facets="${escapeHtml(row.facets.join(' '))}" data-issue="${row.issue ? 'true' : 'false'}">${row.cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
    })
    .join('');
  return `<div class="table-wrap"><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
}

function empty(message: string): string {
  return `<p class="empty">${escapeHtml(message)}</p>`;
}

function truncate<T>(items: readonly T[], max: number): { shown: readonly T[]; omitted: number } {
  return { shown: items.slice(0, max), omitted: Math.max(0, items.length - max) };
}

function omitted(count: number): string {
  return count === 0
    ? ''
    : `<p class="omitted">${count} additional item(s) omitted from this portable report.</p>`;
}

function renderDiscovery(source: HtmlReportSource, max: number, interactive: boolean): string {
  const data = source.data as DomSnapshot;
  const all = data.frames.flatMap((frame) => frame.elements);
  const limited = truncate(all, max);
  const issueCount = all.filter((item) => !item.visibility.visible || item.sensitive).length;
  const metrics = `<div class="metrics">${metric('Frames', data.summary.frameCount)}${metric('Elements', data.summary.matchedElementCount)}${metric('Interactive', data.summary.interactiveElementCount)}${metric('Visible', data.summary.visibleElementCount, 'good', { group: 'visibility', value: 'visible' }, interactive)}${metric('Hidden', data.summary.hiddenElementCount, data.summary.hiddenElementCount > 0 ? 'warn' : '', { group: 'visibility', value: 'hidden' }, interactive)}${metric('Redactions', data.summary.redactionCount)}</div>`;
  const rows: DashboardRow[] = limited.shown.map((item) => ({
    cells: [
      code(item.kind),
      escapeHtml(compact(item.accessibleName ?? item.label ?? item.text)),
      code(item.framePath),
      escapeHtml(item.visibility.visible ? 'Visible' : item.visibility.reason),
      code(item.domPath),
    ],
    searchText: `${item.kind} ${item.accessibleName ?? ''} ${item.label ?? ''} ${item.text ?? ''} ${item.framePath} ${item.domPath}`,
    facets: [
      `visibility:${item.visibility.visible ? 'visible' : 'hidden'}`,
      `kind:${item.kind}`,
      ...(item.sensitive ? ['sensitivity:sensitive'] : []),
    ],
    issue: !item.visibility.visible || item.sensitive,
  }));
  return section(
    `discovery-${Math.abs(hash(source.path))}`,
    'DOM discovery',
    `${sourcePath(source)}${metrics}${rows.length === 0 ? empty('No elements recorded.') : table(['Kind', 'Name or text', 'Frame', 'Visibility', 'DOM path'], rows, interactive)}${omitted(limited.omitted)}`,
    data.title || data.finalUrl,
    { sourceKind: source.kind, issue: issueCount > 0 || data.failures.length > 0, interactive },
  );
}

function renderLocators(source: HtmlReportSource, max: number, interactive: boolean): string {
  const data = source.data as LocatorReport;
  const limited = truncate(data.recommendations, max);
  const metrics = `<div class="metrics">${metric('Candidates', data.summary.candidateCount)}${metric('Unique', data.summary.uniqueCandidateCount, 'good')}${metric('Ambiguous', data.summary.multipleCandidateCount, data.summary.multipleCandidateCount > 0 ? 'warn' : '')}${metric('Recommended', data.summary.recommendedLocatorCount)}${metric('High', data.summary.highConfidenceCandidateCount, 'good', { group: 'confidence', value: 'high' }, interactive)}${metric('Medium', data.summary.mediumConfidenceCandidateCount, 'warn', { group: 'confidence', value: 'medium' }, interactive)}${metric('Low', data.summary.lowConfidenceCandidateCount, data.summary.lowConfidenceCandidateCount > 0 ? 'bad' : '', { group: 'confidence', value: 'low' }, interactive)}</div>`;
  const rows: DashboardRow[] = limited.shown.map((item) => ({
    cells: [
      badge(item.confidence, item.confidence),
      escapeHtml(String(item.score)),
      code(item.strategy),
      code(item.playwright),
      code(item.framePath),
    ],
    searchText: `${item.confidence} ${item.score} ${item.strategy} ${item.playwright} ${item.framePath}`,
    facets: [`confidence:${item.confidence}`, `strategy:${item.strategy}`],
    issue: item.confidence !== 'high',
  }));
  return section(
    `locators-${Math.abs(hash(source.path))}`,
    'Locator recommendations',
    `${sourcePath(source)}${metrics}${rows.length === 0 ? empty('No recommended locators.') : table(['Confidence', 'Score', 'Strategy', 'Playwright locator', 'Frame'], rows, interactive)}${omitted(limited.omitted)}`,
    data.title || data.finalUrl,
    {
      sourceKind: source.kind,
      issue:
        data.summary.lowConfidenceCandidateCount > 0 || data.summary.multipleCandidateCount > 0,
      interactive,
    },
  );
}

function renderValidation(source: HtmlReportSource, max: number, interactive: boolean): string {
  const data = source.data as SelectorValidationReport;
  const ordered = [...data.results].sort(
    (left, right) => (left.status === 'pass' ? 1 : 0) - (right.status === 'pass' ? 1 : 0),
  );
  const limited = truncate(ordered, max);
  const tone = data.summary.success ? 'good' : 'bad';
  const metrics = `<div class="metrics">${metric('Status', data.summary.success ? 'Passed' : 'Failed', tone)}${metric('Total', data.summary.total)}${metric('Passed', data.summary.passed, 'good', { group: 'status', value: 'pass' }, interactive)}${metric('Failed', data.summary.failed, data.summary.failed > 0 ? 'bad' : '', { group: 'status', value: 'fail' }, interactive)}${metric('Errors', data.summary.errors, data.summary.errors > 0 ? 'bad' : '', { group: 'status', value: 'error' }, interactive)}</div>`;
  const rows: DashboardRow[] = limited.shown.map((item) => ({
    cells: [
      badge(item.status, item.status === 'pass' ? 'high' : 'low'),
      escapeHtml(item.required ? 'Required' : 'Optional'),
      escapeHtml(item.name),
      code(item.playwright),
      escapeHtml(
        item.error ??
          (item.assertions
            .filter((entry) => entry.status === 'fail')
            .map((entry) => entry.message)
            .join('; ') ||
            'Passed'),
      ),
    ],
    searchText: `${item.status} ${item.required ? 'required' : 'optional'} ${item.name} ${item.playwright} ${item.error ?? ''}`,
    facets: [`status:${item.status}`, `requirement:${item.required ? 'required' : 'optional'}`],
    issue: item.status !== 'pass',
  }));
  return section(
    `validation-${Math.abs(hash(source.path))}`,
    'Selector validation',
    `${sourcePath(source)}${metrics}${table(['Status', 'Requirement', 'Selector', 'Locator', 'Result'], rows, interactive)}${omitted(limited.omitted)}`,
    data.manifestName,
    {
      sourceKind: source.kind,
      issue: !data.summary.success || data.summary.failed > 0,
      interactive,
    },
  );
}

function differenceName(item: ElementDifference): string {
  if (item.kind === 'added') return item.current.accessibleName ?? item.current.domPath;
  if (item.kind === 'removed') return item.baseline.accessibleName ?? item.baseline.domPath;
  return item.current.accessibleName ?? item.baseline.accessibleName ?? item.current.domPath;
}

function renderRepair(source: HtmlReportSource, max: number, interactive: boolean): string {
  const data = source.data as SelectorRepairReport;
  const limited = truncate(data.repairs, max);
  const metrics = `<div class="metrics">${metric('Failed selectors', data.summary.failedSelectorCount, data.summary.failedSelectorCount > 0 ? 'warn' : '')}${metric('Recommendations', data.summary.selectorsWithRecommendation, 'good', { group: 'repair', value: 'recommended' }, interactive)}${metric('Unresolved required', data.summary.unresolvedRequiredCount, data.summary.unresolvedRequiredCount > 0 ? 'bad' : '', { group: 'repair', value: 'unresolved' }, interactive)}${metric('AI assisted', data.summary.aiAssistedCount)}${metric('Approval', 'Required', 'warn')}</div>`;
  const rows: DashboardRow[] = limited.shown.map((item) => {
    const recommended = item.suggestions.find(
      (suggestion) => suggestion.id === item.recommendedSuggestionId,
    );
    const status = recommended === undefined ? 'unresolved' : 'recommended';
    return {
      cells: [
        badge(status, recommended === undefined ? 'low' : 'high'),
        escapeHtml(item.selector.id),
        code(item.validation.playwright),
        recommended === undefined
          ? escapeHtml(item.unresolvedReason ?? 'No recommendation')
          : code(recommended.playwright),
        recommended === undefined
          ? '—'
          : `${badge(recommended.confidence, recommended.confidence)} ${escapeHtml(recommended.score)}`,
        recommended === undefined ? '—' : escapeHtml(recommended.source),
      ],
      searchText: `${status} ${item.selector.id} ${item.selector.name} ${item.validation.playwright} ${recommended?.playwright ?? ''} ${recommended?.source ?? ''}`,
      facets: [
        `repair:${status}`,
        ...(recommended === undefined ? [] : [`confidence:${recommended.confidence}`]),
      ],
      issue: recommended === undefined,
    };
  });
  return section(
    `repair-${Math.abs(hash(source.path))}`,
    'Selector repair proposal',
    `${sourcePath(source)}${metrics}<div class="callout">The original selector manifest was not changed. Human review and validation are required before applying this proposal.</div>${rows.length === 0 ? empty('No failed selectors were included.') : table(['Status', 'Selector', 'Broken locator', 'Suggested locator', 'Confidence', 'Source'], rows, interactive)}${omitted(limited.omitted)}`,
    data.manifestName,
    { sourceKind: source.kind, issue: data.summary.unresolvedRequiredCount > 0, interactive },
  );
}

function renderComparison(source: HtmlReportSource, max: number, interactive: boolean): string {
  const data = source.data as DomComparisonReport;
  const drift = data.differences.filter((item) => item.kind !== 'unchanged');
  const limited = truncate(drift, max);
  const metrics = `<div class="metrics">${metric('Drift', data.summary.driftDetected ? 'Detected' : 'None', data.summary.driftDetected ? 'warn' : 'good')}${metric('Added', data.summary.addedElementCount, '', { group: 'change', value: 'added' }, interactive)}${metric('Removed', data.summary.removedElementCount, '', { group: 'change', value: 'removed' }, interactive)}${metric('Moved', data.summary.movedElementCount, '', { group: 'change', value: 'moved' }, interactive)}${metric('Changed', data.summary.changedElementCount + data.summary.movedAndChangedElementCount, '', { group: 'change', value: 'changed' }, interactive)}</div>`;
  const rows: DashboardRow[] = limited.shown.map((item) => {
    const details =
      item.kind === 'added'
        ? 'New element'
        : item.kind === 'removed'
          ? 'Element no longer present'
          : item.changedFields.join(', ') || 'Location changed';
    const suggestion =
      item.kind === 'removed' ? '—' : (item.replacementLocators[0]?.playwright ?? '—');
    const normalizedChange = item.kind === 'moved-and-changed' ? 'changed' : item.kind;
    return {
      cells: [
        badge(item.kind, item.kind === 'removed' ? 'low' : 'medium'),
        escapeHtml(differenceName(item)),
        escapeHtml(details),
        suggestion === '—' ? '—' : code(suggestion),
      ],
      searchText: `${item.kind} ${differenceName(item)} ${details} ${suggestion}`,
      facets: [`change:${normalizedChange}`],
      issue: true,
    };
  });
  return section(
    `comparison-${Math.abs(hash(source.path))}`,
    'DOM comparison',
    `${sourcePath(source)}${metrics}${rows.length === 0 ? empty('No DOM drift detected.') : table(['Change', 'Element', 'Details', 'Replacement locator'], rows, interactive)}${omitted(limited.omitted)}`,
    `${data.baseline.name}@${data.baseline.version}`,
    { sourceKind: source.kind, issue: data.summary.driftDetected, interactive },
  );
}

function displayPercent(value: number | null): string {
  return value === null ? 'n/a' : `${value.toFixed(3).replace(/\.000$/u, '')}%`;
}

function displayDuration(value: number | null): string {
  if (value === null) return 'n/a';
  if (value < 1000) return `${value} ms`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} hr` : `${Math.round(hours / 24)} days`;
}

function renderMonitoringHistory(
  source: HtmlReportSource,
  max: number,
  interactive: boolean,
): string {
  const data = source.data as MonitorHistoryReport;
  const targetLimit = truncate(data.targets, max);
  const dailyLimit = truncate(data.daily, max);
  const incidentLimit = truncate(data.incidents, max);
  const metrics = `<div class="metrics">${metric('Checks', data.summary.checks)}${metric('Pass rate', displayPercent(data.summary.passRatePercent), data.summary.passRatePercent === 100 ? 'good' : data.summary.passRatePercent === null ? '' : 'warn')}${metric('Estimated availability', displayPercent(data.summary.estimatedAvailabilityPercent), data.summary.estimatedAvailabilityPercent === 100 ? 'good' : data.summary.estimatedAvailabilityPercent === null ? '' : 'warn')}${metric('Incidents', data.summary.incidentCount, data.summary.incidentCount > 0 ? 'warn' : 'good')}${metric('Open incidents', data.summary.openIncidentCount, data.summary.openIncidentCount > 0 ? 'bad' : 'good', { group: 'incident', value: 'open' }, interactive)}${metric('MTTR', displayDuration(data.summary.meanTimeToRecoveryMs))}${metric('Longest outage', displayDuration(data.summary.longestOutageMs))}${metric('Avg check', displayDuration(data.summary.averageCheckDurationMs))}</div>`;
  const targetRows: DashboardRow[] = targetLimit.shown.map((target) => ({
    cells: [
      escapeHtml(target.targetName),
      code(target.targetId),
      escapeHtml(target.checks),
      escapeHtml(displayPercent(target.passRatePercent)),
      escapeHtml(displayPercent(target.estimatedAvailabilityPercent)),
      escapeHtml(`${target.incidentCount} (${target.openIncidentCount} open)`),
      escapeHtml(displayDuration(target.meanTimeToRecoveryMs)),
      escapeHtml(displayDuration(target.p95CheckDurationMs)),
    ],
    searchText: `${target.targetName} ${target.targetId} ${target.passRatePercent ?? ''} ${target.incidentCount}`,
    facets: [
      `health:${target.unhealthyChecks > 0 ? 'unhealthy' : 'healthy'}`,
      ...(target.openIncidentCount > 0 ? ['incident:open'] : []),
    ],
    issue: target.unhealthyChecks > 0 || target.openIncidentCount > 0,
  }));
  const dailyRows: DashboardRow[] = dailyLimit.shown.map((day) => ({
    cells: [
      escapeHtml(day.date),
      escapeHtml(day.checks),
      escapeHtml(day.healthyChecks),
      escapeHtml(day.unhealthyChecks),
      escapeHtml(displayPercent(day.passRatePercent)),
      escapeHtml(displayDuration(day.averageDurationMs)),
      escapeHtml(day.incidentEvents),
    ],
    searchText: `${day.date} ${day.checks} ${day.healthyChecks} ${day.unhealthyChecks}`,
    facets: [`health:${day.unhealthyChecks > 0 ? 'unhealthy' : 'healthy'}`],
    issue: day.unhealthyChecks > 0 || day.incidentEvents > 0,
  }));
  const incidentRows: DashboardRow[] = incidentLimit.shown.map((incident) => ({
    cells: [
      badge(incident.open ? 'open' : 'resolved', incident.open ? 'low' : 'high'),
      code(incident.targetId),
      code(incident.incidentId),
      escapeHtml(incident.openedAt),
      escapeHtml(incident.resolvedAt ?? 'Still open'),
      badge(
        incident.peakSeverity,
        incident.peakSeverity === 'critical'
          ? 'low'
          : incident.peakSeverity === 'high'
            ? 'medium'
            : '',
      ),
      escapeHtml(displayDuration(incident.durationMs)),
    ],
    searchText: `${incident.targetId} ${incident.incidentId} ${incident.peakSeverity} ${incident.open ? 'open' : 'resolved'}`,
    facets: [
      `incident:${incident.open ? 'open' : 'resolved'}`,
      `severity:${incident.peakSeverity}`,
    ],
    issue: incident.open,
  }));
  return section(
    `monitoring-history-${Math.abs(hash(source.path))}`,
    'Selector health trends',
    `${sourcePath(source)}${metrics}<h3>Targets</h3>${targetRows.length === 0 ? empty('No target history in this window.') : table(['Target', 'ID', 'Checks', 'Pass rate', 'Availability', 'Incidents', 'MTTR', 'P95 duration'], targetRows, interactive)}${omitted(targetLimit.omitted)}<h3>Daily trend</h3>${dailyRows.length === 0 ? empty('No daily history in this window.') : table(['Date', 'Checks', 'Healthy', 'Unhealthy', 'Pass rate', 'Avg duration', 'Incident events'], dailyRows, interactive)}${omitted(dailyLimit.omitted)}<h3>Incidents</h3>${incidentRows.length === 0 ? empty('No incidents in this window.') : table(['Status', 'Target', 'Incident', 'Opened', 'Resolved', 'Peak severity', 'Duration'], incidentRows, interactive)}${omitted(incidentLimit.omitted)}`,
    `${data.monitorName} · ${data.window.since} to ${data.window.until}`,
    {
      sourceKind: source.kind,
      issue: data.summary.openIncidentCount > 0 || data.summary.unhealthyChecks > 0,
      interactive,
    },
  );
}

function renderImages(images: readonly HtmlReportImage[]): string {
  if (images.length === 0) return empty('No screenshots were available.');
  return `<div class="gallery">${images
    .map((image) =>
      image.dataUri === null
        ? `<div class="image-card unavailable" data-search="${escapeHtml(normalizeSearchText(image.label))}"><strong>${escapeHtml(image.label)}</strong><p>${escapeHtml(image.reasonNotEmbedded ?? 'Not embedded')}</p></div>`
        : `<figure class="image-card" data-search="${escapeHtml(normalizeSearchText(image.label))}"><button type="button" class="image-open" data-image-open aria-label="Open ${escapeHtml(image.label)}"><img loading="lazy" src="${image.dataUri}" alt="${escapeHtml(image.label)}"></button><figcaption>${escapeHtml(image.label)} · ${escapeHtml(image.byteLength)} bytes</figcaption></figure>`,
    )
    .join('')}</div>`;
}

function eventFacet(type: string): string {
  return type
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function renderDiagnostics(
  source: HtmlReportSource,
  images: readonly HtmlReportImage[],
  max: number,
  interactive: boolean,
): string {
  const data = source.data as DiagnosticEvidenceManifest;
  const summary = data.recorder.summary;
  const metrics = `<div class="metrics">${metric('Capture', data.success ? 'Succeeded' : 'Failed', data.success ? 'good' : 'bad')}${metric('Console', summary.consoleEntryCount)}${metric('Page errors', summary.pageErrorCount, summary.pageErrorCount > 0 ? 'bad' : '', { group: 'event', value: 'page-error' }, interactive)}${metric('Request failures', summary.requestFailureCount, summary.requestFailureCount > 0 ? 'warn' : '', { group: 'event', value: 'request-failure' }, interactive)}${metric('HTTP errors', summary.httpErrorCount, summary.httpErrorCount > 0 ? 'warn' : '', { group: 'event', value: 'http-error' }, interactive)}</div>`;
  const events = [
    ...data.recorder.pageErrors.map((item) => [
      'Page error',
      item.timestamp,
      `${item.name}: ${item.message}`,
    ]),
    ...data.recorder.requestFailures.map((item) => [
      'Request failure',
      item.timestamp,
      `${item.method} ${item.url} — ${item.failureText ?? 'failed'}`,
    ]),
    ...data.recorder.httpErrors.map((item) => [
      'HTTP error',
      item.timestamp,
      `${item.status} ${item.method} ${item.url}`,
    ]),
    ...data.recorder.console
      .filter((item) => item.type === 'error' || item.type === 'warning')
      .map((item) => [`Console ${item.type}`, item.timestamp, item.text]),
  ];
  const limited = truncate(events, max);
  const rows: DashboardRow[] = limited.shown.map((item) => ({
    cells: [badge(item[0] ?? 'Event', 'low'), escapeHtml(item[1] ?? ''), escapeHtml(item[2] ?? '')],
    searchText: item.join(' '),
    facets: [`event:${eventFacet(item[0] ?? 'event')}`],
    issue: true,
  }));
  const failure =
    data.failure === null
      ? ''
      : `<div class="callout bad"><strong>${escapeHtml(data.failure.name)}</strong><p>${escapeHtml(data.failure.message)}</p></div>`;
  const hasIssue =
    !data.success ||
    summary.pageErrorCount > 0 ||
    summary.requestFailureCount > 0 ||
    summary.httpErrorCount > 0 ||
    rows.length > 0;
  return section(
    `diagnostics-${Math.abs(hash(source.path))}`,
    'Diagnostic evidence',
    `${sourcePath(source)}${metrics}${failure}${rows.length === 0 ? empty('No error or warning events recorded.') : table(['Type', 'Time', 'Details'], rows, interactive)}${omitted(limited.omitted)}<h3>Screenshots</h3>${renderImages(images)}`,
    data.title ?? data.finalUrl ?? data.requestedUrl,
    { sourceKind: source.kind, issue: hasIssue, interactive },
  );
}

function hash(value: string): number {
  let result = 0;
  for (const character of value) result = ((result << 5) - result + character.charCodeAt(0)) | 0;
  return result;
}

function dashboardControls(kinds: readonly HtmlReportSource['kind'][]): string {
  const uniqueKinds = [...new Set(kinds)];
  return `<aside class="dashboard-controls" data-dashboard-controls aria-label="Report dashboard controls">
  <div class="control-row primary-controls">
    <label class="search-control"><span>Search report</span><input type="search" data-report-search placeholder="Search visible rows" autocomplete="off"></label>
    <label class="toggle-control"><input type="checkbox" data-issues-only> Issues only</label>
    <button type="button" data-reset-filters>Reset filters</button>
    <span class="filter-summary" data-filter-summary aria-live="polite"></span>
  </div>
  <div class="control-row source-controls"><span class="control-label">Sources</span>${uniqueKinds.map((kind) => `<label class="source-chip"><input type="checkbox" data-source-filter value="${escapeHtml(kind)}" checked> ${escapeHtml(kind)}</label>`).join('')}</div>
  <div class="facet-controls" data-facet-controls></div>
  <div class="control-row action-controls">
    <button type="button" data-expand-all>Expand all</button>
    <button type="button" data-collapse-all>Collapse all</button>
    <button type="button" data-export-visible>Export visible CSV</button>
    <button type="button" data-print-report>Print</button>
    <button type="button" data-theme-toggle aria-label="Change color theme">Theme: Auto</button>
  </div>
</aside>`;
}

function dashboardScript(): string {
  return `<script>
(() => {
  'use strict';
  const controls = document.querySelector('[data-dashboard-controls]');
  if (!controls) return;
  const search = controls.querySelector('[data-report-search]');
  const issuesOnly = controls.querySelector('[data-issues-only]');
  const summary = controls.querySelector('[data-filter-summary]');
  const facetRoot = controls.querySelector('[data-facet-controls]');
  const sections = [...document.querySelectorAll('.source-section')];
  const rows = [...document.querySelectorAll('tr[data-dashboard-row]')];
  const activeFacets = new Map();
  const facetValues = new Map();
  const sourceInputs = [...controls.querySelectorAll('[data-source-filter]')];

  for (const row of rows) {
    for (const token of (row.dataset.facets || '').split(/\\s+/).filter(Boolean)) {
      const split = token.indexOf(':');
      if (split < 1) continue;
      const group = token.slice(0, split);
      const value = token.slice(split + 1);
      if (!facetValues.has(group)) facetValues.set(group, new Set());
      facetValues.get(group).add(value);
    }
  }

  const titleCase = (value) => value.replaceAll('-', ' ').replace(/\\b\\w/g, (letter) => letter.toUpperCase());
  for (const [group, values] of [...facetValues.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'facet-group';
    const legend = document.createElement('legend');
    legend.textContent = titleCase(group);
    fieldset.append(legend);
    for (const value of [...values].sort()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'facet-chip';
      button.dataset.facetGroup = group;
      button.dataset.facetValue = value;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = titleCase(value);
      fieldset.append(button);
    }
    facetRoot.append(fieldset);
  }

  const selectedSources = () => new Set(sourceInputs.filter((input) => input.checked).map((input) => input.value));
  const rowMatchesFacets = (row) => {
    const rowFacets = new Set((row.dataset.facets || '').split(/\\s+/).filter(Boolean));
    for (const [group, values] of activeFacets.entries()) {
      if (values.size === 0) continue;
      if (![...values].some((value) => rowFacets.has(group + ':' + value))) return false;
    }
    return true;
  };

  const applyFilters = () => {
    const query = (search.value || '').trim().toLowerCase();
    const sourceSet = selectedSources();
    let visibleRows = 0;
    let visibleSections = 0;
    for (const wrapper of sections) {
      const section = wrapper.querySelector('[data-dashboard-section]');
      const sourceAllowed = sourceSet.has(section.dataset.sourceKind || '');
      const sectionRows = [...wrapper.querySelectorAll('tr[data-dashboard-row]')];
      let sectionVisibleRows = 0;
      for (const row of sectionRows) {
        const matches =
          sourceAllowed &&
          (!query || (row.dataset.search || '').includes(query)) &&
          (!issuesOnly.checked || row.dataset.issue === 'true') &&
          rowMatchesFacets(row);
        row.hidden = !matches;
        row.classList.toggle('filtered-out', !matches);
        if (matches) {
          sectionVisibleRows += 1;
          visibleRows += 1;
        }
      }
      const cards = [...wrapper.querySelectorAll('.image-card[data-search]')];
      let visibleCards = 0;
      for (const card of cards) {
        const matches = sourceAllowed && (!query || (card.dataset.search || '').includes(query)) && !issuesOnly.checked;
        card.hidden = !matches;
        card.classList.toggle('filtered-out', !matches);
        if (matches) visibleCards += 1;
      }
      const sectionIssueAllowed = !issuesOnly.checked || section.dataset.sectionIssue === 'true';
      const searchableText = (wrapper.textContent || '').toLowerCase();
      const sectionSearchAllowed = !query || sectionRows.length > 0 || cards.length > 0 || searchableText.includes(query);
      const hasFilterableContent = sectionRows.length > 0 || cards.length > 0;
      const showSection =
        sourceAllowed &&
        sectionIssueAllowed &&
        sectionSearchAllowed &&
        (!hasFilterableContent || sectionVisibleRows + visibleCards > 0);
      wrapper.hidden = !showSection;
      wrapper.classList.toggle('filtered-out', !showSection);
      const empty = wrapper.querySelector('.filter-empty');
      if (empty) empty.hidden = !sourceAllowed || !hasFilterableContent || sectionVisibleRows + visibleCards > 0;
      if (showSection) visibleSections += 1;
    }
    summary.textContent = visibleSections + ' section(s) · ' + visibleRows + ' row(s) visible';
  };

  const refreshFacetButtons = () => {
    for (const button of controls.querySelectorAll('[data-facet-group]')) {
      const set = activeFacets.get(button.dataset.facetGroup);
      const pressed = Boolean(set && set.has(button.dataset.facetValue));
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      button.classList.toggle('active', pressed);
    }
  };

  controls.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target) return;
    if (target.matches('[data-reset-filters]')) {
      search.value = '';
      issuesOnly.checked = false;
      sourceInputs.forEach((input) => { input.checked = true; });
      activeFacets.clear();
      refreshFacetButtons();
      applyFilters();
      return;
    }
    if (target.matches('[data-facet-group]')) {
      const group = target.dataset.facetGroup;
      const value = target.dataset.facetValue;
      if (!activeFacets.has(group)) activeFacets.set(group, new Set());
      const set = activeFacets.get(group);
      if (set.has(value)) set.delete(value); else set.add(value);
      if (set.size === 0) activeFacets.delete(group);
      refreshFacetButtons();
      applyFilters();
      return;
    }
    if (target.matches('[data-metric-filter]')) {
      const group = target.dataset.filterGroup;
      const value = target.dataset.filterValue;
      const existing = activeFacets.get(group);
      if (existing && existing.size === 1 && existing.has(value)) activeFacets.delete(group);
      else activeFacets.set(group, new Set([value]));
      refreshFacetButtons();
      applyFilters();
      return;
    }
    if (target.matches('[data-expand-all], [data-collapse-all]')) {
      const expand = target.matches('[data-expand-all]');
      for (const button of document.querySelectorAll('[data-section-toggle]')) {
        const section = button.closest('[data-dashboard-section]');
        const body = section && section.querySelector('[data-section-body]');
        if (!body) continue;
        body.hidden = !expand;
        button.setAttribute('aria-expanded', expand ? 'true' : 'false');
        button.querySelector('[aria-hidden]').textContent = expand ? '▾' : '▸';
      }
      return;
    }
    if (target.matches('[data-print-report]')) {
      window.print();
      return;
    }
    if (target.matches('[data-theme-toggle]')) {
      const values = ['auto', 'light', 'dark'];
      const current = document.documentElement.dataset.theme || 'auto';
      const next = values[(values.indexOf(current) + 1) % values.length];
      document.documentElement.dataset.theme = next;
      target.textContent = 'Theme: ' + titleCase(next);
      return;
    }
    if (target.matches('[data-export-visible]')) {
      const records = [];
      for (const wrapper of sections.filter((item) => !item.hidden)) {
        const heading = wrapper.querySelector('h2')?.textContent || 'Section';
        for (const row of wrapper.querySelectorAll('tr[data-dashboard-row]:not([hidden])')) {
          records.push([heading, ...[...row.cells].map((cell) => cell.textContent || '')]);
        }
      }
      const csv = records.map((record) => record.map((value) => '"' + value.replaceAll('"', '""') + '"').join(',')).join('\\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'selector-toolkit-visible-rows.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
    }
  });

  controls.addEventListener('input', (event) => {
    if (event.target.matches('[data-report-search], [data-issues-only], [data-source-filter]')) applyFilters();
  });
  controls.addEventListener('change', (event) => {
    if (event.target.matches('[data-report-search], [data-issues-only], [data-source-filter]')) applyFilters();
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target) return;
    if (target.matches('[data-metric-filter]')) {
      const group = target.dataset.filterGroup;
      const value = target.dataset.filterValue;
      const existing = activeFacets.get(group);
      if (existing && existing.size === 1 && existing.has(value)) activeFacets.delete(group);
      else activeFacets.set(group, new Set([value]));
      refreshFacetButtons();
      applyFilters();
      return;
    }
    if (target.matches('[data-section-toggle]')) {
      const section = target.closest('[data-dashboard-section]');
      const body = section && section.querySelector('[data-section-body]');
      if (!body) return;
      body.hidden = !body.hidden;
      target.setAttribute('aria-expanded', body.hidden ? 'false' : 'true');
      target.querySelector('[aria-hidden]').textContent = body.hidden ? '▸' : '▾';
      return;
    }
    if (target.matches('[data-sort-index]')) {
      const table = target.closest('table');
      const body = table && table.querySelector('tbody');
      if (!body) return;
      const index = Number(target.dataset.sortIndex);
      const direction = target.dataset.sortDirection === 'asc' ? 'desc' : 'asc';
      for (const button of table.querySelectorAll('[data-sort-index]')) delete button.dataset.sortDirection;
      target.dataset.sortDirection = direction;
      const items = [...body.querySelectorAll('tr')];
      const value = (row) => (row.cells[index]?.textContent || '').trim();
      items.sort((left, right) => {
        const a = value(left); const b = value(right);
        const an = Number(a); const bn = Number(b);
        const compared = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        return direction === 'asc' ? compared : -compared;
      });
      items.forEach((item) => body.append(item));
      return;
    }
    if (target.matches('[data-image-open]')) {
      const image = target.querySelector('img');
      const dialog = document.querySelector('[data-image-dialog]');
      if (!image || !dialog) return;
      dialog.querySelector('img').src = image.src;
      dialog.querySelector('img').alt = image.alt;
      dialog.querySelector('figcaption').textContent = image.alt;
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    }
    if (target.matches('[data-image-close]')) {
      const dialog = target.closest('dialog');
      if (dialog && typeof dialog.close === 'function') dialog.close(); else dialog?.removeAttribute('open');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
      event.preventDefault();
      search.focus();
    }
    if (event.key === 'Escape' && document.activeElement === search) {
      search.value = '';
      applyFilters();
      search.blur();
    }
  });

  applyFilters();
})();
</script>`;
}

export function renderPortableHtmlReport(
  sources: readonly HtmlReportSource[],
  images: readonly HtmlReportImage[],
  options: RenderHtmlReportOptions,
): string {
  const interactive = options.interactive ?? true;
  const navigation = sources
    .map((source, index) => `<a href="#source-${index + 1}">${escapeHtml(source.kind)}</a>`)
    .join('');
  const diagnosticImages = images;
  const sections = sources
    .map((source, index) => {
      const content =
        source.kind === 'discovery'
          ? renderDiscovery(source, options.maxItemsPerSection, interactive)
          : source.kind === 'locators'
            ? renderLocators(source, options.maxItemsPerSection, interactive)
            : source.kind === 'validation'
              ? renderValidation(source, options.maxItemsPerSection, interactive)
              : source.kind === 'repair'
                ? renderRepair(source, options.maxItemsPerSection, interactive)
                : source.kind === 'comparison'
                  ? renderComparison(source, options.maxItemsPerSection, interactive)
                  : source.kind === 'monitoring-history'
                    ? renderMonitoringHistory(source, options.maxItemsPerSection, interactive)
                    : renderDiagnostics(
                        source,
                        diagnosticImages,
                        options.maxItemsPerSection,
                        interactive,
                      );
      return `<div id="source-${index + 1}" class="source-section" data-source-wrapper="${escapeHtml(source.kind)}">${content}</div>`;
    })
    .join('');
  const generated = new Date().toISOString();
  const controls = interactive ? dashboardControls(sources.map((source) => source.kind)) : '';
  const script = interactive ? dashboardScript() : '';
  const dialog = interactive
    ? `<dialog class="image-dialog" data-image-dialog><button type="button" data-image-close aria-label="Close image">×</button><figure><img alt=""><figcaption></figcaption></figure></dialog>`
    : '';
  return `<!doctype html>
<html lang="en" data-theme="auto"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHtml(options.title)}</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18202a;background:#f4f6f8;line-height:1.45;--page:#f4f6f8;--panel:#fff;--panel-soft:#f9fafb;--text:#18202a;--heading:#101828;--muted:#667085;--border:#d0d5dd;--border-soft:#eaecf0;--nav:#101828;--link:#155eef;--shadow:#1018280a}*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--text)}a{color:var(--link)}button,input{font:inherit}button{cursor:pointer}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em;overflow-wrap:anywhere}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}nav{position:sticky;top:0;z-index:20;display:flex;gap:.65rem;align-items:center;padding:.8rem 1.25rem;background:var(--nav);color:#fff;box-shadow:0 2px 8px #0003;overflow:auto}nav strong{margin-right:auto;white-space:nowrap}nav a{color:#d1e9ff;text-decoration:none;text-transform:capitalize}.hero{padding:2.5rem max(1rem,calc((100% - 1180px)/2));background:linear-gradient(135deg,#101828,#344054);color:white}.hero h1{margin:0 0 .5rem;font-size:clamp(1.8rem,4vw,3rem)}.hero p{margin:.25rem 0;color:#d0d5dd}.dashboard-controls{position:sticky;top:49px;z-index:15;max-width:1180px;margin:0 auto;padding:.8rem 1rem;background:color-mix(in srgb,var(--panel) 96%,transparent);border:1px solid var(--border);border-top:0;border-radius:0 0 14px 14px;box-shadow:0 8px 18px #10182812;backdrop-filter:blur(10px)}.control-row{display:flex;flex-wrap:wrap;align-items:center;gap:.55rem;margin:.4rem 0}.control-row button,.facet-chip,.source-chip{border:1px solid var(--border);border-radius:8px;background:var(--panel-soft);color:var(--text);padding:.42rem .65rem}.search-control{display:grid;gap:.2rem;min-width:min(100%,320px);font-size:.8rem;color:var(--muted)}.search-control input{border:1px solid var(--border);border-radius:8px;padding:.58rem .7rem;background:var(--panel);color:var(--text)}.toggle-control,.source-chip{display:inline-flex;align-items:center;gap:.35rem;font-size:.85rem}.filter-summary{margin-left:auto;color:var(--muted);font-size:.84rem}.control-label{font-weight:700;font-size:.82rem}.facet-controls{display:flex;flex-wrap:wrap;gap:.65rem}.facet-group{display:flex;flex-wrap:wrap;gap:.35rem;border:0;padding:0;margin:.25rem 0}.facet-group legend{font-weight:700;font-size:.78rem;color:var(--muted);margin-right:.25rem}.facet-chip{padding:.25rem .55rem;font-size:.78rem;border-radius:999px}.facet-chip.active,.facet-chip[aria-pressed="true"],.metric[data-metric-filter][aria-pressed="true"]{background:#155eef;color:#fff;border-color:#155eef}.action-controls button:hover,.facet-chip:hover,.source-chip:hover{border-color:#84adff}.filter-empty{color:var(--muted);font-style:italic}.filtered-out{display:none!important}main{max-width:1180px;margin:auto;padding:1.25rem}section{background:var(--panel);border:1px solid var(--border);border-radius:14px;margin:1.25rem 0;padding:1.15rem;box-shadow:0 2px 8px var(--shadow)}section>header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--border-soft);margin:-.1rem 0 1rem;padding-bottom:.75rem}section>header p{margin:.2rem 0;color:var(--muted)}.section-toggle{border:1px solid var(--border);border-radius:8px;background:var(--panel-soft);color:var(--text);min-width:2.25rem;height:2.25rem}h2,h3{color:var(--heading)}h2{margin:.1rem 0}h3{margin-top:1.5rem}.source-path{font-size:.85rem;color:var(--muted);margin-bottom:1rem}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:.75rem;margin:1rem 0}.metric{display:block;width:100%;text-align:left;border:1px solid var(--border);border-radius:10px;padding:.75rem;background:var(--panel-soft);color:var(--text)}button.metric:hover{transform:translateY(-1px);box-shadow:0 3px 8px #10182818}.metric span{display:block;color:var(--muted);font-size:.8rem}.metric strong{font-size:1.35rem}.metric.good{border-color:#75e0a7;background:#ecfdf3;color:#18202a}.metric.warn{border-color:#fec84b;background:#fffaeb;color:#18202a}.metric.bad{border-color:#fda29b;background:#fef3f2;color:#18202a}.table-wrap{overflow:auto;border:1px solid var(--border-soft);border-radius:10px}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{padding:.65rem .75rem;text-align:left;border-bottom:1px solid var(--border-soft);vertical-align:top}th{background:var(--panel-soft);color:var(--muted);position:sticky;top:0}.sort-button{border:0;background:transparent;color:inherit;font-weight:700;padding:0;text-align:left}.badge{display:inline-block;padding:.18rem .5rem;border-radius:999px;background:#eaecf0;color:#344054;font-size:.78rem;white-space:nowrap}.badge.high,.badge.pass{background:#dcfae6;color:#067647}.badge.medium{background:#fef0c7;color:#b54708}.badge.low,.badge.fail,.badge.error{background:#fee4e2;color:#b42318}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem}.image-card{margin:0;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--panel-soft)}.image-open{display:block;width:100%;border:0;padding:0;background:transparent}.image-card img{display:block;width:100%;max-height:520px;object-fit:contain;background:#eef2f6}.image-card figcaption,.image-card.unavailable{padding:.65rem;font-size:.82rem;color:var(--muted)}.image-dialog{width:min(95vw,1100px);max-height:95vh;border:1px solid var(--border);border-radius:12px;padding:1rem;background:var(--panel);color:var(--text)}.image-dialog::backdrop{background:#000b}.image-dialog>button{float:right;border:1px solid var(--border);border-radius:999px;background:var(--panel-soft);color:var(--text);font-size:1.25rem}.image-dialog figure{margin:2rem 0 0}.image-dialog img{display:block;max-width:100%;max-height:78vh;margin:auto}.image-dialog figcaption{text-align:center;color:var(--muted);padding:.5rem}.callout{border-left:5px solid #d92d20;background:#fef3f2;color:#18202a;padding:.8rem 1rem;border-radius:8px}.empty,.omitted{color:var(--muted);font-style:italic}footer{padding:2rem;text-align:center;color:var(--muted)}html[data-theme="dark"]{--page:#0c111d;--panel:#161b26;--panel-soft:#1d2939;--text:#e4e7ec;--heading:#f9fafb;--muted:#98a2b3;--border:#344054;--border-soft:#344054;--link:#84adff;--shadow:#0003}html[data-theme="light"]{color-scheme:light}@media(prefers-color-scheme:dark){html[data-theme="auto"]{--page:#0c111d;--panel:#161b26;--panel-soft:#1d2939;--text:#e4e7ec;--heading:#f9fafb;--muted:#98a2b3;--border:#344054;--border-soft:#344054;--link:#84adff;--shadow:#0003}}
@media(max-width:720px){.dashboard-controls{position:static;border-radius:0}.filter-summary{width:100%;margin-left:0}.control-row>*{max-width:100%}}
@media print{nav,.dashboard-controls,.section-toggle,.sort-button,.image-dialog{display:none!important}.hero{background:#101828!important;print-color-adjust:exact}section{break-inside:avoid;box-shadow:none}.gallery{display:block}.image-card{break-inside:avoid;margin-bottom:1rem}.source-section[hidden],tr[hidden],.image-card[hidden]{display:none!important}}
</style></head><body><nav><strong>Selector Toolkit</strong>${navigation}</nav><div class="hero"><h1>${escapeHtml(options.title)}</h1><p>${sources.length} recognized toolkit report(s) · ${images.length} screenshot(s)</p><p>Generated ${escapeHtml(generated)}</p></div>${controls}<main>${sections}</main>${dialog}<footer>Portable report generated by playwright-selector-toolkit. ${interactive ? 'Interactive controls run entirely offline.' : 'No external stylesheets or scripts are required.'}</footer>${script}</body></html>`;
}
