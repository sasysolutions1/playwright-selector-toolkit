import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createLocatorReport,
  crawlDomSnapshot,
  evaluateLocatorCandidates,
  generateLocatorCandidates,
  openBrowserSession,
  writeJsonArtifact,
} from '../../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const output = await mkdtemp(join(tmpdir(), 'selector-plugin-smoke-'));
const executablePath = process.env.SELECTOR_EXECUTABLE_PATH || '/usr/bin/chromium';
const fixture = await readFile(resolve(here, 'plugin-fixture.html'), 'utf8');
const config = {
  cwd: resolve(here, '../..'),
  artifactsDir: join(output, 'artifacts'),
  browser: 'chromium',
  headless: true,
  timeoutMs: 10_000,
  navigationTimeoutMs: 15_000,
  viewport: { width: 1200, height: 800 },
  trace: 'off',
  screenshots: 'off',
  executablePath,
  plugins: [resolve(here, 'demo-plugin.mjs')],
  pluginTimeoutMs: 5_000,
  pluginFailureMode: 'fail-fast',
};

const session = await openBrowserSession(config, { command: 'plugin-smoke' });
try {
  await session.page.setContent(fixture, { waitUntil: 'domcontentloaded' });
  await session.plugins.runAuthentication(
    session.page,
    'about:blank#plugin-fixture',
    config,
    session.artifactRun,
  );
  const pageStates = await session.plugins.detectPageStates(
    session.page,
    'about:blank#plugin-fixture',
    config,
    session.artifactRun,
  );
  const snapshot = await crawlDomSnapshot(session.page, 'about:blank#plugin-fixture', {
    pluginHost: session.plugins,
    scope: 'all',
    includeHidden: false,
    maxElements: 100,
    maxFrameDepth: 4,
    textLimit: 200,
    redact: true,
  });
  const generated = generateLocatorCandidates(snapshot, {
    pluginHost: session.plugins,
    maxCandidatesPerElement: 12,
    liveTest: true,
  });
  const evaluated = await evaluateLocatorCandidates(session.page, snapshot, generated);
  const locatorReport = createLocatorReport(snapshot, evaluated, {
    maxCandidatesPerElement: 12,
    liveTest: true,
  });
  const snapshotPath = await writeJsonArtifact(
    session.artifactRun,
    'snapshots/plugin-dom.json',
    snapshot,
  );
  const candidatePath = await writeJsonArtifact(
    session.artifactRun,
    'reports/plugin-locators.json',
    locatorReport,
  );
  const serializedSnapshot = JSON.stringify(snapshot);
  if (!pageStates.some((state) => state.id === 'dashboard')) {
    throw new Error('Authentication page-state detector did not match.');
  }
  if (
    !serializedSnapshot.includes('[PLUGIN_ACCOUNT]') ||
    serializedSnapshot.includes('ACCOUNT-4815')
  ) {
    throw new Error('Plugin redaction did not sanitize the account identifier.');
  }
  const pluginCandidate = locatorReport.elements
    .flatMap((entry) => entry.candidates)
    .find((candidate) => candidate.sourcePlugin === 'demo-workflow-plugin');
  if (!pluginCandidate || pluginCandidate.evaluation.status !== 'unique') {
    throw new Error('Plugin locator candidate was not generated and uniquely evaluated.');
  }
  const closed = await session.close({ success: true });
  if (closed.pluginReportPath === null || closed.pluginReportPath === undefined) {
    throw new Error('Plugin report path was not created.');
  }
  const pluginReport = JSON.parse(await readFile(closed.pluginReportPath, 'utf8'));
  if (!pluginReport.diagnostics.some((event) => event.hookKind === 'authentication')) {
    throw new Error('Plugin diagnostic report is missing authentication execution.');
  }
  console.log(
    JSON.stringify(
      {
        pageStates,
        pluginCandidate: pluginCandidate.playwright,
        pluginDiagnostics: pluginReport.diagnostics.length,
        snapshotPath,
        candidatePath,
        redacted: true,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await session.close({ success: false, reason: 'Plugin smoke test failed' });
  throw error;
} finally {
  await rm(output, { recursive: true, force: true });
}
