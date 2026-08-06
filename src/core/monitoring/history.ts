import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { createArtifactRun, resolveArtifactPath, writeJsonArtifact } from '../artifacts/manager.js';
import { MonitoringError } from '../../errors/toolkit-error.js';
import type { ToolkitConfig } from '../../types/config.js';
import type {
  MonitorCycleReport,
  MonitorDailyTrend,
  MonitorHistoryPruneOptions,
  MonitorHistoryPruneReport,
  MonitorHistoryQueryOptions,
  MonitorHistoryRecord,
  MonitorHistoryReport,
  MonitorHistorySummary,
  MonitorIncidentTrend,
  MonitorSeverity,
  MonitorTargetTrendSummary,
} from '../../types/monitoring.js';
import { loadMonitorManifest } from './manifest.js';
import { defaultMonitorStatePath } from './runner.js';

const validationSummarySchema = z
  .object({
    total: z.number().int().min(0),
    required: z.number().int().min(0),
    optional: z.number().int().min(0),
    passed: z.number().int().min(0),
    failed: z.number().int().min(0),
    errors: z.number().int().min(0),
    requiredFailures: z.number().int().min(0),
    optionalFailures: z.number().int().min(0),
    success: z.boolean(),
  })
  .strict();

const historyRecordSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    monitorName: z.string(),
    targetId: z.string(),
    targetName: z.string(),
    checkedAt: z.string(),
    durationMs: z.number().int().min(0),
    healthy: z.boolean(),
    fingerprint: z.string(),
    errorCode: z.string().nullable(),
    eventType: z.enum(['none', 'opened', 'escalated', 'reminder', 'recovered', 'suppressed']),
    severity: z.enum(['warning', 'high', 'critical']).nullable(),
    incidentId: z.string().nullable(),
    validationSummary: validationSummarySchema.nullable(),
  })
  .strict();

const severityRank: Readonly<Record<MonitorSeverity, number>> = {
  warning: 1,
  high: 2,
  critical: 3,
};

export function defaultMonitorHistoryPath(config: ToolkitConfig, monitorName: string): string {
  return resolve(dirname(defaultMonitorStatePath(config, monitorName)), 'history.jsonl');
}

export function historyRecordsFromCycle(
  report: MonitorCycleReport,
): readonly MonitorHistoryRecord[] {
  return report.results.flatMap((result) => {
    if (!result.due || result.outcome === null) return [];
    const transition = result.transition;
    return [
      {
        schemaVersion: '1.0' as const,
        monitorName: report.monitorName,
        targetId: result.targetId,
        targetName: result.targetName,
        checkedAt: result.checkedAt,
        durationMs: result.durationMs,
        healthy: result.outcome.healthy,
        fingerprint: result.outcome.fingerprint,
        errorCode: result.outcome.errorCode,
        eventType: transition?.eventType ?? 'none',
        severity: transition?.currentSeverity ?? null,
        incidentId: transition?.incident?.id ?? null,
        validationSummary: result.outcome.validationSummary,
      },
    ];
  });
}

export async function appendMonitorHistory(
  path: string,
  records: readonly MonitorHistoryRecord[],
): Promise<string> {
  const historyPath = resolve(path);
  if (records.length === 0) return historyPath;
  try {
    await mkdir(dirname(historyPath), { recursive: true });
    const content = `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
    await appendFile(historyPath, content, { encoding: 'utf8', mode: 0o600 });
    return historyPath;
  } catch (error) {
    throw new MonitoringError(
      'MONITOR_HISTORY_WRITE_FAILED',
      `Could not append monitor history: ${historyPath}`,
      { cause: error, details: { path: historyPath } },
    );
  }
}

export async function loadMonitorHistory(path: string): Promise<readonly MonitorHistoryRecord[]> {
  const historyPath = resolve(path);
  let source: string;
  try {
    source = await readFile(historyPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new MonitoringError(
      'MONITOR_HISTORY_READ_FAILED',
      `Could not read monitor history: ${historyPath}`,
      { cause: error, details: { path: historyPath } },
    );
  }
  const records: MonitorHistoryRecord[] = [];
  const lines = source.split('\n');
  for (const [index, line] of lines.entries()) {
    if (line.trim() === '') continue;
    try {
      records.push(historyRecordSchema.parse(JSON.parse(line) as unknown));
    } catch (error) {
      throw new MonitoringError(
        'MONITOR_HISTORY_READ_FAILED',
        `Monitor history contains an invalid record at line ${index + 1}: ${historyPath}`,
        { cause: error, details: { path: historyPath, line: index + 1 } },
      );
    }
  }
  return records.sort((left, right) => Date.parse(left.checkedAt) - Date.parse(right.checkedAt));
}

function boundary(value: string | undefined, now: Date, fallback: Date): Date {
  if (value === undefined) return fallback;
  const relative = /^(\d+)(m|h|d|w)$/u.exec(value.trim().toLowerCase());
  if (relative !== null) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const multiplier =
      unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : unit === 'd' ? 86_400_000 : 604_800_000;
    return new Date(now.getTime() - amount * multiplier);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new MonitoringError(
      'MONITOR_HISTORY_QUERY_FAILED',
      `Invalid history boundary: ${value}. Use an ISO timestamp or duration such as 30d.`,
      { details: { value }, exitCode: 2 },
    );
  }
  return new Date(timestamp);
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100_000) / 1000;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(values: readonly number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[position] ?? null;
}

function peakSeverity(records: readonly MonitorHistoryRecord[]): MonitorSeverity {
  let result: MonitorSeverity = 'warning';
  for (const record of records) {
    if (record.severity !== null && severityRank[record.severity] > severityRank[result]) {
      result = record.severity;
    }
  }
  return result;
}

function incidentsForRecords(
  records: readonly MonitorHistoryRecord[],
  since: Date,
  until: Date,
): readonly MonitorIncidentTrend[] {
  const groups = new Map<string, MonitorHistoryRecord[]>();
  for (const record of records) {
    if (record.incidentId === null) continue;
    const group = groups.get(record.incidentId) ?? [];
    group.push(record);
    groups.set(record.incidentId, group);
  }
  return [...groups.entries()]
    .map(([incidentId, entries]) => {
      const ordered = [...entries].sort(
        (left, right) => Date.parse(left.checkedAt) - Date.parse(right.checkedAt),
      );
      const opened = ordered.find((entry) => entry.eventType === 'opened') ?? ordered[0];
      const recovered = ordered.find((entry) => entry.eventType === 'recovered');
      const openedAt = opened?.checkedAt ?? until.toISOString();
      const resolvedAt = recovered?.checkedAt ?? null;
      const originalStart = Date.parse(openedAt);
      const originalEnd = resolvedAt === null ? until.getTime() : Date.parse(resolvedAt);
      const clippedStart = Math.max(originalStart, since.getTime());
      const clippedEnd = Math.min(originalEnd, until.getTime());
      return {
        incidentId,
        targetId: opened?.targetId ?? '',
        openedAt,
        resolvedAt,
        durationMs: Math.max(0, clippedEnd - clippedStart),
        peakSeverity: peakSeverity(ordered),
        open: resolvedAt === null || originalEnd > until.getTime(),
      };
    })
    .filter((incident) => {
      const start = Date.parse(incident.openedAt);
      const end = incident.resolvedAt === null ? until.getTime() : Date.parse(incident.resolvedAt);
      return start <= until.getTime() && end >= since.getTime();
    })
    .sort((left, right) => Date.parse(left.openedAt) - Date.parse(right.openedAt));
}

function meanBetweenFailures(incidents: readonly MonitorIncidentTrend[]): number | null {
  const ordered = [...incidents].sort(
    (left, right) => Date.parse(left.openedAt) - Date.parse(right.openedAt),
  );
  const values: number[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (previous?.resolvedAt === null || previous === undefined || current === undefined) continue;
    values.push(Math.max(0, Date.parse(current.openedAt) - Date.parse(previous.resolvedAt)));
  }
  return average(values);
}

function targetSummary(
  targetId: string,
  targetName: string,
  records: readonly MonitorHistoryRecord[],
  incidents: readonly MonitorIncidentTrend[],
  windowDurationMs: number,
): MonitorTargetTrendSummary {
  const healthyChecks = records.filter((record) => record.healthy).length;
  const unhealthyChecks = records.length - healthyChecks;
  const resolved = incidents.filter((incident) => !incident.open);
  const open = incidents.filter((incident) => incident.open);
  const downtime = incidents.reduce((sum, incident) => sum + incident.durationMs, 0);
  const durations = records.map((record) => record.durationMs);
  return {
    targetId,
    targetName,
    checks: records.length,
    healthyChecks,
    unhealthyChecks,
    passRatePercent: percentage(healthyChecks, records.length),
    estimatedAvailabilityPercent:
      windowDurationMs <= 0
        ? null
        : percentage(
            Math.max(0, windowDurationMs - Math.min(windowDurationMs, downtime)),
            windowDurationMs,
          ),
    incidentCount: incidents.length,
    resolvedIncidentCount: resolved.length,
    openIncidentCount: open.length,
    meanTimeToRecoveryMs: average(resolved.map((incident) => incident.durationMs)),
    meanTimeBetweenFailuresMs: meanBetweenFailures(incidents),
    longestOutageMs:
      incidents.length === 0 ? null : Math.max(...incidents.map((incident) => incident.durationMs)),
    averageCheckDurationMs: average(durations),
    p50CheckDurationMs: percentile(durations, 50),
    p95CheckDurationMs: percentile(durations, 95),
    firstCheckedAt: records[0]?.checkedAt ?? null,
    lastCheckedAt: records.at(-1)?.checkedAt ?? null,
  };
}

function dailyTrends(records: readonly MonitorHistoryRecord[]): readonly MonitorDailyTrend[] {
  const buckets = new Map<string, MonitorHistoryRecord[]>();
  for (const record of records) {
    const date = record.checkedAt.slice(0, 10);
    const bucket = buckets.get(date) ?? [];
    bucket.push(record);
    buckets.set(date, bucket);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entries]) => {
      const healthyChecks = entries.filter((entry) => entry.healthy).length;
      return {
        date,
        checks: entries.length,
        healthyChecks,
        unhealthyChecks: entries.length - healthyChecks,
        passRatePercent: percentage(healthyChecks, entries.length),
        averageDurationMs: average(entries.map((entry) => entry.durationMs)),
        incidentEvents: entries.filter((entry) =>
          ['opened', 'escalated', 'recovered'].includes(entry.eventType),
        ).length,
      };
    });
}

function aggregateSummary(
  records: readonly MonitorHistoryRecord[],
  targets: readonly MonitorTargetTrendSummary[],
  incidents: readonly MonitorIncidentTrend[],
  windowDurationMs: number,
): MonitorHistorySummary {
  const healthyChecks = records.filter((record) => record.healthy).length;
  const resolved = incidents.filter((incident) => !incident.open);
  const targetTime = windowDurationMs * targets.length;
  const downtime = incidents.reduce((sum, incident) => sum + incident.durationMs, 0);
  return {
    recordCount: records.length,
    targetCount: targets.length,
    checks: records.length,
    healthyChecks,
    unhealthyChecks: records.length - healthyChecks,
    passRatePercent: percentage(healthyChecks, records.length),
    estimatedAvailabilityPercent:
      targetTime <= 0
        ? null
        : percentage(Math.max(0, targetTime - Math.min(targetTime, downtime)), targetTime),
    incidentCount: incidents.length,
    resolvedIncidentCount: resolved.length,
    openIncidentCount: incidents.length - resolved.length,
    meanTimeToRecoveryMs: average(resolved.map((incident) => incident.durationMs)),
    longestOutageMs:
      incidents.length === 0 ? null : Math.max(...incidents.map((incident) => incident.durationMs)),
    averageCheckDurationMs: average(records.map((record) => record.durationMs)),
  };
}

export async function buildMonitorHistoryReport(
  config: ToolkitConfig,
  monitorManifestPath: string,
  options: MonitorHistoryQueryOptions = {},
  now = new Date(),
): Promise<MonitorHistoryReport> {
  const loaded = await loadMonitorManifest(monitorManifestPath);
  const historyPath = resolve(
    options.historyFile ?? defaultMonitorHistoryPath(config, loaded.manifest.name),
  );
  const until = boundary(options.until, now, now);
  const since = boundary(options.since, now, new Date(until.getTime() - 30 * 86_400_000));
  if (since.getTime() >= until.getTime()) {
    throw new MonitoringError(
      'MONITOR_HISTORY_QUERY_FAILED',
      'History --since must be earlier than --until.',
      { details: { since: since.toISOString(), until: until.toISOString() }, exitCode: 2 },
    );
  }
  const targetIds = options.targetIds === undefined ? null : new Set(options.targetIds);
  const allRecords = (await loadMonitorHistory(historyPath)).filter(
    (record) =>
      record.monitorName === loaded.manifest.name &&
      Date.parse(record.checkedAt) <= until.getTime() &&
      (targetIds === null || targetIds.has(record.targetId)),
  );
  const records = allRecords.filter((record) => Date.parse(record.checkedAt) >= since.getTime());
  const incidents = incidentsForRecords(allRecords, since, until);
  const names = new Map(loaded.manifest.targets.map((target) => [target.id, target.name]));
  const grouped = new Map<string, MonitorHistoryRecord[]>();
  for (const record of records) {
    const group = grouped.get(record.targetId) ?? [];
    group.push(record);
    grouped.set(record.targetId, group);
  }
  const targetIdsInWindow = new Set([
    ...grouped.keys(),
    ...incidents.map((incident) => incident.targetId),
  ]);
  const targetSummaries = [...targetIdsInWindow]
    .map((targetId) => {
      const entries = grouped.get(targetId) ?? [];
      return targetSummary(
        targetId,
        entries.at(-1)?.targetName ?? names.get(targetId) ?? targetId,
        entries,
        incidents.filter((incident) => incident.targetId === targetId),
        until.getTime() - since.getTime(),
      );
    })
    .sort((left, right) => left.targetId.localeCompare(right.targetId));
  const artifactRun = await createArtifactRun(config, {
    command: options.command ?? 'monitor-history',
    name: options.name ?? loaded.manifest.name,
    now,
  });
  const reportPath = resolveArtifactPath(
    artifactRun,
    options.reportFile ?? 'reports/monitor-history.json',
  );
  const report: MonitorHistoryReport = {
    schemaVersion: '1.0',
    monitorName: loaded.manifest.name,
    generatedAt: now.toISOString(),
    manifestPath: loaded.sourcePath,
    historyPath,
    reportPath,
    artifactRun,
    window: {
      since: since.toISOString(),
      until: until.toISOString(),
      durationMs: until.getTime() - since.getTime(),
    },
    summary: aggregateSummary(
      records,
      targetSummaries,
      incidents,
      until.getTime() - since.getTime(),
    ),
    targets: targetSummaries,
    daily: dailyTrends(records),
    incidents,
  };
  await writeJsonArtifact(
    artifactRun,
    options.reportFile ?? 'reports/monitor-history.json',
    report,
  );
  return report;
}

export async function pruneMonitorHistory(
  config: ToolkitConfig,
  monitorManifestPath: string,
  options: MonitorHistoryPruneOptions,
  now = new Date(),
): Promise<MonitorHistoryPruneReport> {
  const loaded = await loadMonitorManifest(monitorManifestPath);
  const historyPath = resolve(
    options.historyFile ?? defaultMonitorHistoryPath(config, loaded.manifest.name),
  );
  const before = boundary(options.before, now, now);
  const records = await loadMonitorHistory(historyPath);
  const retained = records.filter((record) => Date.parse(record.checkedAt) >= before.getTime());
  const temporaryPath = `${historyPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await mkdir(dirname(historyPath), { recursive: true });
    await writeFile(
      temporaryPath,
      retained.length === 0
        ? ''
        : `${retained.map((record) => JSON.stringify(record)).join('\n')}\n`,
      { mode: 0o600 },
    );
    await rename(temporaryPath, historyPath);
  } catch (error) {
    throw new MonitoringError(
      'MONITOR_HISTORY_WRITE_FAILED',
      `Could not prune monitor history: ${historyPath}`,
      { cause: error, details: { path: historyPath } },
    );
  }
  return {
    historyPath,
    before: before.toISOString(),
    retained: retained.length,
    removed: records.length - retained.length,
  };
}
