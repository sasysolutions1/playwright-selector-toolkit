import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildHtmlReport } from '../src/core/report/runner.js';
import type { ToolkitConfig } from '../src/types/config.js';
import { discoveryFixture, locatorFixture } from './html-report-fixtures.js';

const dirs: string[] = [];
afterEach(async () =>
  Promise.all(dirs.splice(0).map((path) => rm(path, { recursive: true, force: true }))),
);

describe('buildHtmlReport', () => {
  it('writes a self-contained HTML report and manifest', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'selector-report-runner-'));
    dirs.push(cwd);
    await writeFile(join(cwd, 'dom.json'), JSON.stringify(discoveryFixture()));
    await writeFile(join(cwd, 'locators.json'), JSON.stringify(locatorFixture()));
    const config: ToolkitConfig = {
      cwd,
      artifactsDir: join(cwd, 'artifacts'),
      browser: 'chromium',
      headless: true,
      timeoutMs: 30_000,
      navigationTimeoutMs: 45_000,
      viewport: { width: 1280, height: 800 },
      trace: 'off',
      screenshots: 'off',
    };
    const result = await buildHtmlReport(
      config,
      ['dom.json', 'locators.json'],
      { title: 'Test report' },
      { now: () => new Date('2026-07-18T12:00:00.000Z'), toolkitVersion: () => '0.11.0' },
    );
    const html = await readFile(result.reportPath, 'utf8');
    expect(result.manifest.sourceCount).toBe(2);
    expect(html).toContain('Test report');
    expect(html).toContain('Interactive controls run entirely offline');
    expect(html).toContain('data-dashboard-controls');
    expect(await readFile(result.manifestPath, 'utf8')).toContain('"schemaVersion": "1.1"');
    expect(result.manifest.interactive).toBe(true);
  });
});
