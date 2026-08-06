import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { MonitoringError, normalizeError } from '../../errors/toolkit-error.js';
import type { ToolkitConfig } from '../../types/config.js';
import type {
  LoadedMonitorManifest,
  MonitorCycleReport,
  MonitorHealthOutcome,
  MonitorHistoryRecord,
  MonitorManifest,
  MonitorRunOptions,
  MonitorState,
  MonitorTarget,
  MonitorTargetRunResult,
  MonitorWatchOptions,
  MonitorWatchReport,
} from '../../types/monitoring.js';
import type {
  SelectorValidationOptions,
  SelectorValidationRunReport,
} from '../../types/validation.js';
import { createArtifactRun, resolveArtifactPath, writeJsonArtifact } from '../artifacts/manager.js';
import { runSelectorValidation } from '../validation/runner.js';
import {
  advanceMonitorTargetState,
  monitorTargetIsDue,
  recordMonitorNotificationAttempt,
} from './incidents.js';
import { loadMonitorManifest } from './manifest.js';
import {
  createMonitorNotification,
  createNotificationAdapter,
  deliverMonitorNotification,
  type MonitorNotificationAdapter,
  type NotificationAdapterDependencies,
} from './notifications.js';
import { loadMonitorState, saveMonitorState } from './state.js';
import {
  appendMonitorHistory,
  defaultMonitorHistoryPath,
  historyRecordsFromCycle,
} from './history.js';

export interface MonitorRunnerDependencies extends NotificationAdapterDependencies {
  readonly loadManifest?: (path: string) => Promise<LoadedMonitorManifest>;
  readonly loadState?: (path: string, monitorName: string, now?: Date) => Promise<MonitorState>;
  readonly saveState?: (path: string, state: MonitorState) => Promise<string>;
  readonly appendHistory?: (
    path: string,
    records: readonly MonitorHistoryRecord[],
  ) => Promise<string>;
  readonly selectorValidator?: (
    config: ToolkitConfig,
    manifestPath: string,
    options?: SelectorValidationOptions,
  ) => Promise<SelectorValidationRunReport>;
  readonly adapters?: readonly MonitorNotificationAdapter[];
  readonly now?: () => Date;
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

function slug(value: string): string {
  const result = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 100);
  return result === '' ? 'monitor' : result;
}

export function defaultMonitorStatePath(config: ToolkitConfig, monitorName: string): string {
  return resolve(config.artifactsDir, 'monitoring', slug(monitorName), 'state.json');
}

function outcomeFingerprint(target: MonitorTarget, message: string, code: string | null): string {
  return createHash('sha256')
    .update(JSON.stringify({ targetId: target.id, message, code }))
    .digest('hex');
}

function validationOutcome(
  target: MonitorTarget,
  report: SelectorValidationRunReport,
): MonitorHealthOutcome {
  const message = report.summary.success
    ? `All ${report.summary.total} selector checks passed.`
    : `${report.summary.requiredFailures} required selector check(s) failed; ${report.summary.optionalFailures} optional check(s) failed.`;
  return {
    healthy: report.summary.success,
    fingerprint: outcomeFingerprint(
      target,
      message,
      report.summary.success ? null : 'SELECTOR_VALIDATION_FAILED',
    ),
    message,
    validationSummary: report.summary,
    errorCode: report.summary.success ? null : 'SELECTOR_VALIDATION_FAILED',
  };
}

function errorOutcome(target: MonitorTarget, error: unknown): MonitorHealthOutcome {
  const normalized = normalizeError(error);
  const message = `[${normalized.code}] ${normalized.message}`;
  return {
    healthy: false,
    fingerprint: outcomeFingerprint(target, message, normalized.code),
    message,
    validationSummary: null,
    errorCode: normalized.code,
  };
}

function adaptersForManifest(
  manifest: MonitorManifest,
  dependencies: MonitorRunnerDependencies,
): readonly MonitorNotificationAdapter[] {
  return (
    dependencies.adapters ??
    manifest.notifications.map((config) => createNotificationAdapter(config, dependencies))
  );
}

function summary(results: readonly MonitorTargetRunResult[], state: MonitorState) {
  const checked = results.filter((item) => item.due && item.outcome !== null);
  const notifications = results.flatMap((item) => item.notifications);
  const openIncidentCount = Object.values(state.targets).filter(
    (item) => item.activeIncident !== null,
  ).length;
  return {
    targetCount: results.length,
    checkedCount: checked.length,
    skippedCount: results.length - checked.length,
    healthyCount: checked.filter((item) => item.outcome?.healthy === true).length,
    unhealthyCount: checked.filter((item) => item.outcome?.healthy === false).length,
    openIncidentCount,
    notificationsSent: notifications.filter((item) => item.status === 'sent').length,
    notificationsFailed: notifications.filter((item) => item.status === 'failed').length,
    success: openIncidentCount === 0 && checked.every((item) => item.outcome?.healthy !== false),
  };
}

export async function runMonitorCycle(
  config: ToolkitConfig,
  monitorManifestPath: string,
  options: MonitorRunOptions = {},
  dependencies: MonitorRunnerDependencies = {},
): Promise<MonitorCycleReport> {
  const now = (dependencies.now ?? (() => new Date()))();
  const loaded = await (dependencies.loadManifest ?? loadMonitorManifest)(monitorManifestPath);
  const statePath = resolve(
    options.stateFile ?? defaultMonitorStatePath(config, loaded.manifest.name),
  );
  const previousState = await (dependencies.loadState ?? loadMonitorState)(
    statePath,
    loaded.manifest.name,
    now,
  );
  const adapters = adaptersForManifest(loaded.manifest, dependencies);
  const nextTargets: Record<string, MonitorState['targets'][string]> = { ...previousState.targets };
  const results: MonitorTargetRunResult[] = [];

  for (const target of loaded.manifest.targets) {
    const targetState = previousState.targets[target.id];
    const due = options.force === true || monitorTargetIsDue(targetState, target.intervalMs, now);
    if (!due) {
      results.push({
        targetId: target.id,
        targetName: target.name,
        due: false,
        checkedAt: now.toISOString(),
        durationMs: 0,
        outcome: null,
        transition: null,
        notifications: [],
        validationReportPath: null,
      });
      continue;
    }

    const startedAt = Date.now();
    let validationReport: SelectorValidationRunReport | null = null;
    let outcome: MonitorHealthOutcome;
    try {
      validationReport = await (dependencies.selectorValidator ?? runSelectorValidation)(
        config,
        target.manifestPath,
        {
          command: 'monitor-validation',
          name: target.id,
          ...(target.url === undefined ? {} : { url: target.url }),
        },
      );
      outcome = validationOutcome(target, validationReport);
    } catch (error) {
      outcome = errorOutcome(target, error);
    }

    const advanced = advanceMonitorTargetState(targetState, target.id, outcome, target.policy, {
      now,
    });
    nextTargets[target.id] = advanced.state;
    const notification =
      options.notify === false
        ? null
        : createMonitorNotification(
            loaded.manifest.name,
            target,
            advanced.transition,
            outcome.message,
            now,
          );
    const notificationResults =
      notification === null ? [] : await deliverMonitorNotification(notification, target, adapters);
    if (notification !== null && notificationResults.length > 0) {
      nextTargets[target.id] = recordMonitorNotificationAttempt(
        nextTargets[target.id] ?? advanced.state,
        notification.severity,
        now,
        notification.incidentId,
      );
    }

    results.push({
      targetId: target.id,
      targetName: target.name,
      due: true,
      checkedAt: now.toISOString(),
      durationMs: Math.max(0, Date.now() - startedAt),
      outcome,
      transition: advanced.transition,
      notifications: notificationResults,
      validationReportPath: validationReport?.reportPath ?? null,
    });
  }

  const state: MonitorState = {
    schemaVersion: '1.0',
    monitorName: loaded.manifest.name,
    updatedAt: now.toISOString(),
    targets: nextTargets,
  };
  await (dependencies.saveState ?? saveMonitorState)(statePath, state);

  const artifactRun = await createArtifactRun(config, {
    command: options.command ?? 'monitor-run',
    name: options.name ?? loaded.manifest.name,
    now,
  });
  const reportPath = resolveArtifactPath(
    artifactRun,
    options.reportFile ?? 'reports/monitor-cycle.json',
  );
  const historyPath =
    options.recordHistory === false
      ? null
      : resolve(options.historyFile ?? defaultMonitorHistoryPath(config, loaded.manifest.name));
  const report: MonitorCycleReport = {
    schemaVersion: '1.0',
    monitorName: loaded.manifest.name,
    generatedAt: now.toISOString(),
    manifestPath: loaded.sourcePath,
    statePath,
    reportPath,
    historyPath,
    artifactRun,
    summary: summary(results, state),
    results,
  };
  if (historyPath !== null) {
    await (dependencies.appendHistory ?? appendMonitorHistory)(
      historyPath,
      historyRecordsFromCycle(report),
    );
  }
  await writeJsonArtifact(artifactRun, options.reportFile ?? 'reports/monitor-cycle.json', report);
  return report;
}

export function monitorCycleExitCode(report: MonitorCycleReport, failOnUnhealthy = false): number {
  return failOnUnhealthy && !report.summary.success ? 1 : 0;
}

async function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted === true) return;
  await new Promise<void>((resolvePromise) => {
    const timer = setTimeout(resolvePromise, ms);
    if (signal !== undefined) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolvePromise();
        },
        { once: true },
      );
    }
  });
}

export async function watchMonitor(
  config: ToolkitConfig,
  monitorManifestPath: string,
  options: MonitorWatchOptions = {},
  dependencies: MonitorRunnerDependencies = {},
): Promise<MonitorWatchReport> {
  const loaded = await (dependencies.loadManifest ?? loadMonitorManifest)(monitorManifestPath);
  const intervalMs = options.pollIntervalMs ?? loaded.manifest.pollIntervalMs;
  const startedAt = (dependencies.now ?? (() => new Date()))().toISOString();
  let cycles = 0;
  let lastCycle: MonitorCycleReport | null = null;
  try {
    while (
      options.signal?.aborted !== true &&
      (options.maxCycles === undefined || cycles < options.maxCycles)
    ) {
      lastCycle = await runMonitorCycle(config, monitorManifestPath, options, dependencies);
      cycles += 1;
      if (options.maxCycles !== undefined && cycles >= options.maxCycles) break;
      await (dependencies.sleep ?? defaultSleep)(intervalMs, options.signal);
    }
  } catch (error) {
    throw new MonitoringError('MONITOR_WATCH_FAILED', 'Monitor watch loop failed.', {
      cause: error,
      details: { monitorManifestPath, cycles },
    });
  }
  return {
    startedAt,
    stoppedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    cycles,
    lastCycle,
  };
}

export async function loadMonitorStatus(
  config: ToolkitConfig,
  monitorManifestPath: string,
  options: Pick<MonitorRunOptions, 'stateFile'> = {},
  dependencies: Pick<MonitorRunnerDependencies, 'loadManifest' | 'loadState' | 'now'> = {},
): Promise<{
  readonly manifest: LoadedMonitorManifest;
  readonly statePath: string;
  readonly state: MonitorState;
}> {
  const loaded = await (dependencies.loadManifest ?? loadMonitorManifest)(monitorManifestPath);
  const statePath = resolve(
    options.stateFile ?? defaultMonitorStatePath(config, loaded.manifest.name),
  );
  const state = await (dependencies.loadState ?? loadMonitorState)(
    statePath,
    loaded.manifest.name,
    (dependencies.now ?? (() => new Date()))(),
  );
  return { manifest: loaded, statePath, state };
}
