import type { Page } from 'playwright';
import type { ArtifactRun } from './artifacts.js';
import type { ToolkitConfig } from './config.js';
import type { DomElementSnapshot } from './dom.js';
import type { LocatorSpec, ResolvedLocatorGenerationOptions } from './locator.js';

export type PluginFailureMode = 'isolate' | 'fail-fast';
export type PluginHookKind =
  | 'setup'
  | 'teardown'
  | 'authentication'
  | 'page-state'
  | 'redact-text'
  | 'sanitize-url'
  | 'locator-candidate';
export type PluginHookStatus = 'passed' | 'failed' | 'timed-out' | 'skipped';

export interface PluginRuntimeOptions {
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly failureMode: PluginFailureMode;
}

export interface PluginDiagnosticEvent {
  readonly plugin: string;
  readonly pluginVersion: string | null;
  readonly hookKind: PluginHookKind;
  readonly hookId: string;
  readonly status: PluginHookStatus;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly message: string | null;
}

export interface PluginPageStateMatch {
  readonly id: string;
  readonly label: string;
  readonly confidence: number;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface PluginHostReport {
  readonly schemaVersion: '1.0';
  readonly loadedAt: string;
  readonly plugins: readonly PluginMetadata[];
  readonly pageStates: readonly PluginPageStateMatch[];
  readonly diagnostics: readonly PluginDiagnosticEvent[];
  readonly warnings: readonly string[];
}

export interface PluginMetadata {
  readonly name: string;
  readonly version: string | null;
  readonly description: string | null;
  readonly order: number;
  readonly specifier: string | null;
  readonly hooks: Readonly<Record<PluginHookKind, number>>;
}

export interface PluginLogger {
  debug(message: string, details?: Readonly<Record<string, unknown>>): void;
  info(message: string, details?: Readonly<Record<string, unknown>>): void;
  warn(message: string, details?: Readonly<Record<string, unknown>>): void;
}

export interface PluginBaseContext {
  readonly pluginName: string;
  readonly config: ToolkitConfig;
  readonly artifactRun: ArtifactRun | null;
  readonly state: Map<string, unknown>;
  readonly logger: PluginLogger;
  readonly signal: AbortSignal;
}

export type PluginSetupContext = PluginBaseContext;

export interface PluginAuthenticationContext extends PluginBaseContext {
  readonly page: Page;
  readonly requestedUrl: string;
}

export interface PluginAuthenticationResult {
  readonly handled?: boolean;
  readonly authenticated?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface PluginPageStateContext extends PluginBaseContext {
  readonly page: Page;
  readonly requestedUrl: string;
}

export interface PluginRedactionContext {
  readonly pluginName: string;
  readonly field: string;
  readonly elementId: string | null;
  readonly framePath: string | null;
}

export interface PluginLocatorContext {
  readonly pluginName: string;
  readonly options: ResolvedLocatorGenerationOptions;
}

export interface PluginLocatorCandidateInput {
  readonly spec: LocatorSpec;
  readonly priority?: number;
  readonly rationale: string;
  readonly warnings?: readonly string[];
}

export interface PluginAuthenticationHook {
  readonly id: string;
  readonly order?: number;
  run(
    context: PluginAuthenticationContext,
  ): void | PluginAuthenticationResult | Promise<void | PluginAuthenticationResult>;
}

export interface PluginPageStateDetector {
  readonly id: string;
  readonly order?: number;
  detect(
    context: PluginPageStateContext,
  ): false | null | PluginPageStateMatch | Promise<false | null | PluginPageStateMatch>;
}

export interface PluginRedactor {
  readonly id: string;
  readonly order?: number;
  redactText?(value: string, context: PluginRedactionContext): string;
  sanitizeUrl?(value: string, context: PluginRedactionContext): string;
}

export interface PluginLocatorCandidateGenerator {
  readonly id: string;
  readonly order?: number;
  generate(
    element: DomElementSnapshot,
    context: PluginLocatorContext,
  ): readonly PluginLocatorCandidateInput[];
}

export interface SelectorToolkitPlugin {
  readonly apiVersion: '1';
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly order?: number;
  setup?(context: PluginSetupContext): void | Promise<void>;
  teardown?(context: PluginSetupContext): void | Promise<void>;
  readonly authentication?: readonly PluginAuthenticationHook[];
  readonly pageStateDetectors?: readonly PluginPageStateDetector[];
  readonly redactors?: readonly PluginRedactor[];
  readonly locatorCandidateGenerators?: readonly PluginLocatorCandidateGenerator[];
}

export interface LoadedPlugin {
  readonly definition: SelectorToolkitPlugin;
  readonly specifier: string | null;
}

export interface PluginHostLike {
  readonly size: number;
  initialize(config: ToolkitConfig, artifactRun?: ArtifactRun | null): Promise<void>;
  teardown(config: ToolkitConfig, artifactRun?: ArtifactRun | null): Promise<void>;
  runAuthentication(
    page: Page,
    requestedUrl: string,
    config: ToolkitConfig,
    artifactRun?: ArtifactRun | null,
  ): Promise<readonly PluginAuthenticationResult[]>;
  detectPageStates(
    page: Page,
    requestedUrl: string,
    config: ToolkitConfig,
    artifactRun?: ArtifactRun | null,
  ): Promise<readonly PluginPageStateMatch[]>;
  redactText(value: string, context: Omit<PluginRedactionContext, 'pluginName'>): string;
  sanitizeUrl(value: string, context: Omit<PluginRedactionContext, 'pluginName'>): string;
  generateLocatorCandidates(
    element: DomElementSnapshot,
    options: ResolvedLocatorGenerationOptions,
  ): readonly PluginGeneratedLocatorCandidate[];
  report(): PluginHostReport;
}

export interface PluginGeneratedLocatorCandidate extends PluginLocatorCandidateInput {
  readonly pluginName: string;
  readonly generatorId: string;
}
