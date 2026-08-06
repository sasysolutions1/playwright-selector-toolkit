import { describe, expect, it, vi } from 'vitest';
import { PluginHost } from '../src/core/plugins/host.js';
import type { ToolkitConfig } from '../src/types/config.js';
import type { LoadedPlugin, SelectorToolkitPlugin } from '../src/types/plugins.js';
import type { Page } from 'playwright';

const config: ToolkitConfig = {
  cwd: '/tmp/plugin-host',
  artifactsDir: '/tmp/plugin-host/artifacts',
  browser: 'chromium',
  headless: true,
  timeoutMs: 30_000,
  navigationTimeoutMs: 45_000,
  viewport: { width: 1280, height: 720 },
  trace: 'off',
  screenshots: 'off',
};

function loaded(definition: SelectorToolkitPlugin): LoadedPlugin {
  return { definition, specifier: `file:///plugins/${definition.name}.mjs` };
}

describe('PluginHost', () => {
  it('orders hooks, preserves plugin state, and records diagnostics', async () => {
    const calls: string[] = [];
    const first = loaded({
      apiVersion: '1',
      name: 'first-plugin',
      order: 20,
      setup: ({ state }) => {
        state.set('ready', true);
      },
      authentication: [
        {
          id: 'authenticate',
          run: ({ state }) => {
            calls.push(`first:${String(state.get('ready'))}`);
            return { handled: true, authenticated: true };
          },
        },
      ],
    });
    const second = loaded({
      apiVersion: '1',
      name: 'second-plugin',
      order: 10,
      authentication: [{ id: 'authenticate', run: () => void calls.push('second') }],
    });
    const host = new PluginHost([first, second], {
      cwd: config.cwd,
      timeoutMs: 500,
      failureMode: 'isolate',
    });

    await host.initialize(config);
    const results = await host.runAuthentication({} as Page, 'https://example.test', config);

    expect(calls).toEqual(['second', 'first:true']);
    expect(results).toEqual([{ handled: true, authenticated: true }]);
    expect(host.report().diagnostics.filter((event) => event.status === 'passed')).toHaveLength(3);
  });

  it('isolates failed and timed-out hooks by default', async () => {
    const host = new PluginHost(
      [
        loaded({
          apiVersion: '1',
          name: 'unstable-plugin',
          authentication: [
            {
              id: 'throws',
              order: 0,
              run: () => {
                throw new Error('boom');
              },
            },
            {
              id: 'hangs',
              order: 10,
              run: async ({ signal }) =>
                new Promise<void>((resolve) => {
                  signal.addEventListener('abort', () => resolve(), { once: true });
                }),
            },
          ],
        }),
      ],
      { cwd: config.cwd, timeoutMs: 20, failureMode: 'isolate' },
    );

    await host.runAuthentication({} as Page, 'https://example.test', config);
    const report = host.report();
    expect(report.diagnostics.map((event) => event.status)).toEqual(['failed', 'timed-out']);
    expect(report.warnings).toHaveLength(2);
  });

  it('supports fail-fast hook execution', async () => {
    const host = new PluginHost(
      [
        loaded({
          apiVersion: '1',
          name: 'strict-plugin',
          authentication: [
            {
              id: 'failure',
              run: () => {
                throw new Error('stop');
              },
            },
          ],
        }),
      ],
      { cwd: config.cwd, timeoutMs: 500, failureMode: 'fail-fast' },
    );

    await expect(
      host.runAuthentication({} as Page, 'https://example.test', config),
    ).rejects.toMatchObject({ code: 'PLUGIN_HOOK_FAILED' });
  });

  it('runs redactors, page-state detectors, and locator generators', async () => {
    const detector = vi.fn(async () => ({ id: 'dashboard', label: 'Dashboard', confidence: 1.5 }));
    const host = new PluginHost(
      [
        loaded({
          apiVersion: '1',
          name: 'extension-plugin',
          pageStateDetectors: [{ id: 'dashboard', detect: detector }],
          redactors: [
            {
              id: 'account',
              redactText: (value) => value.replace(/ACCOUNT-\d+/gu, '[PLUGIN_ACCOUNT]'),
              sanitizeUrl: (value) => value.replace(/tenant=[^&]+/gu, 'tenant=[PLUGIN]'),
            },
          ],
          locatorCandidateGenerators: [
            {
              id: 'automation-attribute',
              generate: (element) => {
                const value = element.attributes['data-automation'];
                return value === undefined
                  ? []
                  : [
                      {
                        spec: { type: 'css', selector: `[data-automation="${value}"]` },
                        rationale: 'Uses the application automation attribute.',
                      },
                    ];
              },
            },
          ],
        }),
      ],
      { cwd: config.cwd, timeoutMs: 500, failureMode: 'isolate' },
    );

    expect(
      host.redactText('Account ACCOUNT-1234', {
        field: 'text',
        elementId: 'one',
        framePath: 'main',
      }),
    ).toBe('Account [PLUGIN_ACCOUNT]');
    expect(
      host.sanitizeUrl('https://example.test/?tenant=secret', {
        field: 'url',
        elementId: null,
        framePath: null,
      }),
    ).toContain('tenant=[PLUGIN]');
    const states = await host.detectPageStates({} as Page, 'https://example.test', config);
    expect(states[0]?.confidence).toBe(1);
    expect(
      host.generateLocatorCandidates(
        {
          id: 'one',
          framePath: 'main',
          shadowPath: [],
          domPath: 'html > body > button',
          tagName: 'button',
          kind: 'button',
          role: null,
          accessibleName: 'Submit',
          text: 'Submit',
          label: null,
          placeholder: null,
          attributes: { 'data-automation': 'submit-order' },
          visibility: { visible: true, reason: 'visible', inViewport: true, boundingBox: null },
          interactive: true,
          interactivitySources: ['native-control'],
          disabled: false,
          readonly: false,
          required: false,
          checked: null,
          selected: null,
          sensitive: false,
          redactionsApplied: 0,
        },
        {
          maxCandidatesPerElement: 10,
          includeXPath: true,
          includeRoleWithoutName: true,
          testIdAttributes: ['data-testid'],
          liveTest: false,
          minimumRecommendedScore: 60,
        },
      )[0],
    ).toMatchObject({ pluginName: 'extension-plugin', generatorId: 'automation-attribute' });
  });
});
