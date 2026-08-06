import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  captureSanitizedHtml,
  crawlDomSnapshot,
  createElementFingerprintIndex,
  openBrowserSession,
  saveBaseline,
  writeJsonArtifact,
  writeTextArtifact,
} from '../../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const workingDirectory = await mkdtemp(join(tmpdir(), 'selector-snapshot-smoke-'));
const executablePath = process.env.SELECTOR_EXECUTABLE_PATH;
const fixture = await readFile(resolve(here, 'snapshot-fixture.html'), 'utf8');
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

const session = await openBrowserSession(config, { command: 'snapshot-smoke' });
try {
  await session.page.setContent(fixture, { waitUntil: 'domcontentloaded' });
  await session.page.waitForSelector('#send');
  await session.page.waitForFunction(
    () => document.querySelector('iframe')?.contentDocument?.readyState === 'complete',
  );

  const dom = await crawlDomSnapshot(session.page, 'about:blank#snapshot-fixture', {
    scope: 'interactive',
    maxFrameDepth: 4,
    redact: true,
  });
  const html = await captureSanitizedHtml(session.page, 'about:blank#snapshot-fixture', {
    redact: true,
    maxFrameDepth: 4,
  });
  const fingerprints = createElementFingerprintIndex(dom);
  const domPath = await writeJsonArtifact(session.artifactRun, 'snapshots/dom.json', dom);
  const fingerprintPath = await writeJsonArtifact(
    session.artifactRun,
    'snapshots/fingerprints.json',
    fingerprints,
  );
  const framePaths = [];
  for (const [index, frame] of html.frames.entries()) {
    framePaths.push(
      await writeTextArtifact(
        session.artifactRun,
        `snapshots/html/${String(index + 1).padStart(3, '0')}.html`,
        frame.html,
      ),
    );
  }

  const combined = (await Promise.all(framePaths.map(async (path) => readFile(path, 'utf8')))).join(
    '\n',
  );
  assert.ok(combined.includes('[REDACTED_EMAIL]'), 'expected email redaction');
  assert.ok(combined.includes('[REDACTED_PHONE]'), 'expected phone redaction');
  assert.ok(!combined.includes('never-capture-me'), 'input values must be omitted');
  assert.ok(!combined.includes('super-secret-password'), 'password values must be omitted');
  assert.ok(!combined.includes('token=private'), 'URL query data must be removed');
  assert.ok(!combined.includes('secret-script-value'), 'script contents must be omitted');
  assert.ok(!combined.includes('onclick='), 'inline handlers must be omitted');
  assert.ok(combined.includes('data-selector-toolkit-shadow-root="open"'));
  assert.ok(html.summary.frameCount >= 2, 'expected main document and child frame');
  assert.ok(fingerprints.summary.elementCount >= 4, 'expected interactive fingerprints');

  const manifest = {
    schemaVersion: '1.0',
    toolkitVersion: dom.toolkitVersion,
    createdAt: dom.capturedAt,
    requestedUrl: 'about:blank#snapshot-fixture',
    finalUrl: session.page.url(),
    title: await session.page.title(),
    files: {
      domSnapshot: 'snapshots/dom.json',
      htmlSnapshot: 'snapshots/html-manifest.json',
      fingerprints: 'snapshots/fingerprints.json',
      htmlFrames: framePaths.map((path) =>
        path.slice(session.artifactRun.directories.run.length + 1),
      ),
    },
    domSummary: dom.summary,
    htmlSummary: html.summary,
    fingerprintSummary: fingerprints.summary,
    warnings: [],
  };
  await writeJsonArtifact(session.artifactRun, manifest.files.htmlSnapshot, {
    ...html,
    frames: html.frames.map(({ html: _html, ...frame }, index) => ({
      ...frame,
      relativePath: manifest.files.htmlFrames[index],
      characterCount: _html.length,
    })),
  });
  const report = {
    navigation: {
      requestedUrl: 'about:blank#snapshot-fixture',
      finalUrl: session.page.url(),
      title: await session.page.title(),
      status: null,
      ok: true,
    },
    session: session.summary(),
    artifactRun: session.artifactRun,
    bundlePath: '',
    domSnapshotPath: domPath,
    htmlManifestPath: join(session.artifactRun.directories.run, manifest.files.htmlSnapshot),
    fingerprintPath,
    htmlFramePaths: framePaths,
    manifest,
    close: {
      closedAt: new Date().toISOString(),
      tracePath: null,
      screenshotPath: null,
      storageStatePath: null,
      warnings: [],
    },
  };
  const baseline = await saveBaseline(config, 'snapshot-smoke', report);
  assert.equal(baseline.manifest.name, 'snapshot-smoke');

  process.stdout.write(
    `${JSON.stringify({ ok: true, html: html.summary, fingerprints: fingerprints.summary, baseline: baseline.version }, null, 2)}\n`,
  );
  await session.close({ success: true });
} catch (error) {
  await session.close({ success: false, reason: 'Snapshot smoke test failed' });
  throw error;
} finally {
  await rm(workingDirectory, { recursive: true, force: true });
}
