import { describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import type { ResolvedToolkitConfig } from '../src/types/config.js';
import type {
  MonitorCycleReport,
  MonitorState,
  MonitorWatchReport,
} from '../src/types/monitoring.js';

const resolvedConfig: ResolvedToolkitConfig = {
  config: {
    cwd: '/tmp/toolkit',
    artifactsDir: '/tmp/toolkit/artifacts',
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
  id: 'monitor',
  command: 'monitor-run',
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
const cycle: MonitorCycleReport = {
  schemaVersion: '1.0',
  monitorName: 'Production',
  generatedAt: '2026-07-18T00:00:00.000Z',
  manifestPath: '/tmp/monitor.yaml',
  statePath: '/tmp/state.json',
  reportPath: '/tmp/report.json',
  historyPath: '/tmp/history.jsonl',
  artifactRun,
  summary: {
    targetCount: 1,
    checkedCount: 1,
    skippedCount: 0,
    healthyCount: 0,
    unhealthyCount: 1,
    openIncidentCount: 1,
    notificationsSent: 1,
    notificationsFailed: 0,
    success: false,
  },
  results: [],
};
const state: MonitorState = {
  schemaVersion: '1.0',
  monitorName: 'Production',
  updatedAt: '2026-07-18T00:00:00.000Z',
  targets: {},
};
const watch: MonitorWatchReport = {
  startedAt: '2026-07-18T00:00:00.000Z',
  stoppedAt: '2026-07-18T00:01:00.000Z',
  cycles: 1,
  lastCycle: cycle,
};

describe('monitoring CLI', () => {
  it('runs one cycle, passes options, and returns CI exit code 1 for unhealthy state', async () => {
    let output = '';
    const setExitCode = vi.fn();
    const runner = vi.fn(async () => cycle);
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      monitorRunner: runner,
      writeOut: (value) => (output += value),
      setExitCode,
    });
    await program.parseAsync([
      'node',
      'selector',
      'monitor',
      'run',
      'monitor.yaml',
      '--force',
      '--no-notify',
      '--fail-on-unhealthy',
      '--json',
    ]);
    expect(runner).toHaveBeenCalledWith(
      resolvedConfig.config,
      'monitor.yaml',
      expect.objectContaining({ force: true, notify: false, failOnUnhealthy: true }),
    );
    const parsed = JSON.parse(output) as unknown;
    expect(parsed).toMatchObject({ monitorName: 'Production' });
    expect(setExitCode).toHaveBeenCalledWith(1);
  });

  it('runs bounded watch mode', async () => {
    let output = '';
    const watcher = vi.fn(async () => watch);
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      monitorWatcher: watcher,
      writeOut: (value) => (output += value),
    });
    await program.parseAsync([
      'node',
      'selector',
      'monitor',
      'watch',
      'monitor.yaml',
      '--max-cycles',
      '1',
      '--poll-interval',
      '10000',
    ]);
    expect(watcher).toHaveBeenCalledWith(
      resolvedConfig.config,
      'monitor.yaml',
      expect.objectContaining({ maxCycles: 1, pollIntervalMs: 10_000 }),
    );
    expect(output).toContain('Cycles: 1');
  });

  it('shows persistent status', async () => {
    let output = '';
    const statusLoader = vi.fn(async () => ({ statePath: '/tmp/state.json', state }));
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      monitorStatusLoader: statusLoader,
      writeOut: (value) => (output += value),
    });
    await program.parseAsync(['node', 'selector', 'monitor', 'status', 'monitor.yaml']);
    expect(output).toContain('Selector health monitor state');
    expect(statusLoader).toHaveBeenCalledOnce();
  });
});
