import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Page } from 'playwright';
import { createArtifactRun, writeJsonArtifact } from '../artifacts/manager.js';
import { BrowserError, ToolkitError } from '../../errors/toolkit-error.js';
import type {
  BrowserInspectionReport,
  BrowserNavigationResult,
  BrowserRuntime,
  BrowserSessionCloseOptions,
  BrowserSessionCloseResult,
  BrowserSessionHandle,
  BrowserSessionSummary,
  NavigationWaitUntil,
  OpenBrowserSessionOptions,
} from '../../types/browser.js';
import type { ToolkitConfig } from '../../types/config.js';
import { launchBrowserRuntime } from './runtime.js';
import { createPluginHost } from '../plugins/runtime.js';
import type { PluginHostLike, PluginHostReport } from '../../types/plugins.js';

export interface OpenBrowserSessionDependencies {
  readonly runtimeLauncher?: (config: ToolkitConfig) => Promise<BrowserRuntime>;
  readonly now?: () => Date;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

function fileNameTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/gu, '-');
}

function shouldCaptureScreenshot(config: ToolkitConfig, success: boolean): boolean {
  return config.screenshots === 'always' || (config.screenshots === 'on-failure' && !success);
}

function shouldSaveTrace(config: ToolkitConfig, success: boolean): boolean {
  return config.trace === 'on' || (config.trace === 'retain-on-failure' && !success);
}

export class ManagedBrowserSession implements BrowserSessionHandle {
  readonly browser;
  readonly context;
  readonly page: Page;
  readonly artifactRun;
  readonly plugins: PluginHostLike;

  readonly #config: ToolkitConfig;
  readonly #runtime: BrowserRuntime;
  readonly #createdAt: Date;
  #traceActive = false;
  #closed = false;
  #closePromise: Promise<BrowserSessionCloseResult> | null = null;

  private constructor(
    config: ToolkitConfig,
    runtime: BrowserRuntime,
    page: Page,
    artifactRun: BrowserSessionHandle['artifactRun'],
    createdAt: Date,
    plugins: PluginHostLike,
  ) {
    this.#config = config;
    this.#runtime = runtime;
    this.#createdAt = createdAt;
    this.browser = runtime.browser;
    this.context = runtime.context;
    this.page = page;
    this.artifactRun = artifactRun;
    this.plugins = plugins;
  }

  static async open(
    config: ToolkitConfig,
    options: OpenBrowserSessionOptions = {},
    dependencies: OpenBrowserSessionDependencies = {},
  ): Promise<ManagedBrowserSession> {
    const createdAt = dependencies.now?.() ?? new Date();
    const artifactRun =
      options.artifactRun ??
      (await createArtifactRun(config, {
        command: options.command ?? 'browser-session',
        ...(options.name === undefined ? {} : { name: options.name }),
        now: createdAt,
      }));

    const plugins = options.pluginHost ?? (await createPluginHost(config));
    await plugins.initialize(config, artifactRun);

    let runtime: BrowserRuntime;
    try {
      runtime = await (dependencies.runtimeLauncher ?? launchBrowserRuntime)(config);
    } catch (error) {
      await plugins.teardown(config, artifactRun).catch(() => undefined);
      throw error;
    }
    runtime.context.setDefaultTimeout(config.timeoutMs);
    runtime.context.setDefaultNavigationTimeout(config.navigationTimeoutMs);

    let page: Page;
    try {
      page = runtime.context.pages()[0] ?? (await runtime.context.newPage());
      page.setDefaultTimeout(config.timeoutMs);
      page.setDefaultNavigationTimeout(config.navigationTimeoutMs);
    } catch (error) {
      await runtime.context
        .close({ reason: 'Failed to initialize primary page' })
        .catch(() => undefined);
      await runtime.browser
        ?.close({ reason: 'Failed to initialize primary page' })
        .catch(() => undefined);
      await runtime.profileLock?.release().catch(() => undefined);
      throw new BrowserError('BROWSER_CONTEXT_FAILED', 'Could not initialize the primary page', {
        cause: error,
      });
    }

    const session = new ManagedBrowserSession(
      config,
      runtime,
      page,
      artifactRun,
      createdAt,
      plugins,
    );

    if (config.trace !== 'off') {
      try {
        await runtime.context.tracing.start({
          screenshots: true,
          snapshots: true,
          sources: true,
          title: options.name ?? options.command ?? 'browser-session',
        });
        session.#traceActive = true;
      } catch (error) {
        await session.close({ success: false, reason: 'Trace initialization failed' });
        throw new BrowserError('BROWSER_TRACE_FAILED', 'Could not start Playwright tracing', {
          cause: error,
          details: { traceMode: config.trace },
        });
      }
    }

    return session;
  }

  async navigate(
    url: string,
    waitUntil: NavigationWaitUntil = 'domcontentloaded',
  ): Promise<BrowserNavigationResult> {
    if (this.#closed) {
      throw new BrowserError('BROWSER_SESSION_CLOSED', 'Browser session is already closed');
    }

    try {
      const response = await this.page.goto(url, {
        waitUntil,
        timeout: this.#config.navigationTimeoutMs,
      });
      await this.plugins.runAuthentication(this.page, url, this.#config, this.artifactRun);
      const pageStates = await this.plugins.detectPageStates(
        this.page,
        url,
        this.#config,
        this.artifactRun,
      );
      return {
        requestedUrl: url,
        finalUrl: this.page.url(),
        title: await this.page.title(),
        status: response?.status() ?? null,
        ok: response?.ok() ?? null,
        ...(pageStates.length === 0 ? {} : { pageStates }),
      };
    } catch (error) {
      if (error instanceof ToolkitError) throw error;
      throw new BrowserError('BROWSER_NAVIGATION_FAILED', `Could not navigate to ${url}`, {
        cause: error,
        details: { url, waitUntil },
      });
    }
  }

  summary(): BrowserSessionSummary {
    return {
      id: this.artifactRun.id,
      browser: this.#config.browser,
      mode: this.#runtime.mode,
      headless: this.#config.headless,
      createdAt: this.#createdAt.toISOString(),
      currentUrl: this.page.isClosed() ? '(closed)' : this.page.url(),
      pageCount: this.context.pages().length,
      traceActive: this.#traceActive,
      userDataDir: this.#config.userDataDir ?? null,
      storageStatePath: this.#config.storageStatePath ?? null,
      artifactRun: this.artifactRun,
      pluginCount: this.plugins.size,
    };
  }

  async saveStorageState(path = this.#config.storageStatePath): Promise<string> {
    if (path === undefined) {
      throw new BrowserError(
        'BROWSER_STORAGE_STATE_FAILED',
        'No storage-state path is configured or supplied',
      );
    }

    const outputPath = resolve(path);
    try {
      await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
      await this.context.storageState({ path: outputPath, indexedDB: true });
      return outputPath;
    } catch (error) {
      throw new BrowserError(
        'BROWSER_STORAGE_STATE_FAILED',
        `Could not save browser storage state: ${outputPath}`,
        { cause: error, details: { path: outputPath } },
      );
    }
  }

  async close(options: BrowserSessionCloseOptions = {}): Promise<BrowserSessionCloseResult> {
    if (this.#closePromise !== null) return this.#closePromise;

    this.#closePromise = this.#performClose(options);
    return this.#closePromise;
  }

  async #performClose(options: BrowserSessionCloseOptions): Promise<BrowserSessionCloseResult> {
    const success = options.success ?? true;
    const warnings: string[] = [];
    let tracePath: string | null = null;
    let screenshotPath: string | null = null;
    let storageStatePath: string | null = null;
    let pluginReportPath: string | null = null;
    let pluginReport: PluginHostReport | null = null;

    if (shouldCaptureScreenshot(this.#config, success) && !this.page.isClosed()) {
      screenshotPath = resolve(
        this.artifactRun.directories.screenshots,
        `${fileNameTimestamp(new Date())}-final.png`,
      );
      let lastScreenshotError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await this.page.screenshot({ path: screenshotPath, fullPage: true });
          lastScreenshotError = undefined;
          break;
        } catch (error) {
          lastScreenshotError = error;
          if (attempt === 0) await this.page.waitForTimeout(250);
        }
      }

      if (lastScreenshotError !== undefined) {
        warnings.push(`Could not capture final screenshot: ${describeError(lastScreenshotError)}`);
        screenshotPath = null;
      }
    }

    if ((options.saveStorageState ?? true) && this.#config.storageStatePath !== undefined) {
      try {
        storageStatePath = await this.saveStorageState(this.#config.storageStatePath);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (this.#traceActive) {
      try {
        if (shouldSaveTrace(this.#config, success)) {
          tracePath = resolve(this.artifactRun.directories.traces, 'trace.zip');
          await this.context.tracing.stop({ path: tracePath });
        } else {
          await this.context.tracing.stop();
        }
      } catch (error) {
        warnings.push(`Could not stop Playwright trace: ${describeError(error)}`);
        tracePath = null;
      } finally {
        this.#traceActive = false;
      }
    }

    try {
      await this.plugins.teardown(this.#config, this.artifactRun);
      if (this.plugins.size > 0) {
        pluginReport = this.plugins.report();
        pluginReportPath = await writeJsonArtifact(
          this.artifactRun,
          'reports/plugins.json',
          pluginReport,
        );
      }
    } catch (error) {
      warnings.push(`Could not finalize plugin host: ${describeError(error)}`);
    }

    try {
      await this.context.close({ reason: options.reason ?? 'Selector toolkit session complete' });
    } catch (error) {
      warnings.push(`Could not close browser context cleanly: ${describeError(error)}`);
    }

    if (this.browser !== null) {
      try {
        await this.browser.close({
          reason: options.reason ?? 'Selector toolkit session complete',
        });
      } catch (error) {
        warnings.push(`Could not close browser process cleanly: ${describeError(error)}`);
      }
    }

    await this.#runtime.profileLock?.release().catch((error: unknown) => {
      warnings.push(`Could not release profile lock: ${describeError(error)}`);
    });
    this.#closed = true;

    return {
      closedAt: new Date().toISOString(),
      tracePath,
      screenshotPath,
      storageStatePath,
      warnings,
      pluginReportPath,
      pluginReport,
    };
  }
}

export async function openBrowserSession(
  config: ToolkitConfig,
  options: OpenBrowserSessionOptions = {},
  dependencies: OpenBrowserSessionDependencies = {},
): Promise<BrowserSessionHandle> {
  return ManagedBrowserSession.open(config, options, dependencies);
}

export async function withBrowserSession<Value>(
  config: ToolkitConfig,
  callback: (session: BrowserSessionHandle) => Promise<Value>,
  options: OpenBrowserSessionOptions = {},
): Promise<Value> {
  const session = await openBrowserSession(config, options);
  let success = false;

  try {
    const result = await callback(session);
    success = true;
    return result;
  } finally {
    await session.close({ success });
  }
}

export async function inspectBrowserSession(
  config: ToolkitConfig,
  url: string,
  options: OpenBrowserSessionOptions & { readonly waitUntil?: NavigationWaitUntil } = {},
): Promise<BrowserInspectionReport> {
  const session = await openBrowserSession(config, {
    command: options.command ?? 'browser-inspect',
    ...(options.name === undefined ? {} : { name: options.name }),
    ...(options.artifactRun === undefined ? {} : { artifactRun: options.artifactRun }),
    ...(options.pluginHost === undefined ? {} : { pluginHost: options.pluginHost }),
  });

  try {
    const navigation = await session.navigate(url, options.waitUntil);
    const summary = session.summary();
    const close = await session.close({ success: true });
    return { navigation, session: summary, close };
  } catch (error) {
    await session.close({ success: false, reason: 'Browser inspection failed' });
    throw error;
  }
}
