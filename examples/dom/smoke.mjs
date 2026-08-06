import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crawlDomSnapshot, openBrowserSession, writeJsonArtifact } from '../../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const workingDirectory = await mkdtemp(join(tmpdir(), 'selector-dom-smoke-'));
const executablePath = process.env.SELECTOR_EXECUTABLE_PATH;
const fixture = await readFile(resolve(here, 'discovery-fixture.html'), 'utf8');

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

const session = await openBrowserSession(config, { command: 'dom-smoke' });
try {
  await session.page.setContent(fixture, { waitUntil: 'domcontentloaded' });
  await session.page.waitForSelector('#send');
  await session.page.waitForFunction(
    () => document.querySelector('iframe')?.contentDocument?.readyState === 'complete',
  );
  const snapshot = await crawlDomSnapshot(session.page, 'about:blank#fixture', {
    scope: 'interactive',
    includeHidden: false,
    maxElements: 100,
    maxFrameDepth: 4,
    textLimit: 200,
    redact: true,
  });
  const snapshotPath = await writeJsonArtifact(
    session.artifactRun,
    'snapshots/dom-smoke.json',
    snapshot,
  );
  const snapshotText = await readFile(snapshotPath, 'utf8');

  assert.equal(snapshot.summary.failedFrameCount, 0);
  assert.ok(snapshot.summary.frameCount >= 2, 'expected main document and child iframe');
  assert.ok(snapshot.summary.shadowRootCount >= 1, 'expected an open shadow root');
  assert.ok(snapshot.summary.matchedElementCount >= 6, 'expected interactive controls');
  assert.ok(snapshotText.includes('[REDACTED_EMAIL]'), 'expected email redaction');
  assert.ok(!snapshotText.includes('never-capture-me'), 'input values must never be captured');
  assert.ok(!snapshotText.includes('token=private'), 'URL query data should be removed');
  assert.ok(snapshotText.includes('shadow-action'), 'expected shadow-root element metadata');
  assert.ok(snapshotText.includes('frame-action'), 'expected iframe element metadata');

  process.stdout.write(`${JSON.stringify({ ok: true, summary: snapshot.summary }, null, 2)}\n`);
  await session.close({ success: true });
} catch (error) {
  await session.close({ success: false, reason: 'DOM smoke test failed' });
  throw error;
} finally {
  await rm(workingDirectory, { recursive: true, force: true });
}
