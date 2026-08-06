import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectHtmlReportSource, loadHtmlReportSources } from '../src/core/report/sources.js';
import {
  comparisonFixture,
  diagnosticFixture,
  discoveryFixture,
  locatorFixture,
  monitoringHistoryFixture,
  repairFixture,
  validationFixture,
} from './html-report-fixtures.js';

const dirs: string[] = [];
afterEach(async () =>
  Promise.all(dirs.splice(0).map((path) => rm(path, { recursive: true, force: true }))),
);

describe('HTML report source discovery', () => {
  it('detects every supported report type', () => {
    expect(detectHtmlReportSource(discoveryFixture())).toBe('discovery');
    expect(detectHtmlReportSource(locatorFixture())).toBe('locators');
    expect(detectHtmlReportSource(validationFixture())).toBe('validation');
    expect(detectHtmlReportSource(repairFixture())).toBe('repair');
    expect(detectHtmlReportSource(comparisonFixture())).toBe('comparison');
    expect(detectHtmlReportSource(diagnosticFixture())).toBe('diagnostics');
    expect(detectHtmlReportSource(monitoringHistoryFixture())).toBe('monitoring-history');
    expect(detectHtmlReportSource({ schemaVersion: '1.0' })).toBeNull();
  });

  it('recursively loads supported JSON and ignores unrelated files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'selector-report-sources-'));
    dirs.push(cwd);
    await mkdir(join(cwd, 'nested'));
    await writeFile(join(cwd, 'dom.json'), JSON.stringify(discoveryFixture()));
    await writeFile(join(cwd, 'nested', 'validation.json'), JSON.stringify(validationFixture()));
    await writeFile(join(cwd, 'nested', 'repair.json'), JSON.stringify(repairFixture()));
    await writeFile(join(cwd, 'run.json'), JSON.stringify({ id: 'not-a-report' }));
    const sources = await loadHtmlReportSources(['.'], cwd, 4);
    expect(sources.map((item) => item.kind)).toEqual(['discovery', 'validation', 'repair']);
  });
});
