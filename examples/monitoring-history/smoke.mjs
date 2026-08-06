import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendMonitorHistory,
  buildHtmlReport,
  buildMonitorHistoryReport,
  openBrowserSession,
  pruneMonitorHistory,
} from '../../dist/index.js';

const root = await mkdtemp(join(tmpdir(), 'selector-history-smoke-'));
const manifestPath = join(root, 'monitor.yaml');
const historyPath = join(root, 'history.jsonl');
const executablePath = process.env.SELECTOR_EXECUTABLE_PATH;
const config = {
  cwd: root,
  artifactsDir: join(root, 'artifacts'),
  browser: 'chromium',
  headless: true,
  timeoutMs: 10_000,
  navigationTimeoutMs: 20_000,
  viewport: { width: 1280, height: 720 },
  trace: 'off',
  screenshots: 'off',
  ...(executablePath === undefined ? {} : { executablePath }),
};

await writeFile(
  manifestPath,
  `schemaVersion: "1.0"\nname: Historical smoke\ntargets:\n  - id: inbox\n    name: Inbox\n    manifestPath: ./selectors.yaml\nnotifications: []\n`,
);
const base = {
  schemaVersion: '1.0',
  monitorName: 'Historical smoke',
  targetId: 'inbox',
  targetName: 'Inbox',
  durationMs: 120,
  fingerprint: 'fixture',
  errorCode: null,
  validationSummary: null,
};
await appendMonitorHistory(historyPath, [
  {
    ...base,
    checkedAt: '2026-07-10T00:00:00.000Z',
    healthy: true,
    eventType: 'none',
    severity: null,
    incidentId: null,
  },
  {
    ...base,
    checkedAt: '2026-07-11T00:00:00.000Z',
    healthy: false,
    eventType: 'opened',
    severity: 'warning',
    incidentId: 'incident-1',
    errorCode: 'SELECTOR_VALIDATION_FAILED',
  },
  {
    ...base,
    checkedAt: '2026-07-12T00:00:00.000Z',
    healthy: false,
    eventType: 'escalated',
    severity: 'high',
    incidentId: 'incident-1',
    errorCode: 'SELECTOR_VALIDATION_FAILED',
  },
  {
    ...base,
    checkedAt: '2026-07-13T00:00:00.000Z',
    healthy: true,
    eventType: 'recovered',
    severity: 'high',
    incidentId: 'incident-1',
  },
]);

const history = await buildMonitorHistoryReport(
  config,
  manifestPath,
  {
    historyFile: historyPath,
    since: '2026-07-10T00:00:00.000Z',
    until: '2026-07-14T00:00:00.000Z',
  },
  new Date('2026-07-14T00:00:00.000Z'),
);
assert.equal(history.summary.checks, 4);
assert.equal(history.summary.incidentCount, 1);
assert.equal(history.summary.resolvedIncidentCount, 1);
assert.equal(history.summary.meanTimeToRecoveryMs, 2 * 86_400_000);

const html = await buildHtmlReport(config, [history.reportPath], {
  title: 'Historical Health Smoke',
});
const source = await readFile(html.reportPath, 'utf8');
assert.match(source, /Selector health trends/u);
assert.match(source, /Estimated availability/u);

const session = await openBrowserSession(config, {
  command: 'monitoring-history-smoke',
  name: 'history-report',
});
try {
  await session.page.setContent(source, { waitUntil: 'load' });
  await session.page.getByRole('heading', { name: 'Selector health trends' }).waitFor();
  assert.equal(
    (await session.page.getByText('Historical smoke', { exact: false }).count()) > 0,
    true,
  );
} finally {
  await session.close({ success: true, reason: 'History smoke complete' });
}

const pruned = await pruneMonitorHistory(
  config,
  manifestPath,
  { historyFile: historyPath, before: '2026-07-11T00:00:00.000Z' },
  new Date('2026-07-14T00:00:00.000Z'),
);
assert.equal(pruned.removed, 1);
assert.equal(pruned.retained, 3);

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      checks: history.summary.checks,
      incidents: history.summary.incidentCount,
      passRatePercent: history.summary.passRatePercent,
      estimatedAvailabilityPercent: history.summary.estimatedAvailabilityPercent,
      reportPath: html.reportPath,
    },
    null,
    2,
  )}\n`,
);
await rm(root, { recursive: true, force: true });
