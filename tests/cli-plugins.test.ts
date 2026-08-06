import { describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import type { ResolveConfigOptions, ResolvedToolkitConfig } from '../src/types/config.js';
import type { PluginHostReport } from '../src/types/plugins.js';

const report: PluginHostReport = {
  schemaVersion: '1.0',
  loadedAt: '2026-07-18T00:00:00.000Z',
  plugins: [
    {
      name: 'example-plugin',
      version: '1.0.0',
      description: 'Example',
      order: 0,
      specifier: 'file:///tmp/example.mjs',
      hooks: {
        setup: 0,
        teardown: 0,
        authentication: 1,
        'page-state': 1,
        'redact-text': 1,
        'sanitize-url': 0,
        'locator-candidate': 1,
      },
    },
  ],
  pageStates: [],
  diagnostics: [],
  warnings: [],
};

describe('plugins CLI', () => {
  it('maps repeatable plugin flags into resolved configuration and prints JSON', async () => {
    let output = '';
    const configResolver = vi.fn(
      async (options: ResolveConfigOptions): Promise<ResolvedToolkitConfig> => ({
        config: {
          cwd: '/tmp/project',
          artifactsDir: '/tmp/project/artifacts',
          browser: 'chromium',
          headless: true,
          timeoutMs: 30_000,
          navigationTimeoutMs: 45_000,
          viewport: { width: 1440, height: 900 },
          trace: 'off',
          screenshots: 'off',
          plugins: options.cli?.plugins ?? [],
          pluginTimeoutMs: options.cli?.pluginTimeoutMs,
          pluginFailureMode: options.cli?.pluginFailureMode,
        },
        sources: { configFile: null, environmentVariables: [], cliOptions: [] },
      }),
    );
    const pluginInspector = vi.fn(async () => report);
    const program = createProgram({
      configResolver,
      pluginInspector,
      writeOut: (value) => {
        output += value;
      },
    });

    await program.parseAsync([
      'node',
      'selector',
      '--plugin',
      './one.mjs',
      '--plugin',
      './two.mjs',
      '--plugin-timeout',
      '1500',
      '--plugin-failure-mode',
      'fail-fast',
      'plugins',
      'inspect',
      '--json',
    ]);

    const firstCall = configResolver.mock.calls[0]?.[0];
    expect(firstCall?.cli).toEqual({
      plugins: ['./one.mjs', './two.mjs'],
      pluginTimeoutMs: 1500,
      pluginFailureMode: 'fail-fast',
    });
    const parsed = JSON.parse(output) as PluginHostReport;
    expect(parsed).toMatchObject({ plugins: [{ name: 'example-plugin' }] });
  });
});
