import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendMonitorHistory,
  buildMonitorHistoryReport,
  historyRecordsFromCycle,
  loadMonitorHistory,
  pruneMonitorHistory,
} from '../src/core/monitoring/history.js';
import type { ToolkitConfig } from '../src/types/config.js';
import type { MonitorCycleReport, MonitorHistoryRecord } from '../src/types/monitoring.js';

async function fixture(): Promise<{
  readonly root: string;
  readonly config: ToolkitConfig;
  readonly manifestPath: string;
  readonly historyPath: string;
}> {
  const root = await mkdtemp(join(tmpdir(), 'selector-history-'));
  const manifestPath = join(root, 'monitor.yaml');
  const historyPath = join(root, 'history.jsonl');
  await writeFile(
    manifestPath,
    [
      'schemaVersion: "1.0"',
      'name: Production',
      'targets:',
      '  - id: login',
      '    name: Login',
      '    manifestPath: ./login.yaml',
      'notifications: []',
    ].join('\n'),
    'utf8',
  );
  return {
    root,
    manifestPath,
    historyPath,
    config: {
      cwd: root,
      artifactsDir: join(root, 'artifacts'),
      browser: 'chromium',
      headless: true,
      timeoutMs: 30_000,
      navigationTimeoutMs: 45_000,
      viewport: { width: 1280, height: 720 },
      trace: 'off',
      screenshots: 'off',
    },
  };
}

function record(
  input: Partial<MonitorHistoryRecord> & Pick<MonitorHistoryRecord, 'checkedAt' | 'healthy'>,
): MonitorHistoryRecord {
  return {
    schemaVersion: '1.0',
    monitorName: 'Production',
    targetId: 'login',
    targetName: 'Login',
    durationMs: 100,
    fingerprint: input.healthy ? 'healthy' : 'failed',
    errorCode: input.healthy ? null : 'SELECTOR_VALIDATION_FAILED',
    eventType: 'none',
    severity: null,
    incidentId: null,
    validationSummary: null,
    ...input,
  };
}

const day = 86_400_000;

describe('monitor history storage and trends', () => {
  it('appends and loads JSONL records in chronological order', async () => {
    const { historyPath } = await fixture();
    const later = record({ checkedAt: '2026-07-03T00:00:00.000Z', healthy: true });
    const earlier = record({ checkedAt: '2026-07-01T00:00:00.000Z', healthy: false });
    await appendMonitorHistory(historyPath, [later, earlier]);

    const loaded = await loadMonitorHistory(historyPath);
    expect(loaded.map((item) => item.checkedAt)).toEqual([
      '2026-07-01T00:00:00.000Z',
      '2026-07-03T00:00:00.000Z',
    ]);
  });

  it('converts due cycle results into privacy-bounded history records', () => {
    const cycle = {
      monitorName: 'Production',
      results: [
        {
          targetId: 'login',
          targetName: 'Login',
          due: true,
          checkedAt: '2026-07-01T00:00:00.000Z',
          durationMs: 250,
          outcome: {
            healthy: false,
            fingerprint: 'failure',
            message: 'Sensitive detail must not be persisted',
            validationSummary: null,
            errorCode: 'SELECTOR_VALIDATION_FAILED',
          },
          transition: {
            eventType: 'opened',
            previousSeverity: null,
            currentSeverity: 'warning',
            shouldNotify: true,
            incident: {
              id: 'incident-1',
              targetId: 'login',
              fingerprint: 'failure',
              status: 'open',
              severity: 'warning',
              openedAt: '2026-07-01T00:00:00.000Z',
              lastObservedAt: '2026-07-01T00:00:00.000Z',
              failureCount: 2,
              lastNotifiedAt: null,
              lastNotifiedSeverity: null,
              resolvedAt: null,
            },
            reason: 'opened',
          },
        },
      ],
    } as unknown as MonitorCycleReport;

    const [history] = historyRecordsFromCycle(cycle);
    expect(history).toMatchObject({
      targetId: 'login',
      eventType: 'opened',
      severity: 'warning',
      incidentId: 'incident-1',
    });
    expect(JSON.stringify(history)).not.toContain('Sensitive detail');
  });

  it('aggregates pass rate, availability, MTTR, MTBF, percentiles, daily trends, and incidents', async () => {
    const { config, manifestPath, historyPath } = await fixture();
    await appendMonitorHistory(historyPath, [
      record({ checkedAt: '2026-07-01T00:00:00.000Z', healthy: true, durationMs: 50 }),
      record({
        checkedAt: '2026-07-02T00:00:00.000Z',
        healthy: false,
        durationMs: 100,
        eventType: 'opened',
        severity: 'warning',
        incidentId: 'incident-1',
      }),
      record({
        checkedAt: '2026-07-03T00:00:00.000Z',
        healthy: false,
        durationMs: 150,
        eventType: 'escalated',
        severity: 'high',
        incidentId: 'incident-1',
      }),
      record({
        checkedAt: '2026-07-04T00:00:00.000Z',
        healthy: true,
        durationMs: 200,
        eventType: 'recovered',
        severity: 'high',
        incidentId: 'incident-1',
      }),
      record({
        checkedAt: '2026-07-06T00:00:00.000Z',
        healthy: false,
        durationMs: 250,
        eventType: 'opened',
        severity: 'warning',
        incidentId: 'incident-2',
      }),
      record({
        checkedAt: '2026-07-08T00:00:00.000Z',
        healthy: true,
        durationMs: 300,
        eventType: 'recovered',
        severity: 'warning',
        incidentId: 'incident-2',
      }),
    ]);

    const report = await buildMonitorHistoryReport(
      config,
      manifestPath,
      {
        historyFile: historyPath,
        since: '2026-07-01T00:00:00.000Z',
        until: '2026-07-10T00:00:00.000Z',
      },
      new Date('2026-07-10T00:00:00.000Z'),
    );

    expect(report.summary).toMatchObject({
      checks: 6,
      healthyChecks: 3,
      unhealthyChecks: 3,
      passRatePercent: 50,
      incidentCount: 2,
      resolvedIncidentCount: 2,
      openIncidentCount: 0,
      meanTimeToRecoveryMs: 2 * day,
      longestOutageMs: 2 * day,
      averageCheckDurationMs: 175,
    });
    expect(report.summary.estimatedAvailabilityPercent).toBeCloseTo(55.556, 3);
    expect(report.targets[0]).toMatchObject({
      meanTimeBetweenFailuresMs: 2 * day,
      p50CheckDurationMs: 150,
      p95CheckDurationMs: 300,
    });
    expect(report.daily).toHaveLength(6);
    expect(report.incidents.map((item) => item.peakSeverity)).toEqual(['high', 'warning']);
    await expect(readFile(report.reportPath, 'utf8')).resolves.toContain(
      'estimatedAvailabilityPercent',
    );
  });

  it('filters targets and relative windows', async () => {
    const { config, manifestPath, historyPath } = await fixture();
    await appendMonitorHistory(historyPath, [
      record({ checkedAt: '2026-06-01T00:00:00.000Z', healthy: false }),
      record({ checkedAt: '2026-07-09T00:00:00.000Z', healthy: true }),
      record({
        checkedAt: '2026-07-09T00:00:00.000Z',
        healthy: true,
        targetId: 'other',
        targetName: 'Other',
      }),
    ]);

    const report = await buildMonitorHistoryReport(
      config,
      manifestPath,
      { historyFile: historyPath, since: '7d', targetIds: ['login'] },
      new Date('2026-07-10T00:00:00.000Z'),
    );
    expect(report.summary.checks).toBe(1);
    expect(report.targets.map((item) => item.targetId)).toEqual(['login']);
  });

  it('prunes records older than an ISO or relative boundary', async () => {
    const { config, manifestPath, historyPath } = await fixture();
    await appendMonitorHistory(historyPath, [
      record({ checkedAt: '2026-06-01T00:00:00.000Z', healthy: true }),
      record({ checkedAt: '2026-07-09T00:00:00.000Z', healthy: true }),
    ]);
    const result = await pruneMonitorHistory(
      config,
      manifestPath,
      { historyFile: historyPath, before: '30d' },
      new Date('2026-07-10T00:00:00.000Z'),
    );
    expect(result).toMatchObject({ removed: 1, retained: 1 });
    await expect(loadMonitorHistory(historyPath)).resolves.toHaveLength(1);
  });

  it('clips incidents that began before the report window', async () => {
    const { config, manifestPath, historyPath } = await fixture();
    await appendMonitorHistory(historyPath, [
      record({
        checkedAt: '2026-06-29T00:00:00.000Z',
        healthy: false,
        eventType: 'opened',
        severity: 'warning',
        incidentId: 'cross-window',
      }),
      record({
        checkedAt: '2026-07-02T00:00:00.000Z',
        healthy: true,
        eventType: 'recovered',
        severity: 'warning',
        incidentId: 'cross-window',
      }),
    ]);
    const report = await buildMonitorHistoryReport(
      config,
      manifestPath,
      {
        historyFile: historyPath,
        since: '2026-07-01T00:00:00.000Z',
        until: '2026-07-03T00:00:00.000Z',
      },
      new Date('2026-07-03T00:00:00.000Z'),
    );
    expect(report.incidents[0]).toMatchObject({ durationMs: day, open: false });
    expect(report.summary.estimatedAvailabilityPercent).toBe(50);
  });

  it('rejects malformed history records and invalid query boundaries', async () => {
    const { config, manifestPath, historyPath } = await fixture();
    await writeFile(historyPath, '{not-json}\n', 'utf8');
    await expect(loadMonitorHistory(historyPath)).rejects.toMatchObject({
      code: 'MONITOR_HISTORY_READ_FAILED',
    });
    await writeFile(historyPath, '', 'utf8');
    await expect(
      buildMonitorHistoryReport(config, manifestPath, {
        historyFile: historyPath,
        since: 'not-a-date',
      }),
    ).rejects.toMatchObject({ code: 'MONITOR_HISTORY_QUERY_FAILED', exitCode: 2 });
  });
});
