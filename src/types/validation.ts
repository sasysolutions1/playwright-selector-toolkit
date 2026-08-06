import type { ArtifactRun } from './artifacts.js';
import type {
  BrowserNavigationResult,
  BrowserSessionCloseResult,
  BrowserSessionSummary,
  NavigationWaitUntil,
} from './browser.js';
import type { LocatorSpec } from './locator.js';

export type ValidationPresenceMode = 'any' | 'all' | 'none';
export type SelectorValidationStatus = 'pass' | 'fail' | 'error';
export type AssertionValidationStatus = 'pass' | 'fail';

export interface SelectorCountRange {
  readonly min?: number;
  readonly max?: number;
}

export interface SelectorAssertions {
  readonly count: number | SelectorCountRange;
  readonly visible?: ValidationPresenceMode;
  readonly enabled?: ValidationPresenceMode;
  readonly editable?: ValidationPresenceMode;
}

export interface SelectorManifestEntry {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly required: boolean;
  readonly framePath: string;
  readonly locator: LocatorSpec;
  readonly assertions: SelectorAssertions;
}

export interface SelectorManifest {
  readonly schemaVersion: '1.0';
  readonly name: string;
  readonly url?: string;
  readonly waitUntil: NavigationWaitUntil;
  readonly selectors: readonly SelectorManifestEntry[];
}

export interface LoadedSelectorManifest {
  readonly sourcePath: string;
  readonly manifest: SelectorManifest;
}

export interface SelectorAssertionResult {
  readonly assertion: 'count' | 'visible' | 'enabled' | 'editable';
  readonly status: AssertionValidationStatus;
  readonly expected: string;
  readonly actual: number;
  readonly message: string;
}

export interface SelectorObservedState {
  readonly count: number | null;
  readonly visibleCount: number | null;
  readonly enabledCount: number | null;
  readonly editableCount: number | null;
  readonly durationMs: number;
}

export interface SelectorValidationResult {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly required: boolean;
  readonly framePath: string;
  readonly locator: LocatorSpec;
  readonly playwright: string;
  readonly status: SelectorValidationStatus;
  readonly observed: SelectorObservedState;
  readonly assertions: readonly SelectorAssertionResult[];
  readonly error: string | null;
}

export interface SelectorValidationSummary {
  readonly total: number;
  readonly required: number;
  readonly optional: number;
  readonly passed: number;
  readonly failed: number;
  readonly errors: number;
  readonly requiredFailures: number;
  readonly optionalFailures: number;
  readonly success: boolean;
}

export interface SelectorValidationReport {
  readonly schemaVersion: '1.0';
  readonly toolkitVersion: string;
  readonly generatedAt: string;
  readonly manifestPath: string;
  readonly manifestName: string;
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly title: string;
  readonly summary: SelectorValidationSummary;
  readonly results: readonly SelectorValidationResult[];
  readonly warnings: readonly string[];
}

export interface SelectorValidationOptions {
  readonly command?: string;
  readonly name?: string;
  readonly url?: string;
  readonly waitUntil?: NavigationWaitUntil;
  readonly reportFile?: string;
}

export interface SelectorValidationRunReport {
  readonly navigation: BrowserNavigationResult;
  readonly session: BrowserSessionSummary;
  readonly artifactRun: ArtifactRun;
  readonly manifestPath: string;
  readonly reportPath: string;
  readonly summary: SelectorValidationSummary;
  readonly results: readonly SelectorValidationResult[];
  readonly warnings: readonly string[];
  readonly close: BrowserSessionCloseResult;
}
