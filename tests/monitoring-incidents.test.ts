import { describe, expect, it } from 'vitest';
import {
  advanceMonitorTargetState,
  monitorTargetIsDue,
  recordMonitorNotificationAttempt,
} from '../src/core/monitoring/incidents.js';
import { emptyTargetState } from '../src/core/monitoring/state.js';
import type { MonitorEscalationPolicy, MonitorHealthOutcome } from '../src/types/monitoring.js';

const policy: MonitorEscalationPolicy = {
  openAfterFailures: 2,
  recoverAfterSuccesses: 1,
  highAfterFailures: 3,
  criticalAfterFailures: 5,
  reminderIntervalMs: 60_000,
};
const failed: MonitorHealthOutcome = {
  healthy: false,
  fingerprint: 'fingerprint',
  message: 'required selector missing',
  validationSummary: null,
  errorCode: 'SELECTOR_VALIDATION_FAILED',
};
const healthy: MonitorHealthOutcome = {
  healthy: true,
  fingerprint: 'healthy',
  message: 'passed',
  validationSummary: null,
  errorCode: null,
};

function at(minute: number): Date {
  return new Date(`2026-07-18T00:${String(minute).padStart(2, '0')}:00.000Z`);
}

describe('monitor incident state machine', () => {
  it('waits for the configured consecutive failure threshold before opening an incident', () => {
    const first = advanceMonitorTargetState(undefined, 'login', failed, policy, {
      now: at(0),
      incidentId: () => 'inc-1',
    });
    expect(first.transition.eventType).toBe('none');
    const second = advanceMonitorTargetState(first.state, 'login', failed, policy, {
      now: at(1),
      incidentId: () => 'inc-1',
    });
    expect(second.transition).toMatchObject({
      eventType: 'opened',
      currentSeverity: 'warning',
      shouldNotify: true,
    });
    expect(second.state.activeIncident?.id).toBe('inc-1');
  });

  it('suppresses duplicate alerts until severity changes or the reminder interval elapses', () => {
    const first = advanceMonitorTargetState(
      undefined,
      'login',
      failed,
      { ...policy, openAfterFailures: 1 },
      { now: at(0), incidentId: () => 'inc-1' },
    );
    const notified = recordMonitorNotificationAttempt(first.state, 'warning', at(0), 'inc-1');
    const suppressed = advanceMonitorTargetState(notified, 'login', failed, policy, {
      now: new Date('2026-07-18T00:00:30.000Z'),
    });
    expect(suppressed.transition.eventType).toBe('suppressed');
    const escalated = advanceMonitorTargetState(suppressed.state, 'login', failed, policy, {
      now: at(1),
    });
    expect(escalated.transition).toMatchObject({
      eventType: 'escalated',
      currentSeverity: 'high',
      shouldNotify: true,
    });
    const reminded = advanceMonitorTargetState(
      escalated.state,
      'login',
      failed,
      { ...policy, criticalAfterFailures: 99 },
      { now: at(2) },
    );
    expect(reminded.transition.eventType).toBe('reminder');
  });

  it('escalates to critical and sends one recovery transition after success', () => {
    let state = emptyTargetState('login');
    let latest = advanceMonitorTargetState(
      state,
      'login',
      failed,
      { ...policy, openAfterFailures: 1 },
      { now: at(0), incidentId: () => 'inc-1' },
    );
    state = latest.state;
    for (let minute = 1; minute <= 4; minute += 1) {
      latest = advanceMonitorTargetState(state, 'login', failed, policy, { now: at(minute) });
      state = latest.state;
    }
    expect(state.activeIncident?.severity).toBe('critical');
    const recovered = advanceMonitorTargetState(state, 'login', healthy, policy, { now: at(5) });
    expect(recovered.transition.eventType).toBe('recovered');
    expect(recovered.state.activeIncident).toBeNull();
    expect(recovered.state.recentIncidents[0]).toMatchObject({
      status: 'resolved',
      resolvedAt: at(5).toISOString(),
    });
  });

  it('checks interval due state safely', () => {
    expect(monitorTargetIsDue(undefined, 60_000, at(0))).toBe(true);
    expect(
      monitorTargetIsDue(
        { ...emptyTargetState('login'), lastCheckedAt: at(0).toISOString() },
        60_000,
        new Date('2026-07-18T00:00:30.000Z'),
      ),
    ).toBe(false);
    expect(
      monitorTargetIsDue(
        { ...emptyTargetState('login'), lastCheckedAt: at(0).toISOString() },
        60_000,
        at(1),
      ),
    ).toBe(true);
  });
});
