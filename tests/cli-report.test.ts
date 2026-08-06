import { describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import type { ResolvedToolkitConfig } from '../src/types/config.js';
import type { HtmlReportBuildReport } from '../src/types/html-report.js';

const resolvedConfig: ResolvedToolkitConfig = {
  config: {
    cwd: '/tmp/toolkit',
    artifactsDir: '/tmp/toolkit/artifacts',
    browser: 'chromium',
    headless: true,
    timeoutMs: 30_000,
    navigationTimeoutMs: 45_000,
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    screenshots: 'off',
  },
  sources: { configFile: null, environmentVariables: [], cliOptions: [] },
};
const report: HtmlReportBuildReport = {
  artifactRun: {
    id: 'run',
    command: 'report',
    createdAt: '2026-07-18T12:00:00.000Z',
    directories: {
      root: '/tmp/toolkit/artifacts',
      run: '/tmp/toolkit/artifacts/run',
      screenshots: '/tmp/toolkit/artifacts/run/screenshots',
      snapshots: '/tmp/toolkit/artifacts/run/snapshots',
      traces: '/tmp/toolkit/artifacts/run/traces',
      reports: '/tmp/toolkit/artifacts/run/reports',
    },
    metadataPath: '/tmp/toolkit/artifacts/run/run.json',
  },
  reportPath: '/tmp/toolkit/artifacts/run/reports/report.html',
  manifestPath: '/tmp/toolkit/artifacts/run/reports/report.json',
  manifest: {
    schemaVersion: '1.1',
    toolkitVersion: '0.11.0',
    generatedAt: '2026-07-18T12:00:00.000Z',
    title: 'CI report',
    reportPath: '/tmp/toolkit/artifacts/run/reports/report.html',
    sourceCount: 1,
    sources: [],
    imageCount: 0,
    embeddedImageCount: 0,
    omittedImageCount: 0,
    interactive: true,
    warnings: [],
  },
};

describe('report CLI command', () => {
  it('maps report options to the builder', async () => {
    const builder = vi.fn(async () => report);
    const output: string[] = [];
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      htmlReportBuilder: builder,
      writeOut: (value) => output.push(value),
    });
    await program.parseAsync([
      'node',
      'selector',
      '--json',
      'report',
      'artifacts/run',
      'validation.json',
      '--title',
      'CI report',
      '--no-embed-images',
      '--max-items',
      '25',
      '--no-interactive',
    ]);
    expect(builder).toHaveBeenCalledWith(
      resolvedConfig.config,
      ['artifacts/run', 'validation.json'],
      expect.objectContaining({
        title: 'CI report',
        embedImages: false,
        maxItemsPerSection: 25,
        interactive: false,
      }),
    );
    expect(JSON.parse(output.join(''))).toMatchObject({ manifest: { title: 'CI report' } });
  });
});
