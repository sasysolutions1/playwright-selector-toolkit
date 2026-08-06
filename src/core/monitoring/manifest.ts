import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { MonitoringError } from '../../errors/toolkit-error.js';
import type { LoadedMonitorManifest, MonitorManifest } from '../../types/monitoring.js';
import { monitorManifestSchema } from './schema.js';

function describeIssues(
  issues: readonly { readonly path: PropertyKey[]; readonly message: string }[],
): string {
  return issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

export async function loadMonitorManifest(path: string): Promise<LoadedMonitorManifest> {
  const sourcePath = resolve(path);
  let source: string;
  try {
    source = await readFile(sourcePath, 'utf8');
  } catch (error) {
    throw new MonitoringError(
      'MONITOR_MANIFEST_READ_FAILED',
      `Could not read monitor manifest: ${sourcePath}`,
      {
        cause: error,
        details: { path: sourcePath },
        exitCode: 2,
      },
    );
  }

  let raw: unknown;
  try {
    raw = extname(sourcePath).toLowerCase() === '.json' ? JSON.parse(source) : parseYaml(source);
  } catch (error) {
    throw new MonitoringError(
      'MONITOR_MANIFEST_PARSE_FAILED',
      `Could not parse monitor manifest: ${sourcePath}`,
      {
        cause: error,
        details: { path: sourcePath },
        exitCode: 2,
      },
    );
  }

  const parsed = monitorManifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MonitoringError(
      'MONITOR_MANIFEST_INVALID',
      `Monitor manifest is invalid: ${describeIssues(parsed.error.issues)}`,
      { details: { path: sourcePath, issues: parsed.error.issues }, exitCode: 2 },
    );
  }

  const root = dirname(sourcePath);
  const manifest: MonitorManifest = {
    schemaVersion: parsed.data.schemaVersion,
    name: parsed.data.name,
    pollIntervalMs: parsed.data.pollIntervalMs,
    targets: parsed.data.targets.map((target) => ({
      id: target.id,
      name: target.name,
      manifestPath: resolve(root, target.manifestPath),
      ...(target.url === undefined ? {} : { url: target.url }),
      intervalMs: target.intervalMs,
      policy: target.policy,
      notificationAdapterIds: target.notificationAdapterIds,
    })),
    notifications: parsed.data.notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      enabled: notification.enabled,
      severities: notification.severities,
      notifyRecovery: notification.notifyRecovery,
      ...(notification.urlEnv === undefined ? {} : { urlEnv: notification.urlEnv }),
      ...(notification.apiKeyEnv === undefined ? {} : { apiKeyEnv: notification.apiKeyEnv }),
      ...(notification.accountSidEnv === undefined
        ? {}
        : { accountSidEnv: notification.accountSidEnv }),
      ...(notification.authTokenEnv === undefined
        ? {}
        : { authTokenEnv: notification.authTokenEnv }),
      ...(notification.fromEnv === undefined ? {} : { fromEnv: notification.fromEnv }),
      ...(notification.toEnv === undefined ? {} : { toEnv: notification.toEnv }),
    })),
  };
  return { sourcePath, manifest };
}
