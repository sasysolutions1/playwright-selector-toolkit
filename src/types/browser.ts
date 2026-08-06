import type { Browser, BrowserContext, Page } from 'playwright';
import type { ArtifactRun } from './artifacts.js';
import type { BrowserName } from './config.js';
import type { PluginHostLike, PluginHostReport, PluginPageStateMatch } from './plugins.js';

export type BrowserSessionMode = 'ephemeral' | 'persistent';
export type NavigationWaitUntil = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

export interface BrowserRuntime {
  readonly browser: Browser | null;
  readonly context: BrowserContext;
  readonly mode: BrowserSessionMode;
  readonly profileLock?: BrowserProfileLock | undefined;
}

export interface BrowserProfileLockOwner {
  readonly token: string;
  readonly pid: number;
  readonly hostname: string;
  readonly createdAt: string;
}

export interface BrowserProfileLock {
  readonly path: string;
  readonly owner: BrowserProfileLockOwner;
  release(): Promise<void>;
}

export interface OpenBrowserSessionOptions {
  readonly command?: string;
  readonly name?: string;
  readonly artifactRun?: ArtifactRun;
  readonly pluginHost?: PluginHostLike;
}

export interface BrowserNavigationResult {
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly title: string;
  readonly status: number | null;
  readonly ok: boolean | null;
  readonly pageStates?: readonly PluginPageStateMatch[];
}

export interface BrowserSessionSummary {
  readonly id: string;
  readonly browser: BrowserName;
  readonly mode: BrowserSessionMode;
  readonly headless: boolean;
  readonly createdAt: string;
  readonly currentUrl: string;
  readonly pageCount: number;
  readonly traceActive: boolean;
  readonly userDataDir: string | null;
  readonly storageStatePath: string | null;
  readonly artifactRun: ArtifactRun;
  readonly pluginCount?: number;
}

export interface BrowserSessionCloseOptions {
  readonly success?: boolean;
  readonly reason?: string;
  readonly saveStorageState?: boolean;
}

export interface BrowserSessionCloseResult {
  readonly closedAt: string;
  readonly tracePath: string | null;
  readonly screenshotPath: string | null;
  readonly storageStatePath: string | null;
  readonly warnings: readonly string[];
  readonly pluginReportPath?: string | null;
  readonly pluginReport?: PluginHostReport | null;
}

export interface BrowserInspectionReport {
  readonly navigation: BrowserNavigationResult;
  readonly session: BrowserSessionSummary;
  readonly close: BrowserSessionCloseResult;
}

export interface BrowserSessionHandle {
  readonly browser: Browser | null;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly artifactRun: ArtifactRun;
  readonly plugins?: PluginHostLike;
  navigate(url: string, waitUntil?: NavigationWaitUntil): Promise<BrowserNavigationResult>;
  summary(): BrowserSessionSummary;
  saveStorageState(path?: string): Promise<string>;
  close(options?: BrowserSessionCloseOptions): Promise<BrowserSessionCloseResult>;
}

export interface GracefulShutdownOptions {
  readonly signals?: readonly NodeJS.Signals[];
  readonly exitCodes?: Readonly<Partial<Record<NodeJS.Signals, number>>>;
  readonly processHost?: NodeJS.Process;
  readonly onSignal?: ((signal: NodeJS.Signals) => void | Promise<void>) | undefined;
}
