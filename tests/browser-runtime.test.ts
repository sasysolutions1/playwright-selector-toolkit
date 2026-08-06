import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, BrowserContext, BrowserType } from 'playwright';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { launchBrowserRuntime } from '../src/core/browser/runtime.js';
import type { ToolkitConfig } from '../src/types/config.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function config(overrides: Partial<ToolkitConfig> = {}): Promise<ToolkitConfig> {
  const cwd = await mkdtemp(join(tmpdir(), 'selector-runtime-'));
  temporaryDirectories.push(cwd);
  return {
    cwd,
    artifactsDir: join(cwd, 'artifacts'),
    browser: 'chromium',
    headless: true,
    timeoutMs: 10_000,
    navigationTimeoutMs: 20_000,
    viewport: { width: 1024, height: 768 },
    trace: 'off',
    screenshots: 'off',
    ...overrides,
  };
}

describe('launchBrowserRuntime', () => {
  it('launches an ephemeral browser with configured context and storage state', async () => {
    const context = {} as BrowserContext;
    const browser = {
      newContext: vi.fn(async () => context),
      close: vi.fn(async () => undefined),
    } as unknown as Browser;
    const browserType = {
      launch: vi.fn(async () => browser),
    } as unknown as BrowserType;
    const toolkitConfig = await config({
      baseUrl: 'https://example.com',
      storageStatePath: '/tmp/state.json',
      executablePath: '/usr/bin/chromium',
    });

    const runtime = await launchBrowserRuntime(toolkitConfig, {
      browserType,
      storageStateExists: async () => true,
    });

    expect(runtime.mode).toBe('ephemeral');
    expect(browserType.launch).toHaveBeenCalledWith({
      headless: true,
      timeout: 10_000,
      executablePath: '/usr/bin/chromium',
    });
    expect(browser.newContext).toHaveBeenCalledWith({
      acceptDownloads: true,
      viewport: { width: 1024, height: 768 },
      baseURL: 'https://example.com',
      storageState: '/tmp/state.json',
    });
  });

  it('launches and locks a persistent profile', async () => {
    const context = {
      browser: vi.fn(() => null),
    } as unknown as BrowserContext;
    const browserType = {
      launchPersistentContext: vi.fn(async () => context),
    } as unknown as BrowserType;
    const toolkitConfig = await config({ userDataDir: join((await config()).cwd, 'profile') });

    const runtime = await launchBrowserRuntime(toolkitConfig, {
      browserType,
      storageStateExists: async () => false,
    });

    expect(runtime.mode).toBe('persistent');
    expect(browserType.launchPersistentContext).toHaveBeenCalledWith(
      toolkitConfig.userDataDir,
      expect.objectContaining({
        headless: true,
        timeout: 10_000,
        viewport: { width: 1024, height: 768 },
      }),
    );
    await runtime.profileLock?.release();
  });
});
