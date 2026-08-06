import { describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import type { ResolvedToolkitConfig } from '../src/types/config.js';
import type { MonitorHistoryPruneReport, MonitorHistoryReport } from '../src/types/monitoring.js';

const resolvedConfig: ResolvedToolkitConfig = {
  config: {
    cwd: '/tmp',
    artifactsDir: '/tmp/artifacts',
    browser: 'chromium',
    headless: true,
    timeoutMs: 30_000,
    navigationTimeoutMs: 45_000,
    viewport: { width: 1280, height: 720 },
    trace: 'off',
    screenshots: 'off',
  },
  sources: { configFile: null, environmentVariables: [], cliOptions: [] },
};

const artifactRun = {
  id: 'history',
  command: 'monitor-history',
  createdAt: '2026-07-18T00:00:00.000Z',
  directories: {
    root: '/tmp',
    run: '/tmp/run',
    screenshots: '/tmp/run/screenshots',
    snapshots: '/tmp/run/snapshots',
    traces: '/tmp/run/traces',
    reports: '/tmp/run/reports',
  },
  metadataPath: '/tmp/run/run.json',
} as const;

const history: MonitorHistoryReport = {
  schemaVersion: '1.0',
  monitorName: 'Production',
  generatedAt: '2026-07-18T00:00:00.000Z',
  manifestPath: '/tmp/monitor.yaml',
  historyPath: '/tmp/history.jsonl',
  reportPath: '/tmp/run/reports/monitor-history.json',
  artifactRun,
  window: {
    since: '2026-07-01T00:00:00.000Z',
    until: '2026-07-18T00:00:00.000Z',
    durationMs: 17 * 86_400_000,
  },
  summary: {
    recordCount: 10,
    targetCount: 1,
    checks: 10,
    healthyChecks: 9,
    unhealthyChecks: 1,
    passRatePercent: 90,
    estimatedAvailabilityPercent: 99,
    incidentCount: 1,
    resolvedIncidentCount: 1,
    openIncidentCount: 0,
    meanTimeToRecoveryMs: 60_000,
    longestOutageMs: 60_000,
    averageCheckDurationMs: 100,
  },
  targets: [],
  daily: [],
  incidents: [],
};

const pruned: MonitorHistoryPruneReport = {
  historyPath: '/tmp/history.jsonl',
  before: '2026-06-18T00:00:00.000Z',
  retained: 10,
  removed: 4,
};

describe('monitor history CLI', () => {
  it('passes history query options and emits JSON', async () => {
    let output = '';
    const builder = vi.fn(async () => history);
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      monitorHistoryBuilder: builder,
      writeOut: (value) => (output += value),
    });
    await program.parseAsync([
      'node',
      'selector',
      '--json',
      'monitor',
      'history',
      '/tmp/monitor.yaml',
      '--history-file',
      '/tmp/custom.jsonl',
      '--since',
      '7d',
      '--until',
      '2026-07-18T00:00:00.000Z',
      '--target',
      'login',
      '--target',
      'checkout',
    ]);
    expect(builder).toHaveBeenCalledWith(
      resolvedConfig.config,
      '/tmp/monitor.yaml',
      expect.objectContaining({
        historyFile: '/tmp/custom.jsonl',
        since: '7d',
        until: '2026-07-18T00:00:00.000Z',
        targetIds: ['login', 'checkout'],
      }),
    );
    expect(JSON.parse(output)).toMatchObject({ monitorName: 'Production' });
  });

  it('prunes history and emits a human-readable summary', async () => {
    let output = '';
    const pruner = vi.fn(async () => pruned);
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      monitorHistoryPruner: pruner,
      writeOut: (value) => (output += value),
    });
    await program.parseAsync([
      'node',
      'selector',
      'monitor',
      'prune-history',
      '/tmp/monitor.yaml',
      '--before',
      '90d',
    ]);
    expect(pruner).toHaveBeenCalledWith(
      resolvedConfig.config,
      '/tmp/monitor.yaml',
      expect.objectContaining({ before: '90d' }),
    );
    expect(output).toContain('Removed records: 4');
  });
});
