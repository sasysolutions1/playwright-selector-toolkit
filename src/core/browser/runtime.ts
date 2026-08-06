import { access } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  BrowserType,
  LaunchOptions,
} from 'playwright';
import { BrowserError } from '../../errors/toolkit-error.js';
import type { BrowserRuntime } from '../../types/browser.js';
import type { ToolkitConfig } from '../../types/config.js';
import { acquireBrowserProfileLock } from './profile-lock.js';

export interface LaunchBrowserRuntimeOptions {
  readonly browserType?: BrowserType;
  readonly storageStateExists?: (path: string) => Promise<boolean>;
}

export function getPlaywrightBrowserType(name: ToolkitConfig['browser']): BrowserType {
  switch (name) {
    case 'chromium':
      return chromium;
    case 'firefox':
      return firefox;
    case 'webkit':
      return webkit;
  }
}

async function defaultStorageStateExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function contextOptions(
  config: ToolkitConfig,
  storageStateAvailable: boolean,
): BrowserContextOptions {
  return {
    acceptDownloads: true,
    viewport: config.viewport,
    ...(config.baseUrl === undefined ? {} : { baseURL: config.baseUrl }),
    ...(storageStateAvailable && config.storageStatePath !== undefined
      ? { storageState: config.storageStatePath }
      : {}),
  };
}

function isProfileConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /profile.*(?:use|lock)|processsingleton|user data directory.*(?:use|lock)/iu.test(message);
}

export async function launchBrowserRuntime(
  config: ToolkitConfig,
  options: LaunchBrowserRuntimeOptions = {},
): Promise<BrowserRuntime> {
  const browserType = options.browserType ?? getPlaywrightBrowserType(config.browser);
  const storageStateAvailable =
    config.storageStatePath !== undefined &&
    (await (options.storageStateExists ?? defaultStorageStateExists)(config.storageStatePath));
  const commonContextOptions = contextOptions(config, storageStateAvailable);

  if (config.userDataDir !== undefined) {
    const profileLock = await acquireBrowserProfileLock(config.userDataDir);

    try {
      const context = await browserType.launchPersistentContext(config.userDataDir, {
        ...commonContextOptions,
        headless: config.headless,
        timeout: config.timeoutMs,
        ...(config.executablePath === undefined ? {} : { executablePath: config.executablePath }),
      });

      return {
        browser: context.browser(),
        context,
        mode: 'persistent',
        profileLock,
      };
    } catch (error) {
      await profileLock.release();
      throw new BrowserError(
        isProfileConflict(error) ? 'BROWSER_PROFILE_IN_USE' : 'BROWSER_LAUNCH_FAILED',
        `Could not launch persistent ${config.browser} context`,
        {
          cause: error,
          details: {
            browser: config.browser,
            userDataDir: config.userDataDir,
          },
        },
      );
    }
  }

  let browser: Browser;
  try {
    const launchOptions: LaunchOptions = {
      headless: config.headless,
      timeout: config.timeoutMs,
      ...(config.executablePath === undefined ? {} : { executablePath: config.executablePath }),
    };
    browser = await browserType.launch(launchOptions);
  } catch (error) {
    throw new BrowserError('BROWSER_LAUNCH_FAILED', `Could not launch ${config.browser}`, {
      cause: error,
      details: { browser: config.browser, headless: config.headless },
    });
  }

  try {
    const context: BrowserContext = await browser.newContext(commonContextOptions);
    return { browser, context, mode: 'ephemeral' };
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw new BrowserError('BROWSER_CONTEXT_FAILED', 'Could not create browser context', {
      cause: error,
      details: { browser: config.browser },
    });
  }
}
