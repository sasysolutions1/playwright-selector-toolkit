import type { ArtifactRun } from '../types/artifacts.js';
import type { BrowserInspectionReport } from '../types/browser.js';
import type { ResolvedToolkitConfig } from '../types/config.js';
import type { PluginHostReport } from '../types/plugins.js';
import type { DoctorCheck, DoctorReport } from '../types/doctor.js';
import type { DiagnosticEvidenceReport } from '../types/diagnostics.js';
import type { HtmlReportBuildReport } from '../types/html-report.js';
import type { DomDiscoveryReport } from '../types/dom.js';
import type { DomComparisonRunReport } from '../types/comparison.js';
import type { LocatorAnalysisReport } from '../types/locator.js';
import type { SelectorValidationRunReport } from '../types/validation.js';
import type { SelectorRepairRunReport } from '../types/repair.js';
import type { CompatibilityReport, SecurityReviewReport } from '../types/release.js';
import type {
  MonitorCycleReport,
  MonitorHistoryPruneReport,
  MonitorHistoryReport,
  MonitorState,
  MonitorWatchReport,
} from '../types/monitoring.js';
import type {
  BaselineRecord,
  BaselineSaveReport,
  BaselineSummary,
  SnapshotBundleReport,
} from '../types/snapshot.js';
import { toErrorReport } from '../errors/toolkit-error.js';

const statusSymbol: Readonly<Record<DoctorCheck['status'], string>> = {
  pass: 'PASS',
  warn: 'WARN',
  fail: 'FAIL',
};

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [
    `Playwright Selector Toolkit ${report.toolkitVersion}`,
    `Checked: ${report.checkedAt}`,
    `Working directory: ${report.cwd}`,
    `Artifact directory: ${report.artifactsDir}`,
    '',
  ];

  for (const check of report.checks) {
    lines.push(`[${statusSymbol[check.status]}] ${check.label}: ${check.message}`);
  }

  lines.push(
    '',
    `Summary: ${report.summary.pass} passed, ${report.summary.warn} warnings, ${report.summary.fail} failed`,
  );

  return lines.join('\n');
}

export function formatResolvedConfig(resolved: ResolvedToolkitConfig): string {
  const { config, sources } = resolved;
  const lines = [
    'Resolved toolkit configuration',
    '',
    `Working directory: ${config.cwd}`,
    `Configuration file: ${sources.configFile ?? '(none)'}`,
    `Artifact directory: ${config.artifactsDir}`,
    `Browser: ${config.browser}`,
    `Headless: ${String(config.headless)}`,
    `Timeout: ${config.timeoutMs} ms`,
    `Navigation timeout: ${config.navigationTimeoutMs} ms`,
    `Viewport: ${config.viewport.width}x${config.viewport.height}`,
    `Trace: ${config.trace}`,
    `Screenshots: ${config.screenshots}`,
    `Base URL: ${config.baseUrl ?? '(none)'}`,
    `User data directory: ${config.userDataDir ?? '(none)'}`,
    `Storage state: ${config.storageStatePath ?? '(none)'}`,
    `Executable path: ${config.executablePath ?? '(Playwright managed)'}`,
    `Plugins: ${config.plugins?.join(', ') || '(none)'}`,
    `Plugin timeout: ${config.pluginTimeoutMs ?? 10000} ms`,
    `Plugin failure mode: ${config.pluginFailureMode ?? 'isolate'}`,
    `Environment overrides: ${sources.environmentVariables.join(', ') || '(none)'}`,
    `CLI overrides: ${sources.cliOptions.join(', ') || '(none)'}`,
  ];

  return lines.join('\n');
}

export function formatArtifactRun(run: ArtifactRun): string {
  return [
    'Artifact run created',
    '',
    `ID: ${run.id}`,
    `Command: ${run.command}`,
    `Name: ${run.name ?? '(none)'}`,
    `Directory: ${run.directories.run}`,
    `Metadata: ${run.metadataPath}`,
  ].join('\n');
}

export function formatBrowserInspection(report: BrowserInspectionReport): string {
  const { navigation, session, close } = report;
  const lines = [
    'Browser inspection complete',
    '',
    `Browser: ${session.browser}`,
    `Session mode: ${session.mode}`,
    `Headless: ${String(session.headless)}`,
    `Requested URL: ${navigation.requestedUrl}`,
    `Final URL: ${navigation.finalUrl}`,
    `Title: ${navigation.title || '(none)'}`,
    `HTTP status: ${navigation.status ?? '(not applicable)'}`,
    `Artifact directory: ${session.artifactRun.directories.run}`,
    `Trace: ${close.tracePath ?? '(not retained)'}`,
    `Screenshot: ${close.screenshotPath ?? '(not captured)'}`,
    `Storage state: ${close.storageStatePath ?? '(not saved)'}`,
  ];

  if (close.warnings.length > 0) {
    lines.push('', 'Warnings:', ...close.warnings.map((warning) => `- ${warning}`));
  }

  return lines.join('\n');
}

export function formatCliError(error: unknown, json = false): string {
  const report = toErrorReport(error);

  if (json) {
    return `${JSON.stringify({ error: report }, null, 2)}\n`;
  }

  const details = Object.keys(report.details).length
    ? `\nDetails: ${JSON.stringify(report.details)}`
    : '';
  return `selector: [${report.code}] ${report.message}${details}\n`;
}

export function formatDomDiscovery(report: DomDiscoveryReport): string {
  const { summary } = report;
  const lines = [
    'DOM discovery complete',
    '',
    `Requested URL: ${report.navigation.requestedUrl}`,
    `Final URL: ${report.navigation.finalUrl}`,
    `Title: ${report.navigation.title || '(none)'}`,
    `Snapshot: ${report.snapshotPath}`,
    `Frames inspected: ${summary.frameCount}`,
    `Frames failed: ${summary.failedFrameCount}`,
    `Open shadow roots: ${summary.shadowRootCount}`,
    `Elements inspected: ${summary.inspectedElementCount}`,
    `Elements recorded: ${summary.matchedElementCount}`,
    `Visible elements: ${summary.visibleElementCount}`,
    `Hidden elements: ${summary.hiddenElementCount}`,
    `Interactive elements: ${summary.interactiveElementCount}`,
    `Sensitive elements: ${summary.sensitiveElementCount}`,
    `Redactions applied: ${summary.redactionCount}`,
    `Truncated: ${String(summary.truncated)}`,
    `Artifact directory: ${report.artifactRun.directories.run}`,
  ];

  const kinds = Object.entries(summary.kinds).sort(([left], [right]) => left.localeCompare(right));
  if (kinds.length > 0) {
    lines.push('', 'Element kinds:', ...kinds.map(([kind, count]) => `- ${kind}: ${count}`));
  }
  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:', ...report.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join('\n');
}

export function formatLocatorAnalysis(report: LocatorAnalysisReport): string {
  const { summary } = report;
  const lines = [
    'Locator candidate analysis complete',
    '',
    `Requested URL: ${report.navigation.requestedUrl}`,
    `Final URL: ${report.navigation.finalUrl}`,
    `Title: ${report.navigation.title || '(none)'}`,
    `DOM snapshot: ${report.snapshotPath}`,
    `Candidate report: ${report.candidatePath}`,
    `Elements analyzed: ${summary.elementCount}`,
    `Candidates generated: ${summary.candidateCount}`,
    `Candidates tested: ${summary.testedCandidateCount}`,
    `Unique candidates: ${summary.uniqueCandidateCount}`,
    `Ambiguous candidates: ${summary.multipleCandidateCount}`,
    `Missing candidates: ${summary.missingCandidateCount}`,
    `Evaluation errors: ${summary.errorCandidateCount}`,
    `Elements with a unique candidate: ${summary.elementsWithUniqueCandidate}`,
    `Elements without candidates: ${summary.elementsWithoutCandidates}`,
    `Recommended locators: ${summary.recommendedLocatorCount}`,
    `Elements without a recommendation: ${summary.elementsWithoutRecommendation}`,
    `High-confidence candidates: ${summary.highConfidenceCandidateCount}`,
    `Medium-confidence candidates: ${summary.mediumConfidenceCandidateCount}`,
    `Low-confidence candidates: ${summary.lowConfidenceCandidateCount}`,
    `Average stability score: ${summary.averageStabilityScore}`,
    `Artifact directory: ${report.artifactRun.directories.run}`,
  ];
  const strategies = Object.entries(summary.strategies).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (strategies.length > 0) {
    lines.push(
      '',
      'Candidate strategies:',
      ...strategies.map(([strategy, count]) => `- ${strategy}: ${count}`),
    );
  }
  if (report.recommendations.length > 0) {
    lines.push(
      '',
      'Recommended locators:',
      ...report.recommendations
        .slice(0, 10)
        .map(
          (recommendation) =>
            `- [${recommendation.confidence} ${recommendation.score}] ${recommendation.playwright}`,
        ),
    );
  }
  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:', ...report.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join('\n');
}

export function formatSelectorValidation(report: SelectorValidationRunReport): string {
  const lines = [
    report.summary.success ? 'Selector validation passed' : 'Selector validation failed',
    '',
    `Manifest: ${report.manifestPath}`,
    `Requested URL: ${report.navigation.requestedUrl}`,
    `Final URL: ${report.navigation.finalUrl}`,
    `Report: ${report.reportPath}`,
    `Total selectors: ${report.summary.total}`,
    `Required selectors: ${report.summary.required}`,
    `Optional selectors: ${report.summary.optional}`,
    `Passed: ${report.summary.passed}`,
    `Failed: ${report.summary.failed}`,
    `Errors: ${report.summary.errors}`,
    `Required failures: ${report.summary.requiredFailures}`,
    `Optional failures: ${report.summary.optionalFailures}`,
    `Artifact directory: ${report.artifactRun.directories.run}`,
  ];
  const failures = report.results.filter((result) => result.status !== 'pass');
  if (failures.length > 0) {
    lines.push(
      '',
      'Failures:',
      ...failures.map(
        (result) =>
          `- [${result.required ? 'required' : 'optional'} ${result.status}] ${result.id}: ${
            result.error ??
            result.assertions
              .filter((item) => item.status === 'fail')
              .map((item) => item.message)
              .join('; ')
          }`,
      ),
    );
  }
  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:', ...report.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join('\n');
}

export function formatSelectorRepair(report: SelectorRepairRunReport): string {
  const summary = report.report.summary;
  const lines = [
    'Selector repair suggestions generated',
    '',
    `Manifest: ${report.manifestPath}`,
    `Requested URL: ${report.navigation.requestedUrl}`,
    `Final URL: ${report.navigation.finalUrl}`,
    `Provider: ${report.report.provider}`,
    `Model: ${report.report.model ?? '(none)'}`,
    `Repair report: ${report.reportPath}`,
    `Review proposal: ${report.proposalPath}`,
    `Failed selectors analyzed: ${summary.failedSelectorCount}`,
    `Selectors with suggestions: ${summary.selectorsWithSuggestions}`,
    `Selectors with recommendations: ${summary.selectorsWithRecommendation}`,
    `Unresolved required selectors: ${summary.unresolvedRequiredCount}`,
    `Unresolved optional selectors: ${summary.unresolvedOptionalCount}`,
    'Approval required: yes',
    `Artifact directory: ${report.artifactRun.directories.run}`,
  ];

  for (const repair of report.report.repairs) {
    lines.push('', `${repair.selector.id} — ${repair.selector.name}`);
    if (repair.recommendedSuggestionId === null) {
      lines.push(`- Unresolved: ${repair.unresolvedReason ?? 'No recommendation available.'}`);
      continue;
    }
    const recommended = repair.suggestions.find(
      (suggestion) => suggestion.id === repair.recommendedSuggestionId,
    );
    if (recommended !== undefined) {
      lines.push(
        `- Recommended [${recommended.confidence} ${recommended.score}] ${recommended.playwright}`,
        `- Source: ${recommended.source}`,
      );
      if (recommended.aiRationale !== null)
        lines.push(`- AI rationale: ${recommended.aiRationale}`);
    }
  }

  lines.push(
    '',
    'The original selector manifest was not changed. Review and validate the YAML proposal before use.',
  );
  if (report.report.warnings.length > 0) {
    lines.push('', 'Warnings:', ...report.report.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join('\n');
}

export function formatSnapshotBundle(report: SnapshotBundleReport): string {
  return [
    'Snapshot bundle captured',
    '',
    `Requested URL: ${report.navigation.requestedUrl}`,
    `Final URL: ${report.navigation.finalUrl}`,
    `Title: ${report.navigation.title || '(none)'}`,
    `Bundle: ${report.bundlePath}`,
    `DOM snapshot: ${report.domSnapshotPath}`,
    `HTML manifest: ${report.htmlManifestPath}`,
    `Fingerprint index: ${report.fingerprintPath}`,
    `Sanitized HTML frames: ${report.htmlFramePaths.length}`,
    `Recorded DOM elements: ${report.manifest.domSummary.matchedElementCount}`,
    `Semantic fingerprints: ${report.manifest.fingerprintSummary.uniqueSemanticHashCount}`,
    `Duplicate semantic groups: ${report.manifest.fingerprintSummary.duplicateSemanticGroupCount}`,
    `HTML redactions: ${report.manifest.htmlSummary.redactionCount}`,
    `Artifact directory: ${report.artifactRun.directories.run}`,
  ].join('\n');
}

export function formatBaselineSave(report: BaselineSaveReport): string {
  return [
    'Baseline saved',
    '',
    `Name: ${report.baseline.name}`,
    `Version: ${report.baseline.version}`,
    `URL: ${report.baseline.manifest.finalUrl}`,
    `Title: ${report.baseline.manifest.title || '(none)'}`,
    `Directory: ${report.baseline.directory}`,
    `Manifest: ${report.baseline.manifestPath}`,
    `Elements: ${report.baseline.manifest.fingerprintSummary.elementCount}`,
    `HTML frames: ${report.baseline.manifest.htmlSummary.frameCount}`,
  ].join('\n');
}

export function formatBaselineList(baselines: readonly BaselineSummary[]): string {
  if (baselines.length === 0) return 'No baselines saved.';
  return [
    `Saved baselines: ${baselines.length}`,
    '',
    ...baselines.map(
      (baseline) =>
        `- ${baseline.name}@${baseline.latestVersion} — ${baseline.title || baseline.finalUrl}`,
    ),
  ].join('\n');
}

export function formatBaselineRecord(record: BaselineRecord): string {
  return [
    'Baseline',
    '',
    `Name: ${record.name}`,
    `Version: ${record.version}`,
    `Created: ${record.manifest.createdAt}`,
    `URL: ${record.manifest.finalUrl}`,
    `Title: ${record.manifest.title || '(none)'}`,
    `Directory: ${record.directory}`,
    `Manifest: ${record.manifestPath}`,
    `Elements: ${record.manifest.fingerprintSummary.elementCount}`,
    `Semantic fingerprint groups: ${record.manifest.fingerprintSummary.uniqueSemanticHashCount}`,
    `HTML frames: ${record.manifest.htmlSummary.frameCount}`,
  ].join('\n');
}

export function formatDomComparison(report: DomComparisonRunReport): string {
  const { summary } = report.comparison;
  const lines = [
    summary.driftDetected ? 'DOM drift detected' : 'No DOM drift detected',
    '',
    `Baseline: ${report.baseline.name}@${report.baseline.version}`,
    `Baseline URL: ${report.comparison.baseline.finalUrl}`,
    `Current URL: ${report.comparison.current.finalUrl}`,
    `Report: ${report.reportPath}`,
    `Baseline elements: ${summary.baselineElementCount}`,
    `Current elements: ${summary.currentElementCount}`,
    `Matched elements: ${summary.matchedElementCount}`,
    `Unchanged: ${summary.unchangedElementCount}`,
    `Added: ${summary.addedElementCount}`,
    `Removed: ${summary.removedElementCount}`,
    `Moved: ${summary.movedElementCount}`,
    `Changed: ${summary.changedElementCount}`,
    `Moved and changed: ${summary.movedAndChangedElementCount}`,
    `Artifact directory: ${report.artifactRun.directories.run}`,
  ];
  const drift = report.comparison.differences.filter((item) => item.kind !== 'unchanged');
  if (drift.length > 0) {
    lines.push(
      '',
      'Detected changes:',
      ...drift.slice(0, 20).map((item) => {
        if (item.kind === 'added') {
          return `- [added] ${item.current.kind} ${item.current.accessibleName ?? item.current.domPath}`;
        }
        if (item.kind === 'removed') {
          return `- [removed] ${item.baseline.kind} ${item.baseline.accessibleName ?? item.baseline.domPath}`;
        }
        const replacements =
          item.replacementLocators.length > 0
            ? ` — suggested: ${item.replacementLocators[0]?.playwright ?? ''}`
            : '';
        return `- [${item.kind}] ${item.baseline.kind} ${item.baseline.accessibleName ?? item.baseline.domPath} (${item.changedFields.join(', ') || 'location'})${replacements}`;
      }),
    );
  }
  if (report.comparison.warnings.length > 0) {
    lines.push('', 'Warnings:', ...report.comparison.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join('\n');
}

export function formatDiagnosticEvidence(report: DiagnosticEvidenceReport): string {
  const summary = report.manifest.recorder.summary;
  const lines = [
    report.success ? 'Diagnostic evidence captured' : 'Diagnostic failure evidence captured',
    '',
    `Requested URL: ${report.manifest.requestedUrl}`,
    `Final URL: ${report.manifest.finalUrl ?? '(unavailable)'}`,
    `Title: ${report.manifest.title ?? '(unavailable)'}`,
    `Report: ${report.reportPath}`,
    `Archive: ${report.archivePath ?? '(not created)'}`,
    `Screenshots: ${report.manifest.screenshots.artifacts.length}`,
    `Screenshot failures: ${report.manifest.screenshots.failures.length}`,
    `Console entries: ${summary.consoleEntryCount}`,
    `Page errors: ${summary.pageErrorCount}`,
    `Failed requests: ${summary.requestFailureCount}`,
    `HTTP errors: ${summary.httpErrorCount}`,
    `Trace: ${report.manifest.files.trace ?? '(not retained)'}`,
    `DOM snapshot: ${report.manifest.files.domSnapshot ?? '(not captured)'}`,
    `HTML frames: ${report.manifest.files.htmlFrames.length}`,
    `Artifact directory: ${report.artifactRun.directories.run}`,
  ];
  if (report.manifest.failure !== null) {
    lines.push('', `Failure: ${report.manifest.failure.name}: ${report.manifest.failure.message}`);
  }
  if (report.manifest.warnings.length > 0) {
    lines.push('', 'Warnings:', ...report.manifest.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join('\n');
}

export function formatHtmlReport(report: HtmlReportBuildReport): string {
  return [
    'Portable HTML report generated',
    '',
    `Title: ${report.manifest.title}`,
    `HTML report: ${report.reportPath}`,
    `Manifest: ${report.manifestPath}`,
    `Sources: ${report.manifest.sourceCount}`,
    `Screenshots: ${report.manifest.imageCount}`,
    `Embedded screenshots: ${report.manifest.embeddedImageCount}`,
    `Omitted screenshots: ${report.manifest.omittedImageCount}`,
    `Artifact directory: ${report.artifactRun.directories.run}`,
    ...(report.manifest.warnings.length === 0
      ? []
      : ['', 'Warnings:', ...report.manifest.warnings.map((warning) => `- ${warning}`)]),
  ].join('\n');
}

export function formatPluginHostReport(report: PluginHostReport): string {
  const lines = [
    'Plugin inspection complete',
    '',
    `Plugins loaded: ${report.plugins.length}`,
    `Diagnostics: ${report.diagnostics.length}`,
    `Detected page states: ${report.pageStates.length}`,
  ];
  for (const plugin of report.plugins) {
    const hookCount = Object.values(plugin.hooks).reduce((sum, value) => sum + value, 0);
    lines.push(
      '',
      `${plugin.name}${plugin.version === null ? '' : ` ${plugin.version}`}`,
      `  Description: ${plugin.description ?? '(none)'}`,
      `  Order: ${plugin.order}`,
      `  Specifier: ${plugin.specifier ?? '(inline)'}`,
      `  Hooks: ${hookCount}`,
      ...Object.entries(plugin.hooks)
        .filter(([, count]) => count > 0)
        .map(([kind, count]) => `    - ${kind}: ${count}`),
    );
  }
  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:', ...report.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join('\n');
}

export function formatCompatibilityReport(report: CompatibilityReport): string {
  const lines = [
    'Compatibility review complete',
    '',
    `Toolkit: ${report.toolkitVersion}`,
    `Node.js: ${report.runtime.node}`,
    `npm: ${report.runtime.npm ?? '(unavailable)'}`,
    `Platform: ${report.runtime.platform}/${report.runtime.architecture}`,
    `Supported Node.js lines: ${report.supportedNodeMajors.join(', ')}`,
    `Minimum Node.js: ${report.minimumNodeVersion}`,
    '',
  ];
  for (const item of report.checks) {
    lines.push(`[${item.status.toUpperCase()}] ${item.label}: ${item.message}`);
  }
  lines.push(
    '',
    `Summary: ${report.summary.pass} passed, ${report.summary.warn} warnings, ${report.summary.fail} failed`,
  );
  return lines.join('\n');
}

export function formatSecurityReview(report: SecurityReviewReport): string {
  const lines = ['Security review complete', '', `Toolkit: ${report.toolkitVersion}`, ''];
  for (const item of report.checks) {
    lines.push(`[${item.status.toUpperCase()}] ${item.label}: ${item.message}`);
  }
  if (report.findings.length > 0) {
    lines.push(
      '',
      'Findings:',
      ...report.findings.map(
        (finding) =>
          `- ${finding.path}${finding.line === null ? '' : `:${finding.line}`} [${finding.rule}] ${finding.message}`,
      ),
    );
  }
  lines.push(
    '',
    `Summary: ${report.summary.pass} passed, ${report.summary.warn} warnings, ${report.summary.fail} failed`,
  );
  return lines.join('\n');
}

export function formatMonitorCycle(report: MonitorCycleReport): string {
  const lines = [
    report.summary.success
      ? 'Selector health monitoring passed'
      : 'Selector health monitoring found issues',
    '',
    `Monitor: ${report.monitorName}`,
    `Manifest: ${report.manifestPath}`,
    `State: ${report.statePath}`,
    `Report: ${report.reportPath}`,
    `Targets: ${report.summary.targetCount}`,
    `Checked: ${report.summary.checkedCount}`,
    `Skipped: ${report.summary.skippedCount}`,
    `Healthy: ${report.summary.healthyCount}`,
    `Unhealthy: ${report.summary.unhealthyCount}`,
    `Open incidents: ${report.summary.openIncidentCount}`,
    `Notifications sent: ${report.summary.notificationsSent}`,
    `Notification failures: ${report.summary.notificationsFailed}`,
  ];
  for (const result of report.results) {
    if (!result.due) {
      lines.push('', `- ${result.targetName}: skipped (not due)`);
      continue;
    }
    lines.push(
      '',
      `- ${result.targetName}: ${result.outcome?.healthy === true ? 'healthy' : 'unhealthy'}`,
      `  Event: ${result.transition?.eventType ?? 'none'}`,
      `  Message: ${result.outcome?.message ?? '(none)'}`,
      `  Notifications: ${result.notifications.filter((item) => item.status === 'sent').length} sent, ${result.notifications.filter((item) => item.status === 'failed').length} failed`,
    );
  }
  return lines.join('\n');
}

export function formatMonitorState(state: MonitorState, statePath: string): string {
  const lines = [
    'Selector health monitor state',
    '',
    `Monitor: ${state.monitorName}`,
    `State: ${statePath}`,
    `Updated: ${state.updatedAt}`,
  ];
  const targets = Object.values(state.targets).sort((left, right) =>
    left.targetId.localeCompare(right.targetId),
  );
  if (targets.length === 0) lines.push('', 'No target checks have been recorded.');
  for (const target of targets) {
    lines.push(
      '',
      `- ${target.targetId}`,
      `  Last checked: ${target.lastCheckedAt ?? '(never)'}`,
      `  Consecutive failures: ${target.consecutiveFailures}`,
      `  Consecutive successes: ${target.consecutiveSuccesses}`,
      `  Incident: ${target.activeIncident === null ? 'none' : `${target.activeIncident.severity} ${target.activeIncident.id}`}`,
    );
  }
  return lines.join('\n');
}

export function formatMonitorWatch(report: MonitorWatchReport): string {
  return [
    'Selector health watch stopped',
    '',
    `Started: ${report.startedAt}`,
    `Stopped: ${report.stoppedAt}`,
    `Cycles: ${report.cycles}`,
    `Last cycle: ${report.lastCycle?.generatedAt ?? '(none)'}`,
    `Last cycle healthy: ${report.lastCycle === null ? '(none)' : String(report.lastCycle.summary.success)}`,
  ].join('\n');
}

function formatPercent(value: number | null): string {
  return value === null ? 'n/a' : `${value.toFixed(3).replace(/\.000$/u, '')}%`;
}

function formatDuration(value: number | null): string {
  if (value === null) return 'n/a';
  if (value < 1000) return `${value} ms`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr`;
  return `${Math.round(hours / 24)} days`;
}

export function formatMonitorHistory(report: MonitorHistoryReport): string {
  const lines = [
    'Selector health history',
    '',
    `Monitor: ${report.monitorName}`,
    `Window: ${report.window.since} to ${report.window.until}`,
    `History: ${report.historyPath}`,
    `Report: ${report.reportPath}`,
    `Targets: ${report.summary.targetCount}`,
    `Checks: ${report.summary.checks}`,
    `Check pass rate: ${formatPercent(report.summary.passRatePercent)}`,
    `Estimated availability: ${formatPercent(report.summary.estimatedAvailabilityPercent)}`,
    `Incidents: ${report.summary.incidentCount} (${report.summary.openIncidentCount} open)`,
    `Mean time to recovery: ${formatDuration(report.summary.meanTimeToRecoveryMs)}`,
    `Longest outage: ${formatDuration(report.summary.longestOutageMs)}`,
    `Average check duration: ${formatDuration(report.summary.averageCheckDurationMs)}`,
  ];
  for (const target of report.targets) {
    lines.push(
      '',
      `- ${target.targetName} (${target.targetId})`,
      `  Checks: ${target.checks} (${target.healthyChecks} healthy, ${target.unhealthyChecks} unhealthy)`,
      `  Pass rate: ${formatPercent(target.passRatePercent)}`,
      `  Estimated availability: ${formatPercent(target.estimatedAvailabilityPercent)}`,
      `  Incidents: ${target.incidentCount} (${target.openIncidentCount} open)`,
      `  MTTR: ${formatDuration(target.meanTimeToRecoveryMs)}`,
      `  MTBF: ${formatDuration(target.meanTimeBetweenFailuresMs)}`,
      `  P95 check duration: ${formatDuration(target.p95CheckDurationMs)}`,
    );
  }
  return lines.join('\n');
}

export function formatMonitorHistoryPrune(report: MonitorHistoryPruneReport): string {
  return [
    'Selector health history pruned',
    '',
    `History: ${report.historyPath}`,
    `Removed before: ${report.before}`,
    `Removed records: ${report.removed}`,
    `Retained records: ${report.retained}`,
  ].join('\n');
}
