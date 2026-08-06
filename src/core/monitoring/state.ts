import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { MonitoringError } from '../../errors/toolkit-error.js';
import type { MonitorState, MonitorTargetState } from '../../types/monitoring.js';

const severitySchema = z.enum(['warning', 'high', 'critical']);
const incidentSchema = z
  .object({
    id: z.string(),
    targetId: z.string(),
    fingerprint: z.string(),
    status: z.enum(['open', 'resolved']),
    severity: severitySchema,
    openedAt: z.string(),
    lastObservedAt: z.string(),
    failureCount: z.number().int().min(1),
    lastNotifiedAt: z.string().nullable(),
    lastNotifiedSeverity: severitySchema.nullable(),
    resolvedAt: z.string().nullable(),
  })
  .strict();
const targetStateSchema = z
  .object({
    targetId: z.string(),
    consecutiveFailures: z.number().int().min(0),
    consecutiveSuccesses: z.number().int().min(0),
    lastCheckedAt: z.string().nullable(),
    lastSuccessAt: z.string().nullable(),
    lastFailureAt: z.string().nullable(),
    activeIncident: incidentSchema.nullable(),
    recentIncidents: z.array(incidentSchema).max(100),
  })
  .strict();
const monitorStateSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    monitorName: z.string(),
    updatedAt: z.string(),
    targets: z.record(z.string(), targetStateSchema),
  })
  .strict();

export function emptyTargetState(targetId: string): MonitorTargetState {
  return {
    targetId,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    activeIncident: null,
    recentIncidents: [],
  };
}

export function createEmptyMonitorState(monitorName: string, now = new Date()): MonitorState {
  return {
    schemaVersion: '1.0',
    monitorName,
    updatedAt: now.toISOString(),
    targets: {},
  };
}

export async function loadMonitorState(
  path: string,
  monitorName: string,
  now = new Date(),
): Promise<MonitorState> {
  const statePath = resolve(path);
  let source: string;
  try {
    source = await readFile(statePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return createEmptyMonitorState(monitorName, now);
    throw new MonitoringError(
      'MONITOR_STATE_READ_FAILED',
      `Could not read monitor state: ${statePath}`,
      {
        cause: error,
        details: { path: statePath },
      },
    );
  }
  try {
    const parsed = monitorStateSchema.parse(JSON.parse(source));
    if (parsed.monitorName !== monitorName) {
      throw new Error(`state belongs to monitor ${parsed.monitorName}`);
    }
    return parsed;
  } catch (error) {
    throw new MonitoringError(
      'MONITOR_STATE_READ_FAILED',
      `Monitor state is invalid: ${statePath}`,
      {
        cause: error,
        details: { path: statePath },
      },
    );
  }
}

export async function saveMonitorState(path: string, state: MonitorState): Promise<string> {
  const statePath = resolve(path);
  const temporaryPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, statePath);
    return statePath;
  } catch (error) {
    throw new MonitoringError(
      'MONITOR_STATE_WRITE_FAILED',
      `Could not write monitor state: ${statePath}`,
      {
        cause: error,
        details: { path: statePath },
      },
    );
  }
}
