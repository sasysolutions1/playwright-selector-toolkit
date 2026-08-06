import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runWithDiagnosticEvidence } from '../../dist/index.js';

const fixture = await readFile(new URL('./evidence-fixture.html', import.meta.url), 'utf8');
const cwd = await mkdtemp(join(tmpdir(), 'selector-evidence-smoke-'));
const executablePath = process.env.SELECTOR_EXECUTABLE_PATH;
const config = {
  cwd,
  artifactsDir: join(cwd, 'artifacts'),
  browser: 'chromium',
  headless: true,
  timeoutMs: 15_000,
  navigationTimeoutMs: 30_000,
  viewport: { width: 1280, height: 900 },
  trace: 'off',
  screenshots: 'off',
  ...(executablePath === undefined ? {} : { executablePath }),
};

try {
  const execution = await runWithDiagnosticEvidence(
    config,
    'about:blank',
    async (_session, page) => {
      await page.route('https://diagnostic.test/missing*', async (route) =>
        route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing' }),
      );
      await page.route('https://diagnostic.test/unreachable*', async (route) =>
        route.abort('failed'),
      );
      await page.setContent(fixture, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
    },
    {
      elementScreenshots: [{ id: 'submit', selector: '#submit' }],
      failOnPageError: true,
      failOnRequestFailure: true,
      failOnHttpError: true,
    },
  );
  const report = execution.evidence;

  assert.equal(report.success, false);
  assert.ok(report.archivePath, 'expected an evidence ZIP');
  assert.ok(report.close.tracePath, 'expected a Playwright trace');
  assert.ok(
    report.manifest.screenshots.artifacts.length >= 3,
    'expected page and element screenshots',
  );
  assert.ok(report.manifest.recorder.summary.consoleEntryCount >= 1, 'expected console evidence');
  assert.ok(report.manifest.recorder.summary.pageErrorCount >= 1, 'expected page-error evidence');
  assert.ok(
    report.manifest.recorder.summary.requestFailureCount >= 1,
    'expected request-failure evidence',
  );
  assert.ok(report.manifest.recorder.summary.httpErrorCount >= 1, 'expected HTTP-error evidence');
  const serialized = JSON.stringify(report.manifest);
  assert.ok(!serialized.includes('hunter@example.com'), 'email must be redacted');
  assert.ok(!serialized.includes('719-555-1212'), 'phone number must be redacted');
  assert.ok(!serialized.includes('secret-value'), 'tokens and URL query data must be redacted');
  const zip = await readFile(report.archivePath);
  assert.equal(zip.subarray(0, 2).toString('ascii'), 'PK');

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        success: report.success,
        archivePath: report.archivePath,
        tracePath: report.close.tracePath,
        screenshots: report.manifest.screenshots.artifacts.length,
        recorder: report.manifest.recorder.summary,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await rm(cwd, { recursive: true, force: true });
}
