import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildHtmlReport,
  createLocatorReport,
  createSelectorValidationReport,
  crawlDomSnapshot,
  evaluateLocatorCandidates,
  generateLocatorCandidates,
  loadSelectorManifest,
  openBrowserSession,
  validateManifestSelectors,
  writeJsonArtifact,
} from '../../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const cwd = await mkdtemp(join(tmpdir(), 'selector-sample-app-'));
const fixture = await readFile(resolve(here, 'app.html'), 'utf8');
const executablePath = process.env.SELECTOR_EXECUTABLE_PATH;
const config = {
  cwd: resolve(here, '../..'),
  artifactsDir: join(cwd, 'artifacts'),
  browser: 'chromium',
  headless: true,
  timeoutMs: 15_000,
  navigationTimeoutMs: 30_000,
  viewport: { width: 1280, height: 900 },
  trace: 'off',
  screenshots: 'off',
  plugins: [resolve(here, 'sample-plugin.mjs')],
  pluginTimeoutMs: 5_000,
  pluginFailureMode: 'fail-fast',
  ...(executablePath === undefined ? {} : { executablePath }),
};

const session = await openBrowserSession(config, { command: 'sample-app' });
try {
  await session.page.setContent(fixture, { waitUntil: 'domcontentloaded' });
  await session.plugins.runAuthentication(
    session.page,
    'about:blank#sample-app',
    config,
    session.artifactRun,
  );
  const pageStates = await session.plugins.detectPageStates(
    session.page,
    'about:blank#sample-app',
    config,
    session.artifactRun,
  );
  assert.ok(pageStates.some((state) => state.id === 'dashboard'));

  const loaded = await loadSelectorManifest(resolve(here, 'selectors.yaml'));
  const results = await validateManifestSelectors(session.page, loaded.manifest);
  const validation = createSelectorValidationReport({
    manifest: loaded.manifest,
    manifestPath: loaded.sourcePath,
    requestedUrl: 'about:blank#sample-app',
    finalUrl: session.page.url(),
    title: await session.page.title(),
    results,
  });
  assert.equal(validation.summary.success, true);
  await writeJsonArtifact(session.artifactRun, 'reports/selector-validation.json', validation);

  const snapshot = await crawlDomSnapshot(session.page, 'about:blank#sample-app', {
    pluginHost: session.plugins,
    scope: 'all',
    redact: true,
  });
  const serialized = JSON.stringify(snapshot);
  assert.ok(serialized.includes('[CUSTOMER]'));
  assert.ok(!serialized.includes('CUSTOMER-48291'));
  await writeJsonArtifact(session.artifactRun, 'snapshots/dom-snapshot.json', snapshot);

  const generated = generateLocatorCandidates(snapshot, {
    pluginHost: session.plugins,
    minimumRecommendedScore: 60,
    liveTest: true,
  });
  const evaluated = await evaluateLocatorCandidates(session.page, snapshot, generated);
  const locators = createLocatorReport(snapshot, evaluated, {
    minimumRecommendedScore: 60,
    liveTest: true,
  });
  assert.ok(locators.recommendations.length >= 3);
  assert.ok(
    locators.elements
      .flatMap((entry) => entry.candidates)
      .some((candidate) => candidate.sourcePlugin === 'sample-application-workflow'),
  );
  await writeJsonArtifact(session.artifactRun, 'reports/locator-candidates.json', locators);

  const runRoot = session.artifactRun.directories.run;
  await session.close({ success: true });
  const html = await buildHtmlReport(config, [runRoot], {
    title: 'Sample application selector health',
    interactive: true,
  });
  const reportText = await readFile(html.reportPath, 'utf8');
  assert.ok(reportText.includes('Sample application selector health'));
  assert.ok(reportText.includes('Selector validation'));
  assert.ok(reportText.includes('Locator recommendations'));

  console.log(
    JSON.stringify(
      {
        ok: true,
        pageState: pageStates[0]?.id ?? null,
        validation: validation.summary,
        recommendations: locators.recommendations.length,
        reportPath: html.reportPath,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await session.close({ success: false, reason: 'Sample application workflow failed' });
  throw error;
} finally {
  await rm(cwd, { recursive: true, force: true });
}
