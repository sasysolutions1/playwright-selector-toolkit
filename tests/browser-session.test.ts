import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page, Response } from 'playwright';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManagedBrowserSession } from '../src/core/browser/session.js';
import type { BrowserRuntime } from '../src/types/browser.js';
import type { ToolkitConfig } from '../src/types/config.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function createConfig(overrides: Partial<ToolkitConfig> = {}): Promise<ToolkitConfig> {
  const cwd = await mkdtemp(join(tmpdir(), 'selector-browser-session-'));
  temporaryDirectories.push(cwd);
  return {
    cwd,
    artifactsDir: join(cwd, 'artifacts'),
    browser: 'chromium',
    headless: true,
    timeoutMs: 10_000,
    navigationTimeoutMs: 20_000,
    viewport: { width: 1280, height: 720 },
    trace: 'on',
    screenshots: 'always',
    storageStatePath: join(cwd, 'state', 'storage.json'),
    ...overrides,
  };
}

function createFakeRuntime(mode: BrowserRuntime['mode'] = 'ephemeral') {
  let currentUrl = 'about:blank';
  const page = {
    setDefaultTimeout: vi.fn(),
    setDefaultNavigationTimeout: vi.fn(),
    goto: vi.fn(async (url: string) => {
      currentUrl = url;
      return {
        status: () => 200,
        ok: () => true,
      } as unknown as Response;
    }),
    url: vi.fn(() => currentUrl),
    title: vi.fn(async () => 'Example page'),
    isClosed: vi.fn(() => false),
    screenshot: vi.fn(async () => Buffer.from('png')),
    waitForTimeout: vi.fn(async () => undefined),
  } as unknown as Page;

  const tracing = {
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
  };

  const context = {
    setDefaultTimeout: vi.fn(),
    setDefaultNavigationTimeout: vi.fn(),
    pages: vi.fn(() => [page]),
    newPage: vi.fn(async () => page),
    tracing,
    storageState: vi.fn(async () => ({ cookies: [], origins: [] })),
    close: vi.fn(async () => undefined),
  } as unknown as BrowserContext;

  const browser = {
    close: vi.fn(async () => undefined),
  } as unknown as Browser;

  const profileLock =
    mode === 'persistent'
      ? {
          path: '/tmp/profile/.selector-toolkit-profile.lock',
          owner: {
            token: 'token',
            pid: 1,
            hostname: 'host',
            createdAt: '2026-07-17T00:00:00.000Z',
          },
          release: vi.fn(async () => undefined),
        }
      : undefined;

  const runtime: BrowserRuntime = {
    browser,
    context,
    mode,
    ...(profileLock === undefined ? {} : { profileLock }),
  };

  return { runtime, browser, context, page, tracing, profileLock };
}

describe('ManagedBrowserSession', () => {
  it('applies timeouts, navigates, saves state, retains trace, and closes once', async () => {
    const config = await createConfig();
    const fake = createFakeRuntime();
    const session = await ManagedBrowserSession.open(
      config,
      { command: 'test-session', name: 'example' },
      {
        runtimeLauncher: async () => fake.runtime,
        now: () => new Date('2026-07-17T12:00:00.000Z'),
      },
    );

    expect(fake.context.setDefaultTimeout).toHaveBeenCalledWith(10_000);
    expect(fake.context.setDefaultNavigationTimeout).toHaveBeenCalledWith(20_000);
    expect(fake.tracing.start).toHaveBeenCalledWith(
      expect.objectContaining({ screenshots: true, snapshots: true, sources: true }),
    );

    await expect(session.navigate('https://example.com')).resolves.toMatchObject({
      finalUrl: 'https://example.com',
      title: 'Example page',
      status: 200,
      ok: true,
    });

    const firstClose = await session.close({ success: true });
    const secondClose = await session.close({ success: false });

    expect(firstClose).toEqual(secondClose);
    expect(firstClose.tracePath).toMatch(/trace\.zip$/u);
    expect(firstClose.screenshotPath).toMatch(/-final\.png$/u);
    expect(firstClose.storageStatePath).toBe(config.storageStatePath);
    expect(fake.context.storageState).toHaveBeenCalledWith({
      path: config.storageStatePath,
      indexedDB: true,
    });
    expect(fake.context.close).toHaveBeenCalledTimes(1);
    expect(fake.browser.close).toHaveBeenCalledTimes(1);
  });

  it('retries a transient screenshot failure before recording a warning', async () => {
    const config = await createConfig({ trace: 'off', storageStatePath: undefined });
    const fake = createFakeRuntime();
    vi.mocked(fake.page.screenshot)
      .mockRejectedValueOnce(new Error('transient capture failure'))
      .mockResolvedValueOnce(Buffer.from('png'));
    const session = await ManagedBrowserSession.open(
      config,
      {},
      {
        runtimeLauncher: async () => fake.runtime,
      },
    );

    const result = await session.close({ success: true });

    expect(fake.page.screenshot).toHaveBeenCalledTimes(2);
    expect(fake.page.waitForTimeout).toHaveBeenCalledWith(250);
    expect(result.screenshotPath).not.toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it('discards retain-on-failure traces and screenshots after success', async () => {
    const config = await createConfig({
      trace: 'retain-on-failure',
      screenshots: 'on-failure',
      storageStatePath: undefined,
    });
    const fake = createFakeRuntime();
    const session = await ManagedBrowserSession.open(
      config,
      {},
      {
        runtimeLauncher: async () => fake.runtime,
      },
    );

    const result = await session.close({ success: true });

    expect(result.tracePath).toBeNull();
    expect(result.screenshotPath).toBeNull();
    expect(result.storageStatePath).toBeNull();
    expect(fake.tracing.stop).toHaveBeenCalledWith();
    expect(fake.page.screenshot).not.toHaveBeenCalled();
  });

  it('retains failure diagnostics and releases a persistent profile lock', async () => {
    const config = await createConfig({ userDataDir: '/tmp/profile' });
    const fake = createFakeRuntime('persistent');
    const session = await ManagedBrowserSession.open(
      config,
      {},
      {
        runtimeLauncher: async () => fake.runtime,
      },
    );

    const result = await session.close({ success: false });

    expect(result.tracePath).toMatch(/trace\.zip$/u);
    expect(result.screenshotPath).toMatch(/-final\.png$/u);
    expect(fake.profileLock?.release).toHaveBeenCalledOnce();
    expect(fake.browser.close).toHaveBeenCalledOnce();
  });

  it('requires an explicit or configured storage-state path', async () => {
    const config = await createConfig({ storageStatePath: undefined, trace: 'off' });
    const fake = createFakeRuntime();
    const session = await ManagedBrowserSession.open(
      config,
      {},
      {
        runtimeLauncher: async () => fake.runtime,
      },
    );

    await expect(session.saveStorageState()).rejects.toMatchObject({
      code: 'BROWSER_STORAGE_STATE_FAILED',
    });
    await session.close();
  });
});
