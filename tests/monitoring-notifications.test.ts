import { describe, expect, it, vi } from 'vitest';
import {
  createMonitorNotification,
  createNotificationAdapter,
  deliverMonitorNotification,
} from '../src/core/monitoring/notifications.js';
import type { MonitorTarget, MonitorTransition } from '../src/types/monitoring.js';

const target: MonitorTarget = {
  id: 'login',
  name: 'Login page',
  manifestPath: '/tmp/login.yaml',
  intervalMs: 60_000,
  policy: {
    openAfterFailures: 1,
    recoverAfterSuccesses: 1,
    highAfterFailures: 2,
    criticalAfterFailures: 3,
    reminderIntervalMs: 60_000,
  },
  notificationAdapterIds: [],
};
const transition: MonitorTransition = {
  eventType: 'opened',
  previousSeverity: null,
  currentSeverity: 'warning',
  shouldNotify: true,
  incident: {
    id: 'inc-1',
    targetId: 'login',
    fingerprint: 'fp',
    status: 'open',
    severity: 'warning',
    openedAt: '2026-07-18T00:00:00.000Z',
    lastObservedAt: '2026-07-18T00:00:00.000Z',
    failureCount: 1,
    lastNotifiedAt: '2026-07-18T00:00:00.000Z',
    lastNotifiedSeverity: 'warning',
    resolvedAt: null,
  },
  reason: 'opened',
};

const notification = createMonitorNotification(
  'Production',
  target,
  transition,
  'selector missing',
  new Date('2026-07-18T00:00:00.000Z'),
)!;

describe('monitor notification adapters', () => {
  it('writes console notifications', async () => {
    let output = '';
    const adapter = createNotificationAdapter(
      {
        id: 'console',
        type: 'console',
        enabled: true,
        severities: ['warning'],
        notifyRecovery: true,
      },
      { writeOut: (value) => (output += value) },
    );
    expect(await adapter.send(notification)).toMatchObject({
      status: 'sent',
      adapterId: 'console',
    });
    expect(output).toContain('Login page');
  });

  it('posts a redaction-safe JSON webhook using an environment-provided URL', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 'provider-1' }), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const adapter = createNotificationAdapter(
      {
        id: 'hook',
        type: 'webhook',
        enabled: true,
        severities: ['warning'],
        notifyRecovery: true,
        urlEnv: 'HOOK_URL',
      },
      { env: { HOOK_URL: 'https://hooks.example.test/selector' }, fetcher },
    );
    expect(await adapter.send(notification)).toMatchObject({
      status: 'sent',
      providerId: 'provider-1',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://hooks.example.test/selector',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fails safely when provider environment variables are missing', async () => {
    const adapter = createNotificationAdapter(
      {
        id: 'email',
        type: 'sendgrid-email',
        enabled: true,
        severities: ['warning'],
        notifyRecovery: true,
        apiKeyEnv: 'SENDGRID_KEY',
        fromEnv: 'MAIL_FROM',
        toEnv: 'MAIL_TO',
      },
      { env: {} },
    );
    const result = await adapter.send(notification);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('SENDGRID_KEY');
  });

  it('uses Twilio REST endpoints without exposing credentials in the request body', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ input, ...(init === undefined ? {} : { init }) });
      return new Response(JSON.stringify({ sid: 'SM123' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    };
    const adapter = createNotificationAdapter(
      {
        id: 'sms',
        type: 'twilio-sms',
        enabled: true,
        severities: ['warning'],
        notifyRecovery: true,
        accountSidEnv: 'SID',
        authTokenEnv: 'TOKEN',
        fromEnv: 'FROM',
        toEnv: 'TO',
      },
      { env: { SID: 'AC123', TOKEN: 'secret', FROM: '+15550000001', TO: '+15550000002' }, fetcher },
    );
    expect(await adapter.send(notification)).toMatchObject({ status: 'sent', providerId: 'SM123' });
    const body = calls[0]?.init?.body;
    expect(body).toBeInstanceOf(URLSearchParams);
    if (!(body instanceof URLSearchParams)) throw new Error('Expected URLSearchParams body');
    expect(body.toString()).not.toContain('secret');
    expect(body.toString()).toContain('Body=');
  });

  it('filters adapters by target configuration', async () => {
    const sendOne = vi.fn(async () => ({
      adapterId: 'one',
      adapterType: 'console' as const,
      status: 'sent' as const,
      message: 'sent',
      providerId: null,
    }));
    const sendTwo = vi.fn(async () => ({
      adapterId: 'two',
      adapterType: 'console' as const,
      status: 'sent' as const,
      message: 'sent',
      providerId: null,
    }));
    const results = await deliverMonitorNotification(
      notification,
      { ...target, notificationAdapterIds: ['two'] },
      [
        { id: 'one', type: 'console', send: sendOne },
        { id: 'two', type: 'console', send: sendTwo },
      ],
    );
    expect(results).toHaveLength(1);
    expect(sendOne).not.toHaveBeenCalled();
    expect(sendTwo).toHaveBeenCalledOnce();
  });
});
