import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { renderPortableHtmlReport } from '../../dist/core/report/render.js';

const cwd = await mkdtemp(join(tmpdir(), 'selector-dashboard-smoke-'));
try {
  const generatedAt = '2026-07-18T12:00:00.000Z';
  const validation = {
    schemaVersion: '1.0',
    toolkitVersion: '0.12.0',
    generatedAt,
    manifestPath: 'selectors.yaml',
    manifestName: 'Dashboard selectors',
    requestedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    title: 'Dashboard',
    summary: {
      total: 3,
      required: 2,
      optional: 1,
      passed: 1,
      failed: 2,
      errors: 0,
      requiredFailures: 1,
      optionalFailures: 1,
      success: false,
    },
    results: [
      {
        id: 'alpha',
        name: 'Alpha passed',
        required: true,
        framePath: 'main',
        locator: { type: 'css', selector: '#alpha' },
        playwright: "page.locator('#alpha')",
        status: 'pass',
        observed: { count: 1, visibleCount: 1, enabledCount: 1, editableCount: 0, durationMs: 1 },
        assertions: [],
        error: null,
      },
      {
        id: 'beta',
        name: 'Beta failed',
        required: true,
        framePath: 'main',
        locator: { type: 'css', selector: '#beta' },
        playwright: "page.locator('#beta')",
        status: 'fail',
        observed: { count: 0, visibleCount: 0, enabledCount: 0, editableCount: 0, durationMs: 1 },
        assertions: [
          { assertion: 'count', status: 'fail', expected: '1', actual: 0, message: 'Missing beta' },
        ],
        error: null,
      },
      {
        id: 'gamma',
        name: 'Gamma optional',
        required: false,
        framePath: 'main',
        locator: { type: 'css', selector: '#gamma' },
        playwright: "page.locator('#gamma')",
        status: 'fail',
        observed: { count: 0, visibleCount: 0, enabledCount: 0, editableCount: 0, durationMs: 1 },
        assertions: [
          {
            assertion: 'count',
            status: 'fail',
            expected: '1',
            actual: 0,
            message: 'Missing gamma',
          },
        ],
        error: null,
      },
    ],
    warnings: [],
  };
  const source = {
    kind: 'validation',
    path: join(cwd, 'validation.json'),
    runRoot: cwd,
    data: validation,
  };
  const html = renderPortableHtmlReport([source], [], {
    title: 'Interactive dashboard smoke',
    maxItemsPerSection: 25,
    interactive: true,
  });
  const executablePath = process.env.SELECTOR_EXECUTABLE_PATH;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setContent(html, { waitUntil: 'load' });
    assert.equal(await page.locator('[data-dashboard-controls]').count(), 1);
    assert.equal(await page.locator('tr[data-dashboard-row]:not([hidden])').count(), 3);

    await page.locator('[data-issues-only]').check();
    assert.equal(await page.locator('tr[data-dashboard-row]:not([hidden])').count(), 2);

    await page.locator('[data-report-search]').fill('gamma');
    assert.equal(await page.locator('tr[data-dashboard-row]:not([hidden])').count(), 1);
    assert.match(await page.locator('[data-filter-summary]').textContent(), /1 row/);

    await page.locator('[data-reset-filters]').click();
    assert.equal(await page.locator('tr[data-dashboard-row]:not([hidden])').count(), 3);

    await page.locator('[data-metric-filter][data-filter-value="fail"]').click();
    assert.equal(await page.locator('tr[data-dashboard-row]:not([hidden])').count(), 2);

    await page.locator('[data-collapse-all]').click();
    assert.equal(await page.locator('[data-section-body][hidden]').count(), 1);
    await page.locator('[data-expand-all]').click();
    assert.equal(await page.locator('[data-section-body][hidden]').count(), 0);

    await page.locator('[data-theme-toggle]').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');

    const firstBefore = await page.locator('tbody tr').first().textContent();
    await page.locator('[data-sort-index="2"]').click();
    await page.locator('[data-sort-index="2"]').click();
    const firstAfter = await page.locator('tbody tr').first().textContent();
    assert.notEqual(firstBefore, firstAfter);
    assert.equal(errors.length, 0);
  } finally {
    await browser.close();
  }
  process.stdout.write(
    `${JSON.stringify({ ok: true, controls: true, filters: true, sorting: true, collapsing: true, theme: true }, null, 2)}\n`,
  );
} finally {
  await rm(cwd, { recursive: true, force: true });
}
