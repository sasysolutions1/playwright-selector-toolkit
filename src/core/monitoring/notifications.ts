import type {
  MonitorNotification,
  MonitorNotificationAdapterConfig,
  MonitorNotificationResult,
  MonitorTarget,
  MonitorTransition,
} from '../../types/monitoring.js';

export interface MonitorNotificationAdapter {
  readonly id: string;
  readonly type: MonitorNotificationAdapterConfig['type'];
  send(notification: MonitorNotification): Promise<MonitorNotificationResult>;
}

export interface NotificationAdapterDependencies {
  readonly env?: NodeJS.ProcessEnv;
  readonly fetcher?: typeof fetch;
  readonly writeOut?: (value: string) => void;
}

function requiredEnvironment(
  env: NodeJS.ProcessEnv,
  name: string | undefined,
):
  { readonly ok: true; readonly value: string } | { readonly ok: false; readonly message: string } {
  if (name === undefined)
    return { ok: false, message: 'Environment variable name is not configured.' };
  const value = env[name];
  return value === undefined || value.trim() === ''
    ? { ok: false, message: `Required environment variable ${name} is not set.` }
    : { ok: true, value };
}

function result(
  config: MonitorNotificationAdapterConfig,
  status: MonitorNotificationResult['status'],
  message: string,
  providerId: string | null = null,
): MonitorNotificationResult {
  return { adapterId: config.id, adapterType: config.type, status, message, providerId };
}

function encodeBasic(username: string, password: string): string {
  return Buffer.from(`${username}:${password}`).toString('base64');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function parseProviderId(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) return null;
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const value = body.id ?? body.sid ?? body.message_id;
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function createMonitorNotification(
  monitorName: string,
  target: MonitorTarget,
  transition: MonitorTransition,
  message: string,
  now = new Date(),
): MonitorNotification | null {
  const incident = transition.incident;
  if (
    incident === null ||
    transition.eventType === 'none' ||
    transition.eventType === 'suppressed' ||
    transition.currentSeverity === null
  ) {
    return null;
  }
  const recovered = transition.eventType === 'recovered';
  const title = recovered
    ? `[RESOLVED] ${target.name}`
    : `[${transition.currentSeverity.toUpperCase()}] ${target.name}`;
  return {
    eventType: transition.eventType,
    severity: transition.currentSeverity,
    monitorName,
    targetId: target.id,
    targetName: target.name,
    incidentId: incident.id,
    title,
    text: [
      title,
      `Monitor: ${monitorName}`,
      `Target: ${target.name} (${target.id})`,
      `Incident: ${incident.id}`,
      `Event: ${transition.eventType}`,
      `Severity: ${transition.currentSeverity}`,
      `Observed: ${message}`,
      `Time: ${now.toISOString()}`,
    ].join('\n'),
    occurredAt: now.toISOString(),
    fingerprint: incident.fingerprint,
  };
}

export function createNotificationAdapter(
  config: MonitorNotificationAdapterConfig,
  dependencies: NotificationAdapterDependencies = {},
): MonitorNotificationAdapter {
  const env = dependencies.env ?? process.env;
  const fetcher = dependencies.fetcher ?? fetch;
  const writeOut = dependencies.writeOut ?? ((value: string) => process.stdout.write(value));

  return {
    id: config.id,
    type: config.type,
    async send(notification): Promise<MonitorNotificationResult> {
      if (!config.enabled) return result(config, 'skipped', 'Adapter is disabled.');
      if (notification.eventType === 'recovered' && !config.notifyRecovery) {
        return result(config, 'skipped', 'Recovery notifications are disabled for this adapter.');
      }
      if (
        notification.eventType !== 'recovered' &&
        !config.severities.includes(notification.severity)
      ) {
        return result(config, 'skipped', `Severity ${notification.severity} is not enabled.`);
      }
      try {
        if (config.type === 'console') {
          writeOut(`${notification.text}\n`);
          return result(config, 'sent', 'Notification written to console.');
        }
        if (config.type === 'webhook') {
          const url = requiredEnvironment(env, config.urlEnv);
          if (!url.ok) return result(config, 'failed', url.message);
          const response = await fetcher(url.value, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'user-agent': 'playwright-selector-toolkit/monitor',
            },
            body: JSON.stringify(notification),
            signal: AbortSignal.timeout(15_000),
          });
          return response.ok
            ? result(
                config,
                'sent',
                `Webhook accepted with HTTP ${response.status}.`,
                await parseProviderId(response),
              )
            : result(config, 'failed', `Webhook returned HTTP ${response.status}.`);
        }
        if (config.type === 'sendgrid-email') {
          const apiKey = requiredEnvironment(env, config.apiKeyEnv);
          const from = requiredEnvironment(env, config.fromEnv);
          const to = requiredEnvironment(env, config.toEnv);
          if (!apiKey.ok) return result(config, 'failed', apiKey.message);
          if (!from.ok) return result(config, 'failed', from.message);
          if (!to.ok) return result(config, 'failed', to.message);
          const response = await fetcher('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${apiKey.value}`,
              'content-type': 'application/json',
              'user-agent': 'playwright-selector-toolkit/monitor',
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: to.value }] }],
              from: { email: from.value },
              subject: notification.title,
              content: [{ type: 'text/plain', value: notification.text }],
              custom_args: { incidentId: notification.incidentId, targetId: notification.targetId },
            }),
            signal: AbortSignal.timeout(15_000),
          });
          return response.ok
            ? result(
                config,
                'sent',
                `SendGrid accepted with HTTP ${response.status}.`,
                response.headers.get('x-message-id'),
              )
            : result(config, 'failed', `SendGrid returned HTTP ${response.status}.`);
        }

        const accountSid = requiredEnvironment(env, config.accountSidEnv);
        const authToken = requiredEnvironment(env, config.authTokenEnv);
        const from = requiredEnvironment(env, config.fromEnv);
        const to = requiredEnvironment(env, config.toEnv);
        if (!accountSid.ok) return result(config, 'failed', accountSid.message);
        if (!authToken.ok) return result(config, 'failed', authToken.message);
        if (!from.ok) return result(config, 'failed', from.message);
        if (!to.ok) return result(config, 'failed', to.message);
        const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid.value)}/${
          config.type === 'twilio-sms' ? 'Messages.json' : 'Calls.json'
        }`;
        const form = new URLSearchParams({ From: from.value, To: to.value });
        if (config.type === 'twilio-sms') {
          form.set('Body', notification.text.slice(0, 1500));
        } else {
          form.set(
            'Twiml',
            `<Response><Say>${escapeXml(notification.text.slice(0, 1200))}</Say></Response>`,
          );
        }
        const response = await fetcher(endpoint, {
          method: 'POST',
          headers: {
            authorization: `Basic ${encodeBasic(accountSid.value, authToken.value)}`,
            'content-type': 'application/x-www-form-urlencoded',
            'user-agent': 'playwright-selector-toolkit/monitor',
          },
          body: form,
          signal: AbortSignal.timeout(15_000),
        });
        return response.ok
          ? result(
              config,
              'sent',
              `Twilio accepted with HTTP ${response.status}.`,
              await parseProviderId(response),
            )
          : result(config, 'failed', `Twilio returned HTTP ${response.status}.`);
      } catch (error) {
        return result(config, 'failed', error instanceof Error ? error.message : String(error));
      }
    },
  };
}

export async function deliverMonitorNotification(
  notification: MonitorNotification,
  target: MonitorTarget,
  adapters: readonly MonitorNotificationAdapter[],
): Promise<readonly MonitorNotificationResult[]> {
  const selected =
    target.notificationAdapterIds.length === 0
      ? adapters
      : adapters.filter((adapter) => target.notificationAdapterIds.includes(adapter.id));
  return Promise.all(selected.map(async (adapter) => adapter.send(notification)));
}
