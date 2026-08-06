import { randomUUID } from 'node:crypto';
import type {
  MonitorEscalationPolicy,
  MonitorHealthOutcome,
  MonitorIncident,
  MonitorSeverity,
  MonitorTargetState,
  MonitorTransition,
} from '../../types/monitoring.js';
import { emptyTargetState } from './state.js';

const severityRank: Readonly<Record<MonitorSeverity, number>> = {
  warning: 1,
  high: 2,
  critical: 3,
};

function severityForFailures(count: number, policy: MonitorEscalationPolicy): MonitorSeverity {
  if (count >= policy.criticalAfterFailures) return 'critical';
  if (count >= policy.highAfterFailures) return 'high';
  return 'warning';
}

function elapsedMs(left: string | null, right: Date): number {
  if (left === null) return Number.POSITIVE_INFINITY;
  const value = Date.parse(left);
  return Number.isFinite(value) ? right.getTime() - value : Number.POSITIVE_INFINITY;
}

function resolvedIncident(incident: MonitorIncident, now: Date): MonitorIncident {
  return {
    ...incident,
    status: 'resolved',
    lastObservedAt: now.toISOString(),
    resolvedAt: now.toISOString(),
  };
}

export interface AdvanceIncidentOptions {
  readonly now?: Date;
  readonly incidentId?: () => string;
}

export interface AdvanceIncidentResult {
  readonly state: MonitorTargetState;
  readonly transition: MonitorTransition;
}

export function advanceMonitorTargetState(
  previous: MonitorTargetState | undefined,
  targetId: string,
  outcome: MonitorHealthOutcome,
  policy: MonitorEscalationPolicy,
  options: AdvanceIncidentOptions = {},
): AdvanceIncidentResult {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const current = previous ?? emptyTargetState(targetId);

  if (outcome.healthy) {
    const successes = current.consecutiveSuccesses + 1;
    if (current.activeIncident !== null && successes >= policy.recoverAfterSuccesses) {
      const resolved = resolvedIncident(current.activeIncident, now);
      return {
        state: {
          ...current,
          consecutiveFailures: 0,
          consecutiveSuccesses: successes,
          lastCheckedAt: nowIso,
          lastSuccessAt: nowIso,
          activeIncident: null,
          recentIncidents: [resolved, ...current.recentIncidents].slice(0, 100),
        },
        transition: {
          eventType: 'recovered',
          previousSeverity: current.activeIncident.severity,
          currentSeverity: current.activeIncident.severity,
          shouldNotify: true,
          incident: resolved,
          reason: `Recovered after ${successes} consecutive successful check(s).`,
        },
      };
    }
    return {
      state: {
        ...current,
        consecutiveFailures: 0,
        consecutiveSuccesses: successes,
        lastCheckedAt: nowIso,
        lastSuccessAt: nowIso,
      },
      transition: {
        eventType: 'none',
        previousSeverity: current.activeIncident?.severity ?? null,
        currentSeverity: current.activeIncident?.severity ?? null,
        shouldNotify: false,
        incident: current.activeIncident,
        reason:
          current.activeIncident === null
            ? 'Target is healthy.'
            : 'Recovery threshold not yet met.',
      },
    };
  }

  const failures = current.consecutiveFailures + 1;
  const severity = severityForFailures(failures, policy);
  if (current.activeIncident === null) {
    if (failures < policy.openAfterFailures) {
      return {
        state: {
          ...current,
          consecutiveFailures: failures,
          consecutiveSuccesses: 0,
          lastCheckedAt: nowIso,
          lastFailureAt: nowIso,
        },
        transition: {
          eventType: 'none',
          previousSeverity: null,
          currentSeverity: null,
          shouldNotify: false,
          incident: null,
          reason: `Failure ${failures} of ${policy.openAfterFailures} before incident opens.`,
        },
      };
    }
    const incident: MonitorIncident = {
      id: (options.incidentId ?? randomUUID)(),
      targetId,
      fingerprint: outcome.fingerprint,
      status: 'open',
      severity,
      openedAt: nowIso,
      lastObservedAt: nowIso,
      failureCount: failures,
      lastNotifiedAt: null,
      lastNotifiedSeverity: null,
      resolvedAt: null,
    };
    return {
      state: {
        ...current,
        consecutiveFailures: failures,
        consecutiveSuccesses: 0,
        lastCheckedAt: nowIso,
        lastFailureAt: nowIso,
        activeIncident: incident,
      },
      transition: {
        eventType: 'opened',
        previousSeverity: null,
        currentSeverity: severity,
        shouldNotify: true,
        incident,
        reason: `Incident opened after ${failures} consecutive failures.`,
      },
    };
  }

  const previousIncident = current.activeIncident;
  const severityIncreased = severityRank[severity] > severityRank[previousIncident.severity];
  const reminderDue = elapsedMs(previousIncident.lastNotifiedAt, now) >= policy.reminderIntervalMs;
  const eventType = severityIncreased ? 'escalated' : reminderDue ? 'reminder' : 'suppressed';
  const shouldNotify = eventType !== 'suppressed';
  const incident: MonitorIncident = {
    ...previousIncident,
    fingerprint: outcome.fingerprint,
    severity,
    lastObservedAt: nowIso,
    failureCount: failures,
    lastNotifiedAt: previousIncident.lastNotifiedAt,
    lastNotifiedSeverity: previousIncident.lastNotifiedSeverity,
  };
  return {
    state: {
      ...current,
      consecutiveFailures: failures,
      consecutiveSuccesses: 0,
      lastCheckedAt: nowIso,
      lastFailureAt: nowIso,
      activeIncident: incident,
    },
    transition: {
      eventType,
      previousSeverity: previousIncident.severity,
      currentSeverity: severity,
      shouldNotify,
      incident,
      reason: severityIncreased
        ? `Incident escalated from ${previousIncident.severity} to ${severity}.`
        : reminderDue
          ? `Reminder interval elapsed for unresolved ${severity} incident.`
          : 'Duplicate alert suppressed until escalation or reminder interval.',
    },
  };
}

export function monitorTargetIsDue(
  state: MonitorTargetState | undefined,
  intervalMs: number,
  now = new Date(),
): boolean {
  if (state?.lastCheckedAt === null || state?.lastCheckedAt === undefined) return true;
  const last = Date.parse(state.lastCheckedAt);
  return !Number.isFinite(last) || now.getTime() - last >= intervalMs;
}

export function recordMonitorNotificationAttempt(
  state: MonitorTargetState,
  severity: MonitorSeverity,
  now = new Date(),
  incidentId?: string,
): MonitorTargetState {
  const at = now.toISOString();
  if (
    state.activeIncident !== null &&
    (incidentId === undefined || state.activeIncident.id === incidentId)
  ) {
    return {
      ...state,
      activeIncident: {
        ...state.activeIncident,
        lastNotifiedAt: at,
        lastNotifiedSeverity: severity,
      },
    };
  }
  if (incidentId === undefined) return state;
  return {
    ...state,
    recentIncidents: state.recentIncidents.map((incident) =>
      incident.id === incidentId
        ? { ...incident, lastNotifiedAt: at, lastNotifiedSeverity: severity }
        : incident,
    ),
  };
}
