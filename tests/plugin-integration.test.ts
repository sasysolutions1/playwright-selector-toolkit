import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page, Response } from 'playwright';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManagedBrowserSession } from '../src/core/browser/session.js';
import { crawlDomSnapshot } from '../src/core/dom/crawler.js';
import { generateElementLocatorCandidates } from '../src/core/locator/candidates.js';
import { PluginHost } from '../src/core/plugins/host.js';
import type { BrowserRuntime } from '../src/types/browser.js';
import type { ToolkitConfig } from '../src/types/config.js';
import type { DomElementSnapshot, FrameDocumentPayload } from '../src/types/dom.js';
import type { LoadedPlugin } from '../src/types/plugins.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function config(): Promise<ToolkitConfig> {
  const cwd = await mkdtemp(join(tmpdir(), 'selector-plugin-integration-'));
  temporaryDirectories.push(cwd);
  return {
    cwd,
    artifactsDir: join(cwd, 'artifacts'),
    browser: 'chromium',
    headless: true,
    timeoutMs: 1_000,
    navigationTimeoutMs: 1_000,
    viewport: { width: 1000, height: 700 },
    trace: 'off',
    screenshots: 'off',
  };
}

function pluginHost(): PluginHost {
  const loaded: LoadedPlugin = {
    specifier: 'file:///plugin.mjs',
    definition: {
      apiVersion: '1',
      name: 'integration-plugin',
      authentication: [
        {
          id: 'auth',
          run: async ({ page }) => {
            await page.evaluate(() => document.body.setAttribute('data-authenticated', 'true'));
            return { handled: true, authenticated: true };
          },
        },
      ],
      pageStateDetectors: [
        {
          id: 'authenticated',
          detect: async ({ page }) =>
            (await page.locator('body[data-authenticated="true"]').count()) === 1
              ? { id: 'authenticated', label: 'Authenticated', confidence: 1 }
              : false,
        },
      ],
      redactors: [
        {
          id: 'account',
          redactText: (value) => value.replace(/ACCOUNT-\d+/gu, '[PLUGIN_ACCOUNT]'),
        },
      ],
      locatorCandidateGenerators: [
        {
          id: 'automation',
          generate: (element) => {
            const value = element.attributes['data-automation'];
            return value === undefined
              ? []
              : [
                  {
                    spec: { type: 'css', selector: `[data-automation="${value}"]` },
                    priority: 9,
                    rationale: 'Plugin automation hook.',
                  },
                ];
          },
        },
      ],
    },
  };
  return new PluginHost([loaded], {
    cwd: '/tmp',
    timeoutMs: 500,
    failureMode: 'isolate',
  });
}

function element(): DomElementSnapshot {
  return {
    id: 'main-element-000001',
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
  };
}

describe('plugin integration', () => {
  it('applies redactors while crawling and plugin generators while creating candidates', async () => {
    const host = pluginHost();
    const payload: FrameDocumentPayload = {
      title: 'Fixture',
      language: 'en',
      readyState: 'complete',
      shadowRootCount: 0,
      inspectedElementCount: 1,
      matchedElementCount: 1,
      truncated: false,
      elements: [{ ...element(), id: 'element-000001', framePath: undefined } as never],
    };
    const page = {
      mainFrame: () => ({
        url: () => 'https://example.test/?tenant=secret',
        name: () => '',
        childFrames: () => [],
      }),
      url: () => 'https://example.test/?tenant=secret',
      title: async () => 'ACCOUNT-1234',
    } as unknown as Page;
    const snapshot = await crawlDomSnapshot(
      page,
      'https://example.test/?tenant=secret',
      {
        pluginHost: host,
      },
      {
        inspectFrame: async () => ({
          ...payload,
          elements: [
            {
              ...payload.elements[0]!,
              text: 'ACCOUNT-1234',
              accessibleName: 'ACCOUNT-1234',
            },
          ],
        }),
      },
    );

    expect(snapshot.frames[0]?.elements[0]?.text).toBe('[PLUGIN_ACCOUNT]');
    const candidates = generateElementLocatorCandidates(element(), { pluginHost: host });
    expect(
      candidates.candidates.some(
        (candidate) =>
          candidate.sourcePlugin === 'integration-plugin' &&
          candidate.spec.type === 'css' &&
          candidate.spec.selector.includes('data-automation'),
      ),
    ).toBe(true);
  });

  it('runs authentication and page-state plugins during managed navigation', async () => {
    const toolkitConfig = await config();
    const host = pluginHost();
    let currentUrl = 'about:blank';
    const page = {
      setDefaultTimeout: vi.fn(),
      setDefaultNavigationTimeout: vi.fn(),
      goto: vi.fn(async (url: string) => {
        currentUrl = url;
        return { status: () => 200, ok: () => true } as unknown as Response;
      }),
      url: () => currentUrl,
      title: async () => 'Fixture',
      isClosed: () => false,
      evaluate: vi.fn(async () => undefined),
      locator: vi.fn(() => ({ count: async () => 1 })),
      screenshot: vi.fn(async () => Buffer.from('png')),
      waitForTimeout: vi.fn(async () => undefined),
    } as unknown as Page;
    const context = {
      setDefaultTimeout: vi.fn(),
      setDefaultNavigationTimeout: vi.fn(),
      pages: () => [page],
      newPage: async () => page,
      tracing: { start: vi.fn(), stop: vi.fn() },
      storageState: vi.fn(),
      close: vi.fn(async () => undefined),
    } as unknown as BrowserContext;
    const browser = { close: vi.fn(async () => undefined) } as unknown as Browser;
    const runtime: BrowserRuntime = { browser, context, mode: 'ephemeral' };

    const session = await ManagedBrowserSession.open(
      toolkitConfig,
      { pluginHost: host },
      {
        runtimeLauncher: async () => runtime,
      },
    );
    const navigation = await session.navigate('https://example.test');
    expect(navigation.pageStates).toEqual([
      { id: 'authenticated', label: 'Authenticated', confidence: 1 },
    ]);
    const closed = await session.close();
    expect(closed.pluginReport?.plugins[0]?.name).toBe('integration-plugin');
    expect(closed.pluginReportPath).toMatch(/plugins\.json$/u);
  });
});
