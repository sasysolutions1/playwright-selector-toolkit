import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSelectorValidationReport,
  loadSelectorManifest,
  openBrowserSession,
  selectorValidationExitCode,
  validateManifestSelectors,
  writeJsonArtifact,
} from '../../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const workingDirectory = await mkdtemp(join(tmpdir(), 'selector-validation-smoke-'));
const executablePath = process.env.SELECTOR_EXECUTABLE_PATH;
const fixture = await readFile(resolve(here, 'validation-fixture.html'), 'utf8');
const config = {
  cwd: workingDirectory,
  artifactsDir: join(workingDirectory, 'artifacts'),
  browser: 'chromium',
  headless: true,
  timeoutMs: 15_000,
  navigationTimeoutMs: 30_000,
  viewport: { width: 1280, height: 900 },
  trace: 'off',
  screenshots: 'off',
  ...(executablePath === undefined ? {} : { executablePath }),
};

const session = await openBrowserSession(config, { command: 'validation-smoke' });
try {
  await session.page.setContent(fixture, { waitUntil: 'domcontentloaded' });
  await session.page.waitForSelector('input[type=email]');
  await session.page.waitForFunction(
    () => document.querySelector('iframe')?.contentDocument?.readyState === 'complete',
  );

  const loaded = await loadSelectorManifest(resolve(here, 'selector-manifest.yaml'));
  const results = await validateManifestSelectors(session.page, loaded.manifest);
  const report = createSelectorValidationReport({
    manifest: loaded.manifest,
    manifestPath: loaded.sourcePath,
    requestedUrl: 'about:blank#validation-fixture',
    finalUrl: session.page.url(),
    title: await session.page.title(),
    results,
  });
  const reportPath = await writeJsonArtifact(
    session.artifactRun,
    'reports/selector-validation-smoke.json',
    report,
  );

  assert.equal(report.summary.success, true);
  assert.equal(report.summary.optionalFailures, 1);
  assert.equal(selectorValidationExitCode(report.summary), 0);
  assert.ok(
    report.results.some((result) => result.id === 'frame-action' && result.status === 'pass'),
  );

  const requiredFailure = await loadSelectorManifest(resolve(here, 'required-failure.yaml'));
  const failedResults = await validateManifestSelectors(session.page, requiredFailure.manifest);
  const failedReport = createSelectorValidationReport({
    manifest: requiredFailure.manifest,
    manifestPath: requiredFailure.sourcePath,
    requestedUrl: 'about:blank#validation-fixture',
    finalUrl: session.page.url(),
    title: await session.page.title(),
    results: failedResults,
  });
  assert.equal(failedReport.summary.requiredFailures, 1);
  assert.equal(selectorValidationExitCode(failedReport.summary), 1);

  process.stdout.write(
    `${JSON.stringify({ ok: true, reportPath, summary: report.summary, requiredFailure: failedReport.summary }, null, 2)}\n`,
  );
  await session.close({ success: true });
} catch (error) {
  await session.close({ success: false, reason: 'Validation smoke test failed' });
  throw error;
} finally {
  await rm(workingDirectory, { recursive: true, force: true });
}
