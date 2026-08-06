import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runMonitorCycle, watchMonitor } from '../src/core/monitoring/runner.js';
import { createEmptyMonitorState, emptyTargetState } from '../src/core/monitoring/state.js';
import type { ToolkitConfig } from '../src/types/config.js';
import type { LoadedMonitorManifest, MonitorState } from '../src/types/monitoring.js';
import type { SelectorValidationRunReport } from '../src/types/validation.js';

async function config(): Promise<ToolkitConfig> {
  const root = await mkdtemp(join(tmpdir(), 'selector-monitor-runner-'));
  return {
    cwd: root,
    artifactsDir: join(root, 'artifacts'),
    browser: 'chromium',
    headless: true,
    timeoutMs: 30_000,
    navigationTimeoutMs: 45_000,
    viewport: { width: 1280, height: 720 },
    trace: 'off',
    screenshots: 'off',
  };
}

const loaded: LoadedMonitorManifest = {
  sourcePath: '/tmp/monitor.yaml',
  manifest: {
    schemaVersion: '1.0',
    name: 'Production',
    pollIntervalMs: 60_000,
    targets: [
      {
        id: 'login',
        name: 'Login',
        manifestPath: '/tmp/login.yaml',
        url: 'https://example.test/login',
        intervalMs: 60_000,
        policy: {
          openAfterFailures: 2,
          recoverAfterSuccesses: 1,
          highAfterFailures: 3,
          criticalAfterFailures: 5,
          reminderIntervalMs: 60_000,
        },
        notificationAdapterIds: ['alerts'],
      },
    ],
    notifications: [],
  },
};

function validation(success: boolean): SelectorValidationRunReport {
  const summary = {
    total: 1,
    required: 1,
    optional: 0,
    passed: success ? 1 : 0,
    failed: success ? 0 : 1,
    errors: 0,
    requiredFailures: success ? 0 : 1,
    optionalFailures: 0,
    success,
  };
  return {
    navigation: {
      requestedUrl: 'https://example.test/login',
      finalUrl: 'https://example.test/login',
      title: 'Login',
      status: 200,
      ok: true,
    },
    session: {
      id: 'validation',
      browser: 'chromium',
      mode: 'ephemeral',
      headless: true,
      createdAt: '2026-07-18T00:00:00.000Z',
      currentUrl: 'https://example.test/login',
      pageCount: 1,
      traceActive: false,
      userDataDir: null,
      storageStatePath: null,
      artifactRun: {
        id: 'validation',
        command: 'monitor-validation',
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
      },
    },
    artifactRun: {
      id: 'validation',
      command: 'monitor-validation',
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
    },
    manifestPath: '/tmp/login.yaml',
    reportPath: '/tmp/run/reports/selector-validation.json',
    summary,
    results: [],
    warnings: [],
    close: {
      closedAt: '2026-07-18T00:00:01.000Z',
      tracePath: null,
      screenshotPath: null,
      storageStatePath: null,
      warnings: [],
    },
  };
}

describe('monitor runner', () => {
  it('persists an opened incident and sends one configured notification', async () => {
    const toolkit = await config();
    const previous = createEmptyMonitorState('Production', new Date('2026-07-18T00:00:00.000Z'));
    const firstFailure = {
      ...emptyTargetState('login'),
      consecutiveFailures: 1,
      lastCheckedAt: '2026-07-17T23:58:00.000Z',
      lastFailureAt: '2026-07-17T23:58:00.000Z',
    };
    const state: MonitorState = { ...previous, targets: { login: firstFailure } };
    const saveState = vi.fn(async () => '/tmp/state.json');
    const appendHistory = vi.fn(async (path: string, records: readonly unknown[]) => {
      void path;
      void records;
      return '/tmp/history.jsonl';
    });
    const send = vi.fn(async () => ({
      adapterId: 'alerts',
      adapterType: 'console' as const,
      status: 'sent' as const,
      message: 'sent',
      providerId: null,
    }));
    const report = await runMonitorCycle(
      toolkit,
      '/tmp/monitor.yaml',
      { force: true, stateFile: join(toolkit.cwd, 'state.json') },
      {
        loadManifest: async () => loaded,
        loadState: async () => state,
        saveState,
        appendHistory,
        selectorValidator: async () => validation(false),
        adapters: [{ id: 'alerts', type: 'console', send }],
        now: () => new Date('2026-07-18T00:00:00.000Z'),
      },
    );
    expect(report.summary).toMatchObject({
      unhealthyCount: 1,
      openIncidentCount: 1,
      notificationsSent: 1,
      success: false,
    });
    expect(report.results[0]?.transition?.eventType).toBe('opened');
    expect(send).toHaveBeenCalledOnce();
    expect(saveState).toHaveBeenCalledOnce();
    expect(appendHistory).toHaveBeenCalledOnce();
    expect(appendHistory.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ targetId: 'login', healthy: false, eventType: 'opened' }),
    ]);
    expect(report.historyPath).toContain('history.jsonl');
  });

  it('skips targets whose interval has not elapsed', async () => {
    const toolkit = await config();
    const state: MonitorState = {
      ...createEmptyMonitorState('Production'),
      targets: {
        login: { ...emptyTargetState('login'), lastCheckedAt: '2026-07-18T00:00:00.000Z' },
      },
    };
    const selectorValidator = vi.fn(async () => validation(true));
    const report = await runMonitorCycle(
      toolkit,
      '/tmp/monitor.yaml',
      { stateFile: join(toolkit.cwd, 'state.json') },
      {
        loadManifest: async () => loaded,
        loadState: async () => state,
        saveState: async () => '/tmp/state.json',
        selectorValidator,
        now: () => new Date('2026-07-18T00:00:30.000Z'),
      },
    );
    expect(report.summary).toMatchObject({ checkedCount: 0, skippedCount: 1 });
    expect(selectorValidator).not.toHaveBeenCalled();
  });

  it('watch mode runs bounded cycles and uses the injected sleep function', async () => {
    const toolkit = await config();
    const sleep = vi.fn(async () => undefined);
    const report = await watchMonitor(
      toolkit,
      '/tmp/monitor.yaml',
      { maxCycles: 2, force: true, notify: false },
      {
        loadManifest: async () => loaded,
        loadState: async () => createEmptyMonitorState('Production'),
        saveState: async () => '/tmp/state.json',
        selectorValidator: async () => validation(true),
        sleep,
        now: () => new Date('2026-07-18T00:00:00.000Z'),
      },
    );
    expect(report.cycles).toBe(2);
    expect(sleep).toHaveBeenCalledOnce();
  });
});
