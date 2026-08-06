import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
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
const workingDirectory = await mkdtemp(join(tmpdir(), 'selector-locator-smoke-'));
const executablePath = process.env.SELECTOR_EXECUTABLE_PATH;
const fixture = await readFile(resolve(here, 'locator-fixture.html'), 'utf8');
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

const session = await openBrowserSession(config, { command: 'locator-smoke' });
try {
  await session.page.setContent(fixture, { waitUntil: 'domcontentloaded' });
  await session.page.waitForSelector('#save');
  await session.page.waitForFunction(
    () => document.querySelector('iframe')?.contentDocument?.readyState === 'complete',
  );
  const snapshot = await crawlDomSnapshot(session.page, 'about:blank#locator-fixture', {
    scope: 'interactive',
    includeHidden: false,
    maxElements: 100,
    maxFrameDepth: 4,
    textLimit: 200,
    redact: true,
  });
  const generated = generateLocatorCandidates(snapshot, {
    maxCandidatesPerElement: 12,
    liveTest: true,
  });
  const evaluated = await evaluateLocatorCandidates(session.page, snapshot, generated);
  const report = createLocatorReport(snapshot, evaluated, {
    maxCandidatesPerElement: 12,
    liveTest: true,
  });
  const reportPath = await writeJsonArtifact(
    session.artifactRun,
    'reports/locator-smoke.json',
    report,
  );

  const save = report.elements.find(
    (entry) => entry.element.attributes['data-testid'] === 'save-action',
  );
  assert.ok(save, 'expected save button');
  assert.ok(
    save.candidates.some(
      (candidate) => candidate.strategy === 'role' && candidate.evaluation.status === 'unique',
    ),
  );
  assert.ok(
    save.candidates.some(
      (candidate) => candidate.strategy === 'test-id' && candidate.evaluation.status === 'unique',
    ),
  );
  assert.ok(save.recommendedCandidateId, 'expected a recommended save locator');
  const recommendedSave = save.candidates.find(
    (candidate) => candidate.id === save.recommendedCandidateId,
  );
  assert.equal(recommendedSave?.stability?.recommended, true);
  assert.equal(recommendedSave?.stability?.confidence, 'high');
  assert.ok((recommendedSave?.stability?.score ?? 0) >= 75);

  const duplicates = report.elements.filter((entry) => entry.element.text === 'Duplicate');
  assert.equal(duplicates.length, 2);
  assert.ok(
    duplicates.every((entry) =>
      entry.candidates.some(
        (candidate) => candidate.strategy === 'text' && candidate.evaluation.status === 'multiple',
      ),
    ),
  );

  const email = report.elements.find((entry) => entry.element.attributes.name === 'email');
  assert.ok(
    email?.candidates.some(
      (candidate) => candidate.strategy === 'label' && candidate.evaluation.status === 'unique',
    ),
  );
  assert.ok(
    report.elements.some((entry) => entry.element.attributes['data-cy'] === 'shadow-action'),
  );
  assert.ok(
    report.elements.some((entry) => entry.element.attributes['data-testid'] === 'frame-action'),
  );
  assert.ok(report.summary.uniqueCandidateCount > 0);
  assert.ok(report.summary.multipleCandidateCount > 0);
  assert.ok(report.summary.recommendedLocatorCount > 0);
  assert.ok(report.summary.highConfidenceCandidateCount > 0);
  assert.ok(report.recommendations.length > 0);

  process.stdout.write(
    `${JSON.stringify({ ok: true, reportPath, summary: report.summary }, null, 2)}\n`,
  );
  await session.close({ success: true });
} catch (error) {
  await session.close({ success: false, reason: 'Locator smoke test failed' });
  throw error;
} finally {
  await rm(workingDirectory, { recursive: true, force: true });
}
