import type { Page } from 'playwright';
import type { ArtifactRun } from './artifacts.js';
import type {
  BrowserNavigationResult,
  BrowserSessionCloseResult,
  BrowserSessionHandle,
  BrowserSessionSummary,
  NavigationWaitUntil,
  OpenBrowserSessionOptions,
} from './browser.js';

export type DiagnosticConsoleType =
  | 'log'
  | 'debug'
  | 'info'
  | 'error'
  | 'warning'
  | 'dir'
  | 'dirxml'
  | 'table'
  | 'trace'
  | 'clear'
  | 'startGroup'
  | 'startGroupCollapsed'
  | 'endGroup'
  | 'assert'
  | 'profile'
  | 'profileEnd'
  | 'count'
  | 'timeEnd';

export interface DiagnosticLocation {
  readonly url: string;
  readonly lineNumber: number;
  readonly columnNumber: number;
}

export interface DiagnosticConsoleEntry {
  readonly timestamp: string;
  readonly type: string;
  readonly text: string;
  readonly location: DiagnosticLocation | null;
}

export interface DiagnosticPageErrorEntry {
  readonly timestamp: string;
  readonly name: string;
  readonly message: string;
  readonly stack: string | null;
}

export interface DiagnosticRequestFailureEntry {
  readonly timestamp: string;
  readonly method: string;
  readonly url: string;
  readonly resourceType: string;
  readonly failureText: string | null;
}

export interface DiagnosticHttpErrorEntry {
  readonly timestamp: string;
  readonly method: string;
  readonly url: string;
  readonly resourceType: string;
  readonly status: number;
  readonly statusText: string;
}

export interface DiagnosticRecorderSummary {
  readonly consoleEntryCount: number;
  readonly pageErrorCount: number;
  readonly requestFailureCount: number;
  readonly httpErrorCount: number;
  readonly droppedConsoleEntries: number;
  readonly droppedPageErrors: number;
  readonly droppedRequestFailures: number;
  readonly droppedHttpErrors: number;
  readonly redactionCount: number;
}

export interface DiagnosticRecorderSnapshot {
  readonly schemaVersion: '1.0';
  readonly capturedAt: string;
  readonly console: readonly DiagnosticConsoleEntry[];
  readonly pageErrors: readonly DiagnosticPageErrorEntry[];
  readonly requestFailures: readonly DiagnosticRequestFailureEntry[];
  readonly httpErrors: readonly DiagnosticHttpErrorEntry[];
  readonly summary: DiagnosticRecorderSummary;
}

export interface DiagnosticPageMetadata {
  readonly capturedAt: string;
  readonly url: string;
  readonly title: string;
  readonly readyState: string;
  readonly contentType: string;
  readonly characterSet: string;
  readonly language: string;
  readonly userAgent: string;
  readonly platform: string;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio: number;
  };
  readonly document: {
    readonly width: number;
    readonly height: number;
    readonly scrollWidth: number;
    readonly scrollHeight: number;
  };
  readonly frameCount: number;
  readonly browserVersion: string | null;
}

export interface DiagnosticElementScreenshotRequest {
  readonly id?: string;
  readonly selector: string;
  readonly maxMatches?: number;
}

export interface DiagnosticScreenshotArtifact {
  readonly kind: 'full-page' | 'viewport' | 'element';
  readonly path: string;
  readonly selector: string | null;
  readonly matchIndex: number | null;
  readonly width: number | null;
  readonly height: number | null;
}

export interface DiagnosticScreenshotFailure {
  readonly kind: 'full-page' | 'viewport' | 'element';
  readonly selector: string | null;
  readonly matchIndex: number | null;
  readonly message: string;
}

export interface DiagnosticScreenshotReport {
  readonly artifacts: readonly DiagnosticScreenshotArtifact[];
  readonly failures: readonly DiagnosticScreenshotFailure[];
}

export interface DiagnosticEvidenceOptions extends OpenBrowserSessionOptions {
  readonly waitUntil?: NavigationWaitUntil;
  readonly waitAfterMs?: number;
  readonly includeTrace?: boolean;
  readonly includeConsole?: boolean;
  readonly includeNetwork?: boolean;
  readonly includeDomSnapshot?: boolean;
  readonly includeHtmlSnapshot?: boolean;
  readonly fullPageScreenshot?: boolean;
  readonly viewportScreenshot?: boolean;
  readonly elementScreenshots?: readonly DiagnosticElementScreenshotRequest[];
  readonly maxEntries?: number;
  readonly maxElementScreenshots?: number;
  readonly redact?: boolean;
  readonly archive?: boolean;
  readonly reportFile?: string;
  readonly archiveFile?: string;
  readonly failOnPageError?: boolean;
  readonly failOnRequestFailure?: boolean;
  readonly failOnHttpError?: boolean;
}

export interface ResolvedDiagnosticEvidenceOptions {
  readonly command: string;
  readonly name?: string;
  readonly waitUntil: NavigationWaitUntil;
  readonly waitAfterMs: number;
  readonly includeTrace: boolean;
  readonly includeConsole: boolean;
  readonly includeNetwork: boolean;
  readonly includeDomSnapshot: boolean;
  readonly includeHtmlSnapshot: boolean;
  readonly fullPageScreenshot: boolean;
  readonly viewportScreenshot: boolean;
  readonly elementScreenshots: readonly DiagnosticElementScreenshotRequest[];
  readonly maxEntries: number;
  readonly maxElementScreenshots: number;
  readonly redact: boolean;
  readonly archive: boolean;
  readonly reportFile: string;
  readonly archiveFile: string;
  readonly failOnPageError: boolean;
  readonly failOnRequestFailure: boolean;
  readonly failOnHttpError: boolean;
}

export interface DiagnosticEvidenceFiles {
  readonly metadata: string;
  readonly events: string;
  readonly domSnapshot: string | null;
  readonly htmlSnapshot: string | null;
  readonly htmlFrames: readonly string[];
  readonly screenshots: readonly string[];
  readonly trace: string | null;
}

export interface DiagnosticFailure {
  readonly name: string;
  readonly message: string;
  readonly stack: string | null;
}

export interface DiagnosticEvidenceManifest {
  readonly schemaVersion: '1.0';
  readonly toolkitVersion: string;
  readonly createdAt: string;
  readonly success: boolean;
  readonly requestedUrl: string;
  readonly finalUrl: string | null;
  readonly title: string | null;
  readonly navigation: BrowserNavigationResult | null;
  readonly metadata: DiagnosticPageMetadata | null;
  readonly recorder: DiagnosticRecorderSnapshot;
  readonly screenshots: DiagnosticScreenshotReport;
  readonly files: DiagnosticEvidenceFiles;
  readonly failure: DiagnosticFailure | null;
  readonly warnings: readonly string[];
}

export interface DiagnosticEvidenceReport {
  readonly success: boolean;
  readonly navigation: BrowserNavigationResult | null;
  readonly session: BrowserSessionSummary;
  readonly artifactRun: ArtifactRun;
  readonly reportPath: string;
  readonly archivePath: string | null;
  readonly manifest: DiagnosticEvidenceManifest;
  readonly close: BrowserSessionCloseResult;
}

export interface DiagnosticEvidenceExecution<Value> {
  readonly value: Value | null;
  readonly evidence: DiagnosticEvidenceReport;
}

export type DiagnosticOperation<Value> = (
  session: BrowserSessionHandle,
  page: Page,
) => Promise<Value>;
