import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareDomSnapshots, crawlDomSnapshot, openBrowserSession } from '../../dist/index.js';

const baselineHtml = `<!doctype html><html lang="en"><head><title>Comparison Fixture</title></head><body>
<main><form>
<label for="email">Email</label><input id="email" data-testid="email-field" type="email">
<button data-testid="save-button">Save</button>
<button id="cancel">Cancel</button>
</form><a href="/help">Help</a></main>
</body></html>`;

const currentHtml = `<!doctype html><html lang="en"><head><title>Comparison Fixture</title></head><body>
<main><form>
<label for="email-new">Email address</label><input id="email-new" data-testid="email-field-v2" type="email">
</form><a href="/help">Help</a></main>
<aside><button data-testid="save-button">Save</button></aside>
<button id="delete" data-testid="delete-button">Delete</button>
</body></html>`;

const cwd = await mkdtemp(join(tmpdir(), 'selector-comparison-smoke-'));
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

const session = await openBrowserSession(config, { command: 'comparison-smoke' });
try {
  await session.page.setContent(baselineHtml, { waitUntil: 'domcontentloaded' });
  const baseline = await crawlDomSnapshot(session.page, 'about:blank#baseline', {
    scope: 'interactive',
    redact: true,
  });

  await session.page.setContent(currentHtml, { waitUntil: 'domcontentloaded' });
  const current = await crawlDomSnapshot(session.page, 'about:blank#current', {
    scope: 'interactive',
    redact: true,
  });

  const report = compareDomSnapshots('comparison-smoke', 'v1', baseline, current, {
    similarityThreshold: 0.62,
    maxReplacementLocators: 3,
  });

  assert.equal(report.summary.driftDetected, true);
  assert.ok(report.summary.movedElementCount >= 1, 'expected a moved element');
  assert.ok(
    report.summary.changedElementCount + report.summary.movedAndChangedElementCount >= 1,
    'expected a changed element',
  );
  assert.ok(report.summary.addedElementCount >= 1, 'expected an added element');
  assert.ok(report.summary.removedElementCount >= 1, 'expected a removed element');
  const suggestions = report.differences.flatMap((item) =>
    'replacementLocators' in item ? item.replacementLocators : [],
  );
  assert.ok(suggestions.length >= 1, 'expected replacement locator suggestions');
  process.stdout.write(`${JSON.stringify({ ok: true, summary: report.summary }, null, 2)}\n`);
  await session.close({ success: true });
} catch (error) {
  await session.close({ success: false, reason: 'Comparison smoke test failed' });
  throw error;
} finally {
  await rm(cwd, { recursive: true, force: true });
}
