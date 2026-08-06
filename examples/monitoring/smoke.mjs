import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createSelectorValidationReport,
  loadMonitorState,
  loadSelectorManifest,
  openBrowserSession,
  runMonitorCycle,
  validateManifestSelectors,
  writeJsonArtifact,
} from '../../dist/index.js';

const cwd = await mkdtemp(join(tmpdir(), 'selector-monitoring-smoke-'));
const executablePath = process.env.SELECTOR_EXECUTABLE_PATH;
const selectorManifest = join(cwd, 'selectors.yaml');
const monitorManifest = join(cwd, 'monitor.yaml');
const stateFile = join(cwd, 'state.json');
let healthy = true;

await writeFile(
  selectorManifest,
  `schemaVersion: "1.0"\nname: Send controls\nselectors:\n  - id: send-button\n    name: Send button\n    locator:\n      type: role\n      role: button\n      name: Send\n      exact: true\n    assertions:\n      count: 1\n      visible: all\n      enabled: all\n`,
);
await writeFile(
  monitorManifest,
  `schemaVersion: "1.0"\nname: Monitoring smoke\npollIntervalMs: 10000\ntargets:\n  - id: send-controls\n    name: Send controls\n    manifestPath: ./selectors.yaml\n    intervalMs: 60000\n    notificationAdapterIds: [console]\n    policy:\n      openAfterFailures: 1\n      recoverAfterSuccesses: 1\n      highAfterFailures: 2\n      criticalAfterFailures: 3\n      reminderIntervalMs: 3600000\nnotifications:\n  - id: console\n    type: console\n    severities: [warning, high, critical]\n    notifyRecovery: true\n`,
);
const config = {
  cwd,
  artifactsDir: join(cwd, 'artifacts'),
  browser: 'chromium',
  headless: true,
  timeoutMs: 10_000,
  navigationTimeoutMs: 20_000,
  viewport: { width: 1280, height: 720 },
  trace: 'off',
  screenshots: 'off',
  ...(executablePath === undefined ? {} : { executablePath }),
};

const sharedSession = await openBrowserSession(config, {
  command: 'monitoring-smoke-validation',
  name: 'shared-monitor-session',
});

async function selectorValidator(_toolkitConfig, manifestPath) {
  const session = sharedSession;
  try {
    await session.page.setContent(
      `<!doctype html><html><head><title>Monitor fixture</title></head><body><main><h1>Account</h1>${
        healthy ? '<button type="button">Send</button>' : '<p>Temporarily unavailable</p>'
      }</main></body></html>`,
      { waitUntil: 'domcontentloaded' },
    );
    const loaded = await loadSelectorManifest(manifestPath);
    const results = await validateManifestSelectors(session.page, loaded.manifest);
    const report = createSelectorValidationReport({
      manifest: loaded.manifest,
      manifestPath: loaded.sourcePath,
      requestedUrl: 'about:blank#monitoring-smoke',
      finalUrl: session.page.url(),
      title: await session.page.title(),
      results,
    });
    const reportPath = await writeJsonArtifact(
      session.artifactRun,
      'reports/selector-validation.json',
      report,
    );
    const sessionSummary = session.summary();
    const close = {
      closedAt: new Date().toISOString(),
      tracePath: null,
      screenshotPath: null,
      storageStatePath: null,
      warnings: [],
      pluginReportPath: null,
      pluginReport: null,
    };
    return {
      navigation: {
        requestedUrl: 'about:blank#monitoring-smoke',
        finalUrl: session.page.url(),
        title: 'Monitor fixture',
        status: null,
        ok: null,
      },
      session: sessionSummary,
      artifactRun: session.artifactRun,
      manifestPath: loaded.sourcePath,
      reportPath,
      summary: report.summary,
      results: report.results,
      warnings: report.warnings,
      close,
    };
  } catch (error) {
    throw error;
  }
}

const run = async () =>
  runMonitorCycle(config, monitorManifest, { force: true, stateFile }, { selectorValidator });

try {
  const first = await run();
  assert.equal(first.summary.success, true);
  assert.equal(first.results[0]?.transition?.eventType, 'none');

  healthy = false;
  const opened = await run();
  assert.equal(opened.results[0]?.transition?.eventType, 'opened');
  assert.equal(opened.results[0]?.transition?.currentSeverity, 'warning');
  assert.equal(opened.summary.notificationsSent, 1);

  const high = await run();
  assert.equal(high.results[0]?.transition?.eventType, 'escalated');
  assert.equal(high.results[0]?.transition?.currentSeverity, 'high');

  const critical = await run();
  assert.equal(critical.results[0]?.transition?.eventType, 'escalated');
  assert.equal(critical.results[0]?.transition?.currentSeverity, 'critical');

  const suppressed = await run();
  assert.equal(suppressed.results[0]?.transition?.eventType, 'suppressed');
  assert.equal(suppressed.summary.notificationsSent, 0);

  healthy = true;
  const recovered = await run();
  assert.equal(recovered.results[0]?.transition?.eventType, 'recovered');
  assert.equal(recovered.summary.notificationsSent, 1);
  assert.equal(recovered.summary.openIncidentCount, 0);

  const state = await loadMonitorState(stateFile, 'Monitoring smoke');
  assert.equal(state.targets['send-controls']?.activeIncident, null);
  assert.equal(state.targets['send-controls']?.recentIncidents[0]?.status, 'resolved');
  const savedState = await readFile(stateFile, 'utf8');
  assert.ok(!savedState.includes('password'));

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        events: [
          opened.results[0]?.transition?.eventType,
          high.results[0]?.transition?.eventType,
          critical.results[0]?.transition?.eventType,
          suppressed.results[0]?.transition?.eventType,
          recovered.results[0]?.transition?.eventType,
        ],
        stateFile,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await sharedSession.close({ success: true, reason: 'Monitoring smoke complete' });
  await rm(cwd, { recursive: true, force: true });
}
