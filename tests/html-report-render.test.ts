import { describe, expect, it } from 'vitest';
import { renderPortableHtmlReport } from '../src/core/report/render.js';
import type { HtmlReportSource } from '../src/types/html-report.js';
import {
  comparisonFixture,
  diagnosticFixture,
  discoveryFixture,
  locatorFixture,
  monitoringHistoryFixture,
  repairFixture,
  validationFixture,
} from './html-report-fixtures.js';

function source(kind: HtmlReportSource['kind'], data: HtmlReportSource['data']): HtmlReportSource {
  return { kind, path: `/tmp/${kind}.json`, runRoot: '/tmp/run', data };
}

describe('renderPortableHtmlReport', () => {
  it('renders all report sections, dashboard controls, and escaped untrusted text', () => {
    const html = renderPortableHtmlReport(
      [
        source('discovery', discoveryFixture()),
        source('locators', locatorFixture()),
        source('validation', validationFixture()),
        source('repair', repairFixture()),
        source('comparison', comparisonFixture()),
        source('diagnostics', diagnosticFixture()),
        source('monitoring-history', monitoringHistoryFixture()),
      ],
      [
        {
          sourcePath: '/tmp/a.png',
          label: 'Screenshot',
          mimeType: 'image/png',
          byteLength: 10,
          dataUri: 'data:image/png;base64,AAAA',
          reasonNotEmbedded: null,
        },
      ],
      { title: 'Combined report', maxItemsPerSection: 25, interactive: true },
    );
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('DOM discovery');
    expect(html).toContain('Locator recommendations');
    expect(html).toContain('Selector validation');
    expect(html).toContain('Selector repair proposal');
    expect(html).toContain('Human review and validation are required');
    expect(html).toContain('DOM comparison');
    expect(html).toContain('Diagnostic evidence');
    expect(html).toContain('Selector health trends');
    expect(html).toContain('Estimated availability');
    expect(html).toContain('data:image/png;base64,AAAA');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('https://cdn.');
    expect(html).toContain('data-dashboard-controls');
    expect(html).toContain('data-report-search');
    expect(html).toContain('data-facet-controls');
    expect(html).toContain('data-export-visible');
    expect(html).toContain('data-theme-toggle');
    expect(html).toContain('<script>');
  });

  it('can render a static report without dashboard JavaScript', () => {
    const html = renderPortableHtmlReport([source('validation', validationFixture())], [], {
      title: 'Static report',
      maxItemsPerSection: 25,
      interactive: false,
    });
    expect(html).not.toContain('data-dashboard-controls');
    expect(html).not.toContain('<script>');
    expect(html).toContain('No external stylesheets or scripts are required');
  });
});
