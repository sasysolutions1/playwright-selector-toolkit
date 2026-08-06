import type { ArtifactRun } from './artifacts.js';
import type { SelectorValidationSummary } from './validation.js';

export type MonitorSeverity = 'warning' | 'high' | 'critical';
export type MonitorIncidentStatus = 'open' | 'resolved';
export type MonitorEventType =
  'none' | 'opened' | 'escalated' | 'reminder' | 'recovered' | 'suppressed';
export type MonitorNotificationAdapterType =
  'console' | 'webhook' | 'sendgrid-email' | 'twilio-sms' | 'twilio-voice';

export interface MonitorEscalationPolicy {
  readonly openAfterFailures: number;
  readonly recoverAfterSuccesses: number;
  readonly highAfterFailures: number;
  readonly criticalAfterFailures: number;
  readonly reminderIntervalMs: number;
}

export interface MonitorTarget {
  readonly id: string;
  readonly name: string;
  readonly manifestPath: string;
  readonly url?: string;
  readonly intervalMs: number;
  readonly policy: MonitorEscalationPolicy;
  readonly notificationAdapterIds: readonly string[];
}

export interface MonitorNotificationAdapterConfig {
  readonly id: string;
  readonly type: MonitorNotificationAdapterType;
  readonly enabled: boolean;
  readonly severities: readonly MonitorSeverity[];
  readonly notifyRecovery: boolean;
  readonly urlEnv?: string;
  readonly apiKeyEnv?: string;
  readonly accountSidEnv?: string;
  readonly authTokenEnv?: string;
  readonly fromEnv?: string;
  readonly toEnv?: string;
}

export interface MonitorManifest {
  readonly schemaVersion: '1.0';
  readonly name: string;
  readonly pollIntervalMs: number;
  readonly targets: readonly MonitorTarget[];
  readonly notifications: readonly MonitorNotificationAdapterConfig[];
}

export interface LoadedMonitorManifest {
  readonly sourcePath: string;
  readonly manifest: MonitorManifest;
}

export interface MonitorIncident {
  readonly id: string;
  readonly targetId: string;
  readonly fingerprint: string;
  readonly status: MonitorIncidentStatus;
  readonly severity: MonitorSeverity;
  readonly openedAt: string;
  readonly lastObservedAt: string;
  readonly failureCount: number;
  readonly lastNotifiedAt: string | null;
  readonly lastNotifiedSeverity: MonitorSeverity | null;
  readonly resolvedAt: string | null;
}

export interface MonitorTargetState {
  readonly targetId: string;
  readonly consecutiveFailures: number;
  readonly consecutiveSuccesses: number;
  readonly lastCheckedAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly activeIncident: MonitorIncident | null;
  readonly recentIncidents: readonly MonitorIncident[];
}

export interface MonitorState {
  readonly schemaVersion: '1.0';
  readonly monitorName: string;
  readonly updatedAt: string;
  readonly targets: Readonly<Record<string, MonitorTargetState>>;
}

export interface MonitorHealthOutcome {
  readonly healthy: boolean;
  readonly fingerprint: string;
  readonly message: string;
  readonly validationSummary: SelectorValidationSummary | null;
  readonly errorCode: string | null;
}

export interface MonitorTransition {
  readonly eventType: MonitorEventType;
  readonly previousSeverity: MonitorSeverity | null;
  readonly currentSeverity: MonitorSeverity | null;
  readonly shouldNotify: boolean;
  readonly incident: MonitorIncident | null;
  readonly reason: string;
}

export interface MonitorNotification {
  readonly eventType: Exclude<MonitorEventType, 'none' | 'suppressed'>;
  readonly severity: MonitorSeverity;
  readonly monitorName: string;
  readonly targetId: string;
  readonly targetName: string;
  readonly incidentId: string;
  readonly title: string;
  readonly text: string;
  readonly occurredAt: string;
  readonly fingerprint: string;
}

export type MonitorNotificationStatus = 'sent' | 'skipped' | 'failed';

export interface MonitorNotificationResult {
  readonly adapterId: string;
  readonly adapterType: MonitorNotificationAdapterType;
  readonly status: MonitorNotificationStatus;
  readonly message: string;
  readonly providerId: string | null;
}

export interface MonitorTargetRunResult {
  readonly targetId: string;
  readonly targetName: string;
  readonly due: boolean;
  readonly checkedAt: string;
  readonly durationMs: number;
  readonly outcome: MonitorHealthOutcome | null;
  readonly transition: MonitorTransition | null;
  readonly notifications: readonly MonitorNotificationResult[];
  readonly validationReportPath: string | null;
}

export interface MonitorCycleSummary {
  readonly targetCount: number;
  readonly checkedCount: number;
  readonly skippedCount: number;
  readonly healthyCount: number;
  readonly unhealthyCount: number;
  readonly openIncidentCount: number;
  readonly notificationsSent: number;
  readonly notificationsFailed: number;
  readonly success: boolean;
}

export interface MonitorCycleReport {
  readonly schemaVersion: '1.0';
  readonly monitorName: string;
  readonly generatedAt: string;
  readonly manifestPath: string;
  readonly statePath: string;
  readonly reportPath: string;
  readonly historyPath: string | null;
  readonly artifactRun: ArtifactRun;
  readonly summary: MonitorCycleSummary;
  readonly results: readonly MonitorTargetRunResult[];
}

export interface MonitorHistoryRecord {
  readonly schemaVersion: '1.0';
  readonly monitorName: string;
  readonly targetId: string;
  readonly targetName: string;
  readonly checkedAt: string;
  readonly durationMs: number;
  readonly healthy: boolean;
  readonly fingerprint: string;
  readonly errorCode: string | null;
  readonly eventType: MonitorEventType;
  readonly severity: MonitorSeverity | null;
  readonly incidentId: string | null;
  readonly validationSummary: SelectorValidationSummary | null;
}

export interface MonitorHistoryWindow {
  readonly since: string;
  readonly until: string;
  readonly durationMs: number;
}

export interface MonitorDailyTrend {
  readonly date: string;
  readonly checks: number;
  readonly healthyChecks: number;
  readonly unhealthyChecks: number;
  readonly passRatePercent: number | null;
  readonly averageDurationMs: number | null;
  readonly incidentEvents: number;
}

export interface MonitorIncidentTrend {
  readonly incidentId: string;
  readonly targetId: string;
  readonly openedAt: string;
  readonly resolvedAt: string | null;
  readonly durationMs: number;
  readonly peakSeverity: MonitorSeverity;
  readonly open: boolean;
}

export interface MonitorTargetTrendSummary {
  readonly targetId: string;
  readonly targetName: string;
  readonly checks: number;
  readonly healthyChecks: number;
  readonly unhealthyChecks: number;
  readonly passRatePercent: number | null;
  readonly estimatedAvailabilityPercent: number | null;
  readonly incidentCount: number;
  readonly resolvedIncidentCount: number;
  readonly openIncidentCount: number;
  readonly meanTimeToRecoveryMs: number | null;
  readonly meanTimeBetweenFailuresMs: number | null;
  readonly longestOutageMs: number | null;
  readonly averageCheckDurationMs: number | null;
  readonly p50CheckDurationMs: number | null;
  readonly p95CheckDurationMs: number | null;
  readonly firstCheckedAt: string | null;
  readonly lastCheckedAt: string | null;
}

export interface MonitorHistorySummary {
  readonly recordCount: number;
  readonly targetCount: number;
  readonly checks: number;
  readonly healthyChecks: number;
  readonly unhealthyChecks: number;
  readonly passRatePercent: number | null;
  readonly estimatedAvailabilityPercent: number | null;
  readonly incidentCount: number;
  readonly resolvedIncidentCount: number;
  readonly openIncidentCount: number;
  readonly meanTimeToRecoveryMs: number | null;
  readonly longestOutageMs: number | null;
  readonly averageCheckDurationMs: number | null;
}

export interface MonitorHistoryReport {
  readonly schemaVersion: '1.0';
  readonly monitorName: string;
  readonly generatedAt: string;
  readonly manifestPath: string;
  readonly historyPath: string;
  readonly reportPath: string;
  readonly artifactRun: ArtifactRun;
  readonly window: MonitorHistoryWindow;
  readonly summary: MonitorHistorySummary;
  readonly targets: readonly MonitorTargetTrendSummary[];
  readonly daily: readonly MonitorDailyTrend[];
  readonly incidents: readonly MonitorIncidentTrend[];
}

export interface MonitorHistoryQueryOptions {
  readonly command?: string;
  readonly name?: string;
  readonly historyFile?: string;
  readonly reportFile?: string;
  readonly since?: string;
  readonly until?: string;
  readonly targetIds?: readonly string[];
}

export interface MonitorHistoryPruneOptions {
  readonly historyFile?: string;
  readonly before: string;
}

export interface MonitorHistoryPruneReport {
  readonly historyPath: string;
  readonly before: string;
  readonly retained: number;
  readonly removed: number;
}

export interface MonitorRunOptions {
  readonly command?: string;
  readonly name?: string;
  readonly stateFile?: string;
  readonly reportFile?: string;
  readonly force?: boolean;
  readonly notify?: boolean;
  readonly failOnUnhealthy?: boolean;
  readonly historyFile?: string;
  readonly recordHistory?: boolean;
}

export interface MonitorWatchOptions extends MonitorRunOptions {
  readonly pollIntervalMs?: number;
  readonly maxCycles?: number;
  readonly signal?: AbortSignal;
}

export interface MonitorWatchReport {
  readonly startedAt: string;
  readonly stoppedAt: string;
  readonly cycles: number;
  readonly lastCycle: MonitorCycleReport | null;
}
