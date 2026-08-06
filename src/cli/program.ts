import { Command, InvalidArgumentError } from 'commander';
import { createArtifactRun } from '../core/artifacts/manager.js';
import { resolveToolkitConfig } from '../core/config/resolver.js';
import { doctorExitCode, runDoctor } from '../core/doctor.js';
import { inspectBrowserSession } from '../core/browser/session.js';
import { discoverDom } from '../core/dom/discovery.js';
import { analyzeLocators } from '../core/locator/analysis.js';
import { runSelectorValidation } from '../core/validation/runner.js';
import { runSelectorRepair, selectorRepairExitCode } from '../core/repair/runner.js';
import { selectorValidationExitCode } from '../core/validation/evaluator.js';
import { captureSnapshotBundle } from '../core/snapshot/bundle.js';
import { captureBaseline } from '../core/baseline/capture.js';
import { listBaselines, loadBaseline } from '../core/baseline/store.js';
import { compareBaselineToUrl, comparisonExitCode } from '../core/comparison/runner.js';
import {
  captureDiagnosticEvidence,
  diagnosticEvidenceExitCode,
} from '../core/diagnostics/runner.js';
import { buildHtmlReport } from '../core/report/runner.js';
import { inspectConfiguredPlugins } from '../core/plugins/report.js';
import { ToolkitError } from '../errors/toolkit-error.js';
import { getToolkitVersion } from '../core/version.js';
import { compatibilityExitCode, runCompatibilityReview } from '../core/release/compatibility.js';
import { runSecurityReview, securityReviewExitCode } from '../core/release/security.js';
import {
  loadMonitorStatus,
  monitorCycleExitCode,
  runMonitorCycle,
  watchMonitor,
} from '../core/monitoring/runner.js';
import { buildMonitorHistoryReport, pruneMonitorHistory } from '../core/monitoring/history.js';
import type { ArtifactRun, CreateArtifactRunOptions } from '../types/artifacts.js';
import type {
  ResolveConfigOptions,
  ResolvedToolkitConfig,
  ToolkitConfig,
  ToolkitConfigInput,
  ViewportConfig,
} from '../types/config.js';
import type { DoctorOptions, DoctorReport } from '../types/doctor.js';
import type { DiagnosticEvidenceOptions, DiagnosticEvidenceReport } from '../types/diagnostics.js';
import type { HtmlReportBuildReport, HtmlReportOptions } from '../types/html-report.js';
import type { PluginHostReport } from '../types/plugins.js';
import type { CompatibilityReport, SecurityReviewReport } from '../types/release.js';
import type {
  MonitorCycleReport,
  MonitorHistoryPruneOptions,
  MonitorHistoryPruneReport,
  MonitorHistoryQueryOptions,
  MonitorHistoryReport,
  MonitorRunOptions,
  MonitorState,
  MonitorWatchOptions,
  MonitorWatchReport,
} from '../types/monitoring.js';
import type { DomDiscoveryOptions, DomDiscoveryReport } from '../types/dom.js';
import type { DomComparisonRunOptions, DomComparisonRunReport } from '../types/comparison.js';
import type { LocatorAnalysisOptions, LocatorAnalysisReport } from '../types/locator.js';
import type {
  RepairProviderName,
  SelectorRepairOptions,
  SelectorRepairRunReport,
} from '../types/repair.js';
import type {
  BaselineRecord,
  BaselineSaveReport,
  BaselineSummary,
  SnapshotBundleOptions,
  SnapshotBundleReport,
} from '../types/snapshot.js';
import type {
  SelectorValidationOptions,
  SelectorValidationRunReport,
} from '../types/validation.js';
import type {
  BrowserInspectionReport,
  NavigationWaitUntil,
  OpenBrowserSessionOptions,
} from '../types/browser.js';
import {
  formatArtifactRun,
  formatBrowserInspection,
  formatDoctorReport,
  formatDomDiscovery,
  formatLocatorAnalysis,
  formatResolvedConfig,
  formatSelectorValidation,
  formatSnapshotBundle,
  formatBaselineSave,
  formatBaselineList,
  formatBaselineRecord,
  formatDomComparison,
  formatDiagnosticEvidence,
  formatHtmlReport,
  formatPluginHostReport,
  formatSelectorRepair,
  formatCompatibilityReport,
  formatSecurityReview,
  formatMonitorCycle,
  formatMonitorState,
  formatMonitorWatch,
  formatMonitorHistory,
  formatMonitorHistoryPrune,
} from './output.js';

export interface CliDependencies {
  readonly version?: string;
  readonly doctorRunner?: (options: DoctorOptions) => Promise<DoctorReport>;
  readonly configResolver?: (options: ResolveConfigOptions) => Promise<ResolvedToolkitConfig>;
  readonly domDiscoverer?: (
    config: ToolkitConfig,
    url: string,
    options?: DomDiscoveryOptions,
  ) => Promise<DomDiscoveryReport>;
  readonly locatorAnalyzer?: (
    config: ToolkitConfig,
    url: string,
    options?: LocatorAnalysisOptions,
  ) => Promise<LocatorAnalysisReport>;
  readonly snapshotCapturer?: (
    config: ToolkitConfig,
    url: string,
    options?: SnapshotBundleOptions,
  ) => Promise<SnapshotBundleReport>;
  readonly baselineCapturer?: (
    config: ToolkitConfig,
    name: string,
    url: string,
    options?: SnapshotBundleOptions,
  ) => Promise<BaselineSaveReport>;
  readonly baselineLister?: (config: ToolkitConfig) => Promise<readonly BaselineSummary[]>;
  readonly baselineLoader?: (
    config: ToolkitConfig,
    name: string,
    version?: string,
  ) => Promise<BaselineRecord>;
  readonly baselineComparer?: (
    config: ToolkitConfig,
    name: string,
    url?: string,
    options?: DomComparisonRunOptions,
  ) => Promise<DomComparisonRunReport>;
  readonly selectorValidator?: (
    config: ToolkitConfig,
    manifestPath: string,
    options?: SelectorValidationOptions,
  ) => Promise<SelectorValidationRunReport>;
  readonly selectorRepairer?: (
    config: ToolkitConfig,
    manifestPath: string,
    options?: SelectorRepairOptions,
  ) => Promise<SelectorRepairRunReport>;
  readonly diagnosticEvidenceCapturer?: (
    config: ToolkitConfig,
    url: string,
    options?: DiagnosticEvidenceOptions,
  ) => Promise<DiagnosticEvidenceReport>;
  readonly pluginInspector?: (config: ToolkitConfig) => Promise<PluginHostReport>;
  readonly htmlReportBuilder?: (
    config: ToolkitConfig,
    inputs: readonly string[],
    options?: HtmlReportOptions,
  ) => Promise<HtmlReportBuildReport>;
  readonly browserInspector?: (
    config: ToolkitConfig,
    url: string,
    options?: OpenBrowserSessionOptions & { readonly waitUntil?: NavigationWaitUntil },
  ) => Promise<BrowserInspectionReport>;
  readonly compatibilityReviewer?: (options?: {
    readonly cwd?: string;
  }) => Promise<CompatibilityReport>;
  readonly securityReviewer?: (options?: {
    readonly cwd?: string;
  }) => Promise<SecurityReviewReport>;
  readonly monitorRunner?: (
    config: ToolkitConfig,
    manifestPath: string,
    options?: MonitorRunOptions,
  ) => Promise<MonitorCycleReport>;
  readonly monitorWatcher?: (
    config: ToolkitConfig,
    manifestPath: string,
    options?: MonitorWatchOptions,
  ) => Promise<MonitorWatchReport>;
  readonly monitorHistoryBuilder?: (
    config: ToolkitConfig,
    manifestPath: string,
    options?: MonitorHistoryQueryOptions,
  ) => Promise<MonitorHistoryReport>;
  readonly monitorHistoryPruner?: (
    config: ToolkitConfig,
    manifestPath: string,
    options: MonitorHistoryPruneOptions,
  ) => Promise<MonitorHistoryPruneReport>;
  readonly monitorStatusLoader?: (
    config: ToolkitConfig,
    manifestPath: string,
    options?: Pick<MonitorRunOptions, 'stateFile'>,
  ) => Promise<{ readonly statePath: string; readonly state: MonitorState }>;
  readonly artifactRunCreator?: (
    config: ToolkitConfig,
    options: CreateArtifactRunOptions,
  ) => Promise<ArtifactRun>;
  readonly env?: NodeJS.ProcessEnv;
  readonly writeOut?: (value: string) => void;
  readonly writeErr?: (value: string) => void;
  readonly setExitCode?: (code: number) => void;
}

interface GlobalCommandOptions {
  readonly config?: string;
  readonly cwd?: string;
  readonly artifactsDir?: string;
  readonly browser?: ToolkitConfigInput['browser'];
  readonly headless?: boolean;
  readonly headed?: boolean;
  readonly timeout?: number;
  readonly navigationTimeout?: number;
  readonly viewport?: ViewportConfig;
  readonly trace?: ToolkitConfigInput['trace'];
  readonly screenshots?: ToolkitConfigInput['screenshots'];
  readonly baseUrl?: string;
  readonly userDataDir?: string;
  readonly storageState?: string;
  readonly executablePath?: string;
  readonly plugin?: readonly string[];
  readonly pluginTimeout?: number;
  readonly pluginFailureMode?: ToolkitConfigInput['pluginFailureMode'];
  readonly json?: boolean;
}

interface DoctorCommandOptions {
  readonly strict?: boolean;
}

interface ReviewCommandOptions {
  readonly strict?: boolean;
}

interface BrowserInspectCommandOptions {
  readonly name?: string;
  readonly waitUntil?: NavigationWaitUntil;
}

interface DiscoverCommandOptions {
  readonly name?: string;
  readonly waitUntil?: NavigationWaitUntil;
  readonly allElements?: boolean;
  readonly includeHidden?: boolean;
  readonly maxElements?: number;
  readonly maxFrameDepth?: number;
  readonly textLimit?: number;
  readonly redact?: boolean;
  readonly snapshotFile?: string;
}

interface LocatorsCommandOptions extends DiscoverCommandOptions {
  readonly maxCandidates?: number;
  readonly xpath?: boolean;
  readonly roleWithoutName?: boolean;
  readonly liveTest?: boolean;
  readonly candidateFile?: string;
  readonly minimumScore?: number;
}

interface SnapshotCommandOptions extends DiscoverCommandOptions {
  readonly maxFrameCharacters?: number;
  readonly includeStyles?: boolean;
  readonly domSnapshotFile?: string;
  readonly htmlManifestFile?: string;
  readonly fingerprintFile?: string;
  readonly bundleFile?: string;
  readonly htmlDirectory?: string;
}

interface BaselineShowCommandOptions {
  readonly version?: string;
}

interface CompareCommandOptions extends SnapshotCommandOptions {
  readonly baselineVersion?: string;
  readonly similarityThreshold?: number;
  readonly includeUnchanged?: boolean;
  readonly maxReplacements?: number;
  readonly minimumScore?: number;
  readonly reportFile?: string;
  readonly failOnDrift?: boolean;
}

interface ValidateCommandOptions {
  readonly name?: string;
  readonly url?: string;
  readonly waitUntil?: NavigationWaitUntil;
  readonly reportFile?: string;
}

interface RepairCommandOptions extends DiscoverCommandOptions {
  readonly provider?: RepairProviderName;
  readonly model?: string;
  readonly aiTimeout?: number;
  readonly includeOptional?: boolean;
  readonly maxSuggestions?: number;
  readonly minimumScore?: number;
  readonly reportFile?: string;
  readonly proposalFile?: string;
  readonly failOnUnresolved?: boolean;
}

interface EvidenceCommandOptions {
  readonly name?: string;
  readonly waitUntil?: NavigationWaitUntil;
  readonly waitAfter?: number;
  readonly element?: readonly string[];
  readonly fullPage?: boolean;
  readonly viewport?: boolean;
  readonly trace?: boolean;
  readonly console?: boolean;
  readonly network?: boolean;
  readonly domSnapshot?: boolean;
  readonly htmlSnapshot?: boolean;
  readonly archive?: boolean;
  readonly maxEntries?: number;
  readonly maxElementScreenshots?: number;
  readonly redact?: boolean;
  readonly reportFile?: string;
  readonly archiveFile?: string;
  readonly failOnPageError?: boolean;
  readonly failOnRequestFailure?: boolean;
  readonly failOnHttpError?: boolean;
}

interface ReportCommandOptions {
  readonly name?: string;
  readonly title?: string;
  readonly output?: string;
  readonly manifest?: string;
  readonly embedImages?: boolean;
  readonly maxImageBytes?: number;
  readonly maxItems?: number;
  readonly maxDirectoryDepth?: number;
  readonly interactive?: boolean;
}

interface MonitorRunCommandOptions {
  readonly historyFile?: string;
  readonly history?: boolean;
  readonly stateFile?: string;
  readonly reportFile?: string;
  readonly force?: boolean;
  readonly notify?: boolean;
  readonly failOnUnhealthy?: boolean;
}

interface MonitorWatchCommandOptions extends MonitorRunCommandOptions {
  readonly pollInterval?: number;
  readonly maxCycles?: number;
}

interface MonitorHistoryCommandOptions {
  readonly historyFile?: string;
  readonly reportFile?: string;
  readonly since?: string;
  readonly until?: string;
  readonly target?: readonly string[];
}

interface MonitorPruneCommandOptions {
  readonly historyFile?: string;
  readonly before: string;
}

interface MonitorStatusCommandOptions {
  readonly stateFile?: string;
}

interface ArtifactInitCommandOptions {
  readonly name?: string;
}

function collectString(value: string, previous: readonly string[] = []): string[] {
  return [...previous, value];
}

function parsePositiveInteger(value: string): number {
  const result = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new InvalidArgumentError('must be a positive integer');
  }
  return result;
}

function parseNonNegativeInteger(value: string): number {
  const result = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new InvalidArgumentError('must be a non-negative integer');
  }
  return result;
}

function parseScore(value: string): number {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > 100) {
    throw new InvalidArgumentError('must be a number between 0 and 100');
  }
  return result;
}

function parseRatio(value: string): number {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > 1) {
    throw new InvalidArgumentError('must be a number between 0 and 1');
  }
  return result;
}

function parseViewport(value: string): ViewportConfig {
  const match = /^(\d+)x(\d+)$/iu.exec(value.trim());
  if (!match?.[1] || !match[2]) {
    throw new InvalidArgumentError('must use WIDTHxHEIGHT, for example 1440x900');
  }

  return {
    width: parsePositiveInteger(match[1]),
    height: parsePositiveInteger(match[2]),
  };
}

function parseBrowser(value: string): NonNullable<ToolkitConfigInput['browser']> {
  if (value === 'chromium' || value === 'firefox' || value === 'webkit') {
    return value;
  }
  throw new InvalidArgumentError('must be chromium, firefox, or webkit');
}

function parseTrace(value: string): NonNullable<ToolkitConfigInput['trace']> {
  if (value === 'off' || value === 'on' || value === 'retain-on-failure') {
    return value;
  }
  throw new InvalidArgumentError('must be off, on, or retain-on-failure');
}

function parseWaitUntil(value: string): NavigationWaitUntil {
  if (
    value === 'load' ||
    value === 'domcontentloaded' ||
    value === 'networkidle' ||
    value === 'commit'
  ) {
    return value;
  }
  throw new InvalidArgumentError('must be load, domcontentloaded, networkidle, or commit');
}

function parseScreenshots(value: string): NonNullable<ToolkitConfigInput['screenshots']> {
  if (value === 'off' || value === 'always' || value === 'on-failure') {
    return value;
  }
  throw new InvalidArgumentError('must be off, always, or on-failure');
}

function parseRepairProvider(value: string): RepairProviderName {
  if (value === 'none' || value === 'openai') return value;
  throw new InvalidArgumentError('must be none or openai');
}

function parsePluginFailureMode(
  value: string,
): NonNullable<ToolkitConfigInput['pluginFailureMode']> {
  if (value === 'isolate' || value === 'fail-fast') return value;
  throw new InvalidArgumentError('must be isolate or fail-fast');
}

function configInputFromGlobalOptions(options: GlobalCommandOptions): ToolkitConfigInput {
  if (options.headless === true && options.headed === true) {
    throw new ToolkitError('CLI_USAGE_ERROR', '--headless and --headed cannot be used together', {
      exitCode: 2,
    });
  }

  const headless = options.headed === true ? false : options.headless;

  return {
    ...(options.artifactsDir === undefined ? {} : { artifactsDir: options.artifactsDir }),
    ...(options.browser === undefined ? {} : { browser: options.browser }),
    ...(headless === undefined ? {} : { headless }),
    ...(options.timeout === undefined ? {} : { timeoutMs: options.timeout }),
    ...(options.navigationTimeout === undefined
      ? {}
      : { navigationTimeoutMs: options.navigationTimeout }),
    ...(options.viewport === undefined ? {} : { viewport: options.viewport }),
    ...(options.trace === undefined ? {} : { trace: options.trace }),
    ...(options.screenshots === undefined ? {} : { screenshots: options.screenshots }),
    ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
    ...(options.userDataDir === undefined ? {} : { userDataDir: options.userDataDir }),
    ...(options.storageState === undefined ? {} : { storageStatePath: options.storageState }),
    ...(options.executablePath === undefined ? {} : { executablePath: options.executablePath }),
    ...(options.plugin === undefined ? {} : { plugins: options.plugin }),
    ...(options.pluginTimeout === undefined ? {} : { pluginTimeoutMs: options.pluginTimeout }),
    ...(options.pluginFailureMode === undefined
      ? {}
      : { pluginFailureMode: options.pluginFailureMode }),
  };
}

function globalOptions(command: Command): GlobalCommandOptions {
  return command.optsWithGlobals<GlobalCommandOptions>();
}

export function createProgram(dependencies: CliDependencies = {}): Command {
  const version = dependencies.version ?? getToolkitVersion();
  const doctorRunner = dependencies.doctorRunner ?? runDoctor;
  const configResolver = dependencies.configResolver ?? resolveToolkitConfig;
  const artifactRunCreator = dependencies.artifactRunCreator ?? createArtifactRun;
  const compatibilityReviewer = dependencies.compatibilityReviewer ?? runCompatibilityReview;
  const securityReviewer = dependencies.securityReviewer ?? runSecurityReview;
  const monitorRunner = dependencies.monitorRunner ?? runMonitorCycle;
  const monitorWatcher = dependencies.monitorWatcher ?? watchMonitor;
  const monitorStatusLoader = dependencies.monitorStatusLoader ?? loadMonitorStatus;
  const monitorHistoryBuilder = dependencies.monitorHistoryBuilder ?? buildMonitorHistoryReport;
  const monitorHistoryPruner = dependencies.monitorHistoryPruner ?? pruneMonitorHistory;
  const browserInspector = dependencies.browserInspector ?? inspectBrowserSession;
  const domDiscoverer = dependencies.domDiscoverer ?? discoverDom;
  const locatorAnalyzer = dependencies.locatorAnalyzer ?? analyzeLocators;
  const snapshotCapturer = dependencies.snapshotCapturer ?? captureSnapshotBundle;
  const baselineCapturer = dependencies.baselineCapturer ?? captureBaseline;
  const baselineLister = dependencies.baselineLister ?? listBaselines;
  const baselineLoader = dependencies.baselineLoader ?? loadBaseline;
  const baselineComparer = dependencies.baselineComparer ?? compareBaselineToUrl;
  const selectorValidator = dependencies.selectorValidator ?? runSelectorValidation;
  const selectorRepairer = dependencies.selectorRepairer ?? runSelectorRepair;
  const diagnosticEvidenceCapturer =
    dependencies.diagnosticEvidenceCapturer ?? captureDiagnosticEvidence;
  const pluginInspector = dependencies.pluginInspector ?? inspectConfiguredPlugins;
  const htmlReportBuilder = dependencies.htmlReportBuilder ?? buildHtmlReport;
  const env = dependencies.env ?? process.env;
  const writeOut = dependencies.writeOut ?? ((value: string) => process.stdout.write(value));
  const writeErr = dependencies.writeErr ?? ((value: string) => process.stderr.write(value));
  const setExitCode = dependencies.setExitCode ?? ((code: number) => (process.exitCode = code));

  const program = new Command();

  program
    .name('selector')
    .description('Discover, validate, compare, and report on Playwright selectors.')
    .version(version, '-V, --version', 'print the toolkit version')
    .showHelpAfterError()
    .configureOutput({ writeOut, writeErr })
    .option('-c, --config <path>', 'use an explicit JSON or YAML configuration file')
    .option('--cwd <path>', 'working directory used for config discovery and relative CLI paths')
    .option('--artifacts-dir <path>', 'override the artifact output directory')
    .option('--browser <name>', 'override browser: chromium, firefox, or webkit', parseBrowser)
    .option('--headless', 'run browser commands without a visible window')
    .option('--headed', 'run browser commands with a visible window')
    .option('--timeout <ms>', 'default operation timeout in milliseconds', parsePositiveInteger)
    .option('--navigation-timeout <ms>', 'navigation timeout in milliseconds', parsePositiveInteger)
    .option('--viewport <size>', 'browser viewport as WIDTHxHEIGHT', parseViewport)
    .option('--trace <mode>', 'trace mode: off, on, or retain-on-failure', parseTrace)
    .option('--screenshots <mode>', 'screenshot mode: off, always, or on-failure', parseScreenshots)
    .option('--base-url <url>', 'base URL used by browser commands')
    .option('--user-data-dir <path>', 'persistent Playwright browser profile directory')
    .option('--executable-path <path>', 'custom browser executable path')
    .option(
      '--storage-state <path>',
      'load storage state when present and save it when the session closes',
    )
    .option('--plugin <specifier>', 'load a plugin module; repeatable', collectString)
    .option(
      '--plugin-timeout <ms>',
      'per-hook plugin timeout in milliseconds',
      parsePositiveInteger,
    )
    .option(
      '--plugin-failure-mode <mode>',
      'plugin failure mode: isolate or fail-fast',
      parsePluginFailureMode,
    )
    .option('--json', 'emit machine-readable JSON where supported');

  async function resolveForCommand(command: Command): Promise<ResolvedToolkitConfig> {
    const options = globalOptions(command);
    return configResolver({
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      ...(options.config === undefined ? {} : { configPath: options.config }),
      env,
      cli: configInputFromGlobalOptions(options),
    });
  }

  program
    .command('version')
    .description('print the toolkit version')
    .action(() => {
      writeOut(`${version}\n`);
    });

  program
    .command('config')
    .description('print the fully resolved toolkit configuration and its sources')
    .action(async (_options: Record<string, never>, command: Command) => {
      const resolved = await resolveForCommand(command);
      const options = globalOptions(command);
      writeOut(
        options.json === true
          ? `${JSON.stringify(resolved, null, 2)}\n`
          : `${formatResolvedConfig(resolved)}\n`,
      );
    });

  const plugins = program
    .command('plugins')
    .description('inspect configured selector-toolkit plugins');

  plugins
    .command('inspect')
    .description('load plugins, validate their hooks, and print plugin metadata')
    .action(async (_options: Record<string, never>, command: Command) => {
      const resolved = await resolveForCommand(command);
      const global = globalOptions(command);
      const report = await pluginInspector(resolved.config);
      writeOut(
        global.json === true
          ? `${JSON.stringify(report, null, 2)}
`
          : `${formatPluginHostReport(report)}
`,
      );
    });

  program
    .command('compatibility')
    .description('review runtime, package, and build compatibility')
    .option('--strict', 'treat compatibility warnings as failures')
    .action(async (options: ReviewCommandOptions, command: Command) => {
      const resolved = await resolveForCommand(command);
      const global = globalOptions(command);
      const report = await compatibilityReviewer({ cwd: resolved.config.cwd });
      writeOut(
        global.json === true
          ? `${JSON.stringify(report, null, 2)}
`
          : `${formatCompatibilityReport(report)}
`,
      );
      setExitCode(compatibilityExitCode(report, options.strict ?? false));
    });

  const security = program.command('security').description('review repository security controls');

  security
    .command('audit')
    .description('scan package metadata, lock integrity, npm config, and high-confidence secrets')
    .option('--strict', 'treat security warnings as failures')
    .action(async (options: ReviewCommandOptions, command: Command) => {
      const resolved = await resolveForCommand(command);
      const global = globalOptions(command);
      const report = await securityReviewer({ cwd: resolved.config.cwd });
      writeOut(
        global.json === true
          ? `${JSON.stringify(report, null, 2)}
`
          : `${formatSecurityReview(report)}
`,
      );
      setExitCode(securityReviewExitCode(report, options.strict ?? false));
    });

  const monitor = program
    .command('monitor')
    .description('run scheduled selector-health monitoring');

  monitor
    .command('run')
    .description('run one monitoring cycle')
    .argument('<manifest>', 'monitor JSON or YAML manifest')
    .option('--state-file <path>', 'override persistent monitor state file')
    .option('--report-file <path>', 'report path relative to the artifact run')
    .option('--history-file <path>', 'override append-only monitor history file')
    .option('--no-history', 'do not append this cycle to historical health records')
    .option('--force', 'check all targets even when their interval has not elapsed')
    .option('--no-notify', 'update incident state without sending notifications')
    .option('--fail-on-unhealthy', 'exit with code 1 when checks or incidents are unhealthy')
    .action(async (manifest: string, options: MonitorRunCommandOptions, command: Command) => {
      const global = globalOptions(command);
      const resolved = await configResolver({
        ...(global.cwd === undefined ? {} : { cwd: global.cwd }),
        ...(global.config === undefined ? {} : { configPath: global.config }),
        env,
        cli: configInputFromGlobalOptions(global),
      });
      const report = await monitorRunner(resolved.config, manifest, {
        ...(options.stateFile === undefined ? {} : { stateFile: options.stateFile }),
        ...(options.reportFile === undefined ? {} : { reportFile: options.reportFile }),
        ...(options.historyFile === undefined ? {} : { historyFile: options.historyFile }),
        ...(options.history === undefined ? {} : { recordHistory: options.history }),
        ...(options.force === undefined ? {} : { force: options.force }),
        ...(options.notify === undefined ? {} : { notify: options.notify }),
        ...(options.failOnUnhealthy === undefined
          ? {}
          : { failOnUnhealthy: options.failOnUnhealthy }),
      });
      writeOut(
        global.json === true
          ? `${JSON.stringify(report, null, 2)}
`
          : `${formatMonitorCycle(report)}
`,
      );
      setExitCode(monitorCycleExitCode(report, options.failOnUnhealthy === true));
    });

  monitor
    .command('watch')
    .description('run monitoring continuously at the configured poll interval')
    .argument('<manifest>', 'monitor JSON or YAML manifest')
    .option('--state-file <path>', 'override persistent monitor state file')
    .option('--report-file <path>', 'report path relative to each artifact run')
    .option('--history-file <path>', 'override append-only monitor history file')
    .option('--no-history', 'do not append cycles to historical health records')
    .option('--poll-interval <ms>', 'override poll interval in milliseconds', parsePositiveInteger)
    .option('--max-cycles <count>', 'stop after a fixed number of cycles', parsePositiveInteger)
    .option('--force', 'check all targets every cycle')
    .option('--no-notify', 'update incident state without sending notifications')
    .action(async (manifest: string, options: MonitorWatchCommandOptions, command: Command) => {
      const global = globalOptions(command);
      const resolved = await configResolver({
        ...(global.cwd === undefined ? {} : { cwd: global.cwd }),
        ...(global.config === undefined ? {} : { configPath: global.config }),
        env,
        cli: configInputFromGlobalOptions(global),
      });
      const controller = new AbortController();
      const stop = (): void => controller.abort();
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
      try {
        const report = await monitorWatcher(resolved.config, manifest, {
          signal: controller.signal,
          ...(options.stateFile === undefined ? {} : { stateFile: options.stateFile }),
          ...(options.reportFile === undefined ? {} : { reportFile: options.reportFile }),
          ...(options.historyFile === undefined ? {} : { historyFile: options.historyFile }),
          ...(options.history === undefined ? {} : { recordHistory: options.history }),
          ...(options.pollInterval === undefined ? {} : { pollIntervalMs: options.pollInterval }),
          ...(options.maxCycles === undefined ? {} : { maxCycles: options.maxCycles }),
          ...(options.force === undefined ? {} : { force: options.force }),
          ...(options.notify === undefined ? {} : { notify: options.notify }),
        });
        writeOut(
          global.json === true
            ? `${JSON.stringify(report, null, 2)}
`
            : `${formatMonitorWatch(report)}
`,
        );
      } finally {
        process.removeListener('SIGINT', stop);
        process.removeListener('SIGTERM', stop);
      }
    });

  monitor
    .command('history')
    .description('aggregate historical selector-health trends')
    .argument('<manifest>', 'monitor JSON or YAML manifest')
    .option('--history-file <path>', 'override append-only monitor history file')
    .option('--report-file <path>', 'report path relative to the artifact run')
    .option('--since <time>', 'window start as ISO timestamp or duration such as 30d')
    .option('--until <time>', 'window end as ISO timestamp or duration')
    .option('--target <id>', 'include only a target ID; repeatable', collectString)
    .action(async (manifest: string, options: MonitorHistoryCommandOptions, command: Command) => {
      const global = globalOptions(command);
      const resolved = await resolveForCommand(command);
      const report = await monitorHistoryBuilder(resolved.config, manifest, {
        ...(options.historyFile === undefined ? {} : { historyFile: options.historyFile }),
        ...(options.reportFile === undefined ? {} : { reportFile: options.reportFile }),
        ...(options.since === undefined ? {} : { since: options.since }),
        ...(options.until === undefined ? {} : { until: options.until }),
        ...(options.target === undefined ? {} : { targetIds: options.target }),
      });
      writeOut(
        global.json === true
          ? `${JSON.stringify(report, null, 2)}\n`
          : `${formatMonitorHistory(report)}\n`,
      );
    });

  monitor
    .command('prune-history')
    .description('remove historical health records older than a boundary')
    .argument('<manifest>', 'monitor JSON or YAML manifest')
    .requiredOption(
      '--before <time>',
      'remove records before ISO timestamp or duration such as 90d',
    )
    .option('--history-file <path>', 'override append-only monitor history file')
    .action(async (manifest: string, options: MonitorPruneCommandOptions, command: Command) => {
      const global = globalOptions(command);
      const resolved = await resolveForCommand(command);
      const report = await monitorHistoryPruner(resolved.config, manifest, {
        before: options.before,
        ...(options.historyFile === undefined ? {} : { historyFile: options.historyFile }),
      });
      writeOut(
        global.json === true
          ? `${JSON.stringify(report, null, 2)}\n`
          : `${formatMonitorHistoryPrune(report)}\n`,
      );
    });

  monitor
    .command('status')
    .description('show persistent incident and health state')
    .argument('<manifest>', 'monitor JSON or YAML manifest')
    .option('--state-file <path>', 'override persistent monitor state file')
    .action(async (manifest: string, options: MonitorStatusCommandOptions, command: Command) => {
      const global = globalOptions(command);
      const resolved = await configResolver({
        ...(global.cwd === undefined ? {} : { cwd: global.cwd }),
        ...(global.config === undefined ? {} : { configPath: global.config }),
        env,
        cli: configInputFromGlobalOptions(global),
      });
      const status = await monitorStatusLoader(resolved.config, manifest, {
        ...(options.stateFile === undefined ? {} : { stateFile: options.stateFile }),
      });
      writeOut(
        global.json === true
          ? `${JSON.stringify(status, null, 2)}
`
          : `${formatMonitorState(status.state, status.statePath)}
`,
      );
    });

  program
    .command('doctor')
    .description('check whether the local environment can run the toolkit')
    .option('--strict', 'treat warnings as failures')
    .action(async (options: DoctorCommandOptions, command: Command) => {
      const resolved = await resolveForCommand(command);
      const global = globalOptions(command);
      const report = await doctorRunner({
        cwd: resolved.config.cwd,
        artifactsDir: resolved.config.artifactsDir,
        strict: options.strict ?? false,
        ...(resolved.config.executablePath === undefined
          ? {}
          : { browserExecutablePath: resolved.config.executablePath }),
      });
      const output =
        global.json === true
          ? `${JSON.stringify(report, null, 2)}\n`
          : `${formatDoctorReport(report)}\n`;
      writeOut(output);
      setExitCode(doctorExitCode(report, options.strict));
    });

  program
    .command('discover')
    .description('crawl a page and write a redacted DOM element inventory')
    .argument('[url]', 'URL to crawl; defaults to baseUrl')
    .option('--name <name>', 'optional artifact-run name')
    .option(
      '--wait-until <state>',
      'navigation readiness: load, domcontentloaded, networkidle, or commit',
      parseWaitUntil,
      'domcontentloaded',
    )
    .option('--all-elements', 'record all elements instead of interactive elements only')
    .option('--include-hidden', 'include elements classified as hidden')
    .option('--max-elements <count>', 'maximum number of recorded elements', parsePositiveInteger)
    .option(
      '--max-frame-depth <count>',
      'maximum child-frame traversal depth',
      parseNonNegativeInteger,
    )
    .option(
      '--text-limit <count>',
      'maximum characters retained per text field',
      parseNonNegativeInteger,
    )
    .option('--no-redact', 'disable sensitive-text and URL query redaction')
    .option('--snapshot-file <path>', 'JSON snapshot path relative to the artifact run')
    .action(async (url: string | undefined, options: DiscoverCommandOptions, command: Command) => {
      const resolved = await resolveForCommand(command);
      const global = globalOptions(command);
      const target = url ?? resolved.config.baseUrl;
      if (target === undefined) {
        throw new ToolkitError(
          'CLI_USAGE_ERROR',
          'discover requires a URL argument or configured baseUrl',
          { exitCode: 2 },
        );
      }
      const report = await domDiscoverer(resolved.config, target, {
        command: 'discover',
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.waitUntil === undefined ? {} : { waitUntil: options.waitUntil }),
        scope: options.allElements === true ? 'all' : 'interactive',
        includeHidden: options.includeHidden ?? false,
        ...(options.maxElements === undefined ? {} : { maxElements: options.maxElements }),
        ...(options.maxFrameDepth === undefined ? {} : { maxFrameDepth: options.maxFrameDepth }),
        ...(options.textLimit === undefined ? {} : { textLimit: options.textLimit }),
        redact: options.redact ?? true,
        ...(options.snapshotFile === undefined ? {} : { snapshotFile: options.snapshotFile }),
      });
      writeOut(
        global.json === true
          ? `${JSON.stringify(report, null, 2)}\n`
          : `${formatDomDiscovery(report)}\n`,
      );
    });

  program
    .command('locators')
    .description('generate Playwright locator candidates and test their live uniqueness')
    .argument('[url]', 'URL to inspect; defaults to baseUrl')
    .option('--name <name>', 'optional artifact-run name')
    .option(
      '--wait-until <state>',
      'navigation readiness: load, domcontentloaded, networkidle, or commit',
      parseWaitUntil,
      'domcontentloaded',
    )
    .option('--all-elements', 'record all elements instead of interactive elements only')
    .option('--include-hidden', 'include elements classified as hidden')
    .option('--max-elements <count>', 'maximum number of recorded elements', parsePositiveInteger)
    .option(
      '--max-frame-depth <count>',
      'maximum child-frame traversal depth',
      parseNonNegativeInteger,
    )
    .option(
      '--text-limit <count>',
      'maximum characters retained per text field',
      parseNonNegativeInteger,
    )
    .option('--no-redact', 'disable sensitive-text and URL query redaction')
    .option('--snapshot-file <path>', 'DOM snapshot path relative to the artifact run')
    .option('--candidate-file <path>', 'locator report path relative to the artifact run')
    .option(
      '--max-candidates <count>',
      'maximum candidates generated per element',
      parsePositiveInteger,
    )
    .option('--no-xpath', 'omit XPath fallbacks')
    .option('--no-role-without-name', 'omit role-only candidates without an accessible name')
    .option('--no-live-test', 'generate candidates without querying the live page')
    .option(
      '--minimum-score <score>',
      'minimum stability score required for a recommendation',
      parseScore,
    )
    .action(async (url: string | undefined, options: LocatorsCommandOptions, command: Command) => {
      const resolved = await resolveForCommand(command);
      const global = globalOptions(command);
      const target = url ?? resolved.config.baseUrl;
      if (target === undefined) {
        throw new ToolkitError(
          'CLI_USAGE_ERROR',
          'locators requires a URL argument or configured baseUrl',
          { exitCode: 2 },
        );
      }
      const report = await locatorAnalyzer(resolved.config, target, {
        command: 'locators',
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.waitUntil === undefined ? {} : { waitUntil: options.waitUntil }),
        scope: options.allElements === true ? 'all' : 'interactive',
        includeHidden: options.includeHidden ?? false,
        ...(options.maxElements === undefined ? {} : { maxElements: options.maxElements }),
        ...(options.maxFrameDepth === undefined ? {} : { maxFrameDepth: options.maxFrameDepth }),
        ...(options.textLimit === undefined ? {} : { textLimit: options.textLimit }),
        redact: options.redact ?? true,
        ...(options.snapshotFile === undefined ? {} : { snapshotFile: options.snapshotFile }),
        ...(options.candidateFile === undefined ? {} : { candidateFile: options.candidateFile }),
        ...(options.maxCandidates === undefined
          ? {}
          : { maxCandidatesPerElement: options.maxCandidates }),
        includeXPath: options.xpath ?? true,
        includeRoleWithoutName: options.roleWithoutName ?? true,
        liveTest: options.liveTest ?? true,
        ...(options.minimumScore === undefined
          ? {}
          : { minimumRecommendedScore: options.minimumScore }),
      });
      writeOut(
        global.json === true
          ? `${JSON.stringify(report, null, 2)}\n`
          : `${formatLocatorAnalysis(report)}\n`,
      );
    });

  program
    .command('snapshot')
    .description('capture sanitized HTML, DOM inventory, and element fingerprints')
    .argument('[url]', 'URL to snapshot; defaults to baseUrl')
    .option('--name <name>', 'optional artifact-run name')
    .option(
      '--wait-until <state>',
      'navigation readiness: load, domcontentloaded, networkidle, or commit',
      parseWaitUntil,
      'domcontentloaded',
    )
    .option(
      '--all-elements',
      'fingerprint all recorded elements instead of interactive elements only',
    )
    .option('--include-hidden', 'include hidden elements in the DOM inventory')
    .option(
      '--max-elements <count>',
      'maximum number of recorded DOM elements',
      parsePositiveInteger,
    )
    .option(
      '--max-frame-depth <count>',
      'maximum child-frame traversal depth',
      parseNonNegativeInteger,
    )
    .option(
      '--text-limit <count>',
      'maximum characters retained per DOM text field',
      parseNonNegativeInteger,
    )
    .option(
      '--max-frame-characters <count>',
      'maximum sanitized HTML characters per frame',
      parsePositiveInteger,
    )
    .option('--include-styles', 'retain style elements in sanitized HTML')
    .option('--no-redact', 'disable sensitive-text and URL query redaction')
    .option('--dom-snapshot-file <path>', 'DOM snapshot JSON path relative to the artifact run')
    .option(
      '--html-manifest-file <path>',
      'HTML snapshot manifest path relative to the artifact run',
    )
    .option(
      '--fingerprint-file <path>',
      'element fingerprint JSON path relative to the artifact run',
    )
    .option('--bundle-file <path>', 'bundle manifest path relative to the artifact run')
    .option(
      '--html-directory <path>',
      'directory for sanitized frame HTML relative to the artifact run',
    )
    .action(async (url: string | undefined, options: SnapshotCommandOptions, command: Command) => {
      const resolved = await resolveForCommand(command);
      const global = globalOptions(command);
      const target = url ?? resolved.config.baseUrl;
      if (target === undefined) {
        throw new ToolkitError(
          'CLI_USAGE_ERROR',
          'snapshot requires a URL argument or configured baseUrl',
          { exitCode: 2 },
        );
      }
      const report = await snapshotCapturer(resolved.config, target, {
        command: 'snapshot',
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.waitUntil === undefined ? {} : { waitUntil: options.waitUntil }),
        scope: options.allElements === true ? 'all' : 'interactive',
        includeHidden: options.includeHidden ?? false,
        ...(options.maxElements === undefined ? {} : { maxElements: options.maxElements }),
        ...(options.maxFrameDepth === undefined ? {} : { maxFrameDepth: options.maxFrameDepth }),
        ...(options.textLimit === undefined ? {} : { textLimit: options.textLimit }),
        ...(options.maxFrameCharacters === undefined
          ? {}
          : { maxFrameCharacters: options.maxFrameCharacters }),
        includeStyles: options.includeStyles ?? false,
        redact: options.redact ?? true,
        ...(options.domSnapshotFile === undefined
          ? {}
          : { domSnapshotFile: options.domSnapshotFile }),
        ...(options.htmlManifestFile === undefined
          ? {}
          : { htmlManifestFile: options.htmlManifestFile }),
        ...(options.fingerprintFile === undefined
          ? {}
          : { fingerprintFile: options.fingerprintFile }),
        ...(options.bundleFile === undefined ? {} : { bundleFile: options.bundleFile }),
        ...(options.htmlDirectory === undefined ? {} : { htmlDirectory: options.htmlDirectory }),
      });
      writeOut(
        global.json === true
          ? `${JSON.stringify(report, null, 2)}\n`
          : `${formatSnapshotBundle(report)}\n`,
      );
    });

  const baseline = program
    .command('baseline')
    .description('capture, list, and inspect reusable versioned baselines');

  baseline
    .command('save')
    .description('capture a page and save a versioned reusable baseline')
    .argument('<name>', 'baseline name')
    .argument('[url]', 'URL to snapshot; defaults to baseUrl')
    .option(
      '--wait-until <state>',
      'navigation readiness state',
      parseWaitUntil,
      'domcontentloaded',
    )
    .option('--all-elements', 'fingerprint all recorded elements')
    .option('--include-hidden', 'include hidden elements in the DOM inventory')
    .option(
      '--max-elements <count>',
      'maximum number of recorded DOM elements',
      parsePositiveInteger,
    )
    .option(
      '--max-frame-depth <count>',
      'maximum child-frame traversal depth',
      parseNonNegativeInteger,
    )
    .option(
      '--text-limit <count>',
      'maximum characters retained per DOM text field',
      parseNonNegativeInteger,
    )
    .option(
      '--max-frame-characters <count>',
      'maximum sanitized HTML characters per frame',
      parsePositiveInteger,
    )
    .option('--include-styles', 'retain style elements in sanitized HTML')
    .option('--no-redact', 'disable sensitive-text and URL query redaction')
    .action(
      async (
        name: string,
        url: string | undefined,
        options: SnapshotCommandOptions,
        command: Command,
      ) => {
        const resolved = await resolveForCommand(command);
        const global = globalOptions(command);
        const target = url ?? resolved.config.baseUrl;
        if (target === undefined) {
          throw new ToolkitError(
            'CLI_USAGE_ERROR',
            'baseline save requires a URL argument or configured baseUrl',
            { exitCode: 2 },
          );
        }
        const report = await baselineCapturer(resolved.config, name, target, {
          command: 'baseline-save',
          name,
          ...(options.waitUntil === undefined ? {} : { waitUntil: options.waitUntil }),
          scope: options.allElements === true ? 'all' : 'interactive',
          includeHidden: options.includeHidden ?? false,
          ...(options.maxElements === undefined ? {} : { maxElements: options.maxElements }),
          ...(options.maxFrameDepth === undefined ? {} : { maxFrameDepth: options.maxFrameDepth }),
          ...(options.textLimit === undefined ? {} : { textLimit: options.textLimit }),
          ...(options.maxFrameCharacters === undefined
            ? {}
            : { maxFrameCharacters: options.maxFrameCharacters }),
          includeStyles: options.includeStyles ?? false,
          redact: options.redact ?? true,
        });
        writeOut(
          global.json === true
            ? `${JSON.stringify(report, null, 2)}\n`
            : `${formatBaselineSave(report)}\n`,
        );
      },
    );

  baseline
    .command('list')
    .description('list saved baselines')
    .action(async (_options: Record<string, never>, command: Command) => {
      const resolved = await resolveForCommand(command);
      const global = globalOptions(command);
      const baselines = await baselineLister(resolved.config);
      writeOut(
        global.json === true
          ? `${JSON.stringify(baselines, null, 2)}\n`
          : `${formatBaselineList(baselines)}\n`,
      );
    });

  baseline
    .command('show')
    .description('show one saved baseline manifest')
    .argument('<name>', 'baseline name')
    .option('--baseline-version <version>', 'specific version; defaults to latest')
    .action(async (name: string, options: BaselineShowCommandOptions, command: Command) => {
      const resolved = await resolveForCommand(command);
      const global = globalOptions(command);
      const record = await baselineLoader(resolved.config, name, options.version);
      writeOut(
        global.json === true
          ? `${JSON.stringify(record, null, 2)}\n`
          : `${formatBaselineRecord(record)}\n`,
      );
    });

  program
    .command('compare')
    .description('compare a saved baseline with a live page')
    .argument('<baseline>', 'saved baseline name')
    .argument('[url]', 'URL to compare; defaults to the baseline URL')
    .option('--baseline-version <version>', 'specific baseline version; defaults to latest')
    .option('--name <name>', 'optional artifact-run name')
    .option(
      '--wait-until <state>',
      'navigation readiness: load, domcontentloaded, networkidle, or commit',
      parseWaitUntil,
      'domcontentloaded',
    )
    .option('--all-elements', 'compare all recorded elements')
    .option('--include-hidden', 'include hidden elements in the current snapshot')
    .option('--max-elements <count>', 'maximum number of recorded elements', parsePositiveInteger)
    .option(
      '--max-frame-depth <count>',
      'maximum child-frame traversal depth',
      parseNonNegativeInteger,
    )
    .option(
      '--text-limit <count>',
      'maximum characters retained per text field',
      parseNonNegativeInteger,
    )
    .option('--no-redact', 'disable sensitive-text and URL query redaction')
    .option('--similarity-threshold <ratio>', 'fuzzy matching threshold from 0 to 1', parseRatio)
    .option('--include-unchanged', 'include unchanged matches in the JSON report')
    .option(
      '--max-replacements <count>',
      'maximum replacement locators per changed element',
      parseNonNegativeInteger,
    )
    .option(
      '--minimum-score <score>',
      'minimum replacement-locator score from 0 to 100',
      parseScore,
    )
    .option('--report-file <path>', 'comparison JSON path relative to the artifact run')
    .option('--fail-on-drift', 'return exit code 1 when DOM drift is detected')
    .action(
      async (
        baselineName: string,
        url: string | undefined,
        options: CompareCommandOptions,
        command: Command,
      ) => {
        const resolved = await resolveForCommand(command);
        const global = globalOptions(command);
        const report = await baselineComparer(resolved.config, baselineName, url, {
          command: 'compare',
          ...(options.name === undefined ? {} : { name: options.name }),
          ...(options.baselineVersion === undefined ? {} : { version: options.baselineVersion }),
          ...(options.waitUntil === undefined ? {} : { waitUntil: options.waitUntil }),
          ...(options.allElements === true ? { scope: 'all' as const } : {}),
          ...(options.includeHidden === undefined ? {} : { includeHidden: options.includeHidden }),
          ...(options.maxElements === undefined ? {} : { maxElements: options.maxElements }),
          ...(options.maxFrameDepth === undefined ? {} : { maxFrameDepth: options.maxFrameDepth }),
          ...(options.textLimit === undefined ? {} : { textLimit: options.textLimit }),
          ...(options.redact === undefined ? {} : { redact: options.redact }),
          ...(options.similarityThreshold === undefined
            ? {}
            : { similarityThreshold: options.similarityThreshold }),
          includeUnchanged: options.includeUnchanged ?? false,
          ...(options.maxReplacements === undefined
            ? {}
            : { maxReplacementLocators: options.maxReplacements }),
          ...(options.minimumScore === undefined
            ? {}
            : { minimumLocatorScore: options.minimumScore }),
          ...(options.reportFile === undefined ? {} : { reportFile: options.reportFile }),
        });
        writeOut(
          global.json === true
            ? `${JSON.stringify(report, null, 2)}\n`
            : `${formatDomComparison(report)}\n`,
        );
        setExitCode(comparisonExitCode(report, options.failOnDrift ?? false));
      },
    );

  program
    .command('validate')
    .description('validate a selector manifest against a live page')
    .argument('<manifest>', 'JSON or YAML selector manifest')
    .argument('[url]', 'URL to validate; overrides manifest url and baseUrl')
    .option('--name <name>', 'optional artifact-run name')
    .option(
      '--wait-until <state>',
      'navigation readiness: load, domcontentloaded, networkidle, or commit',
      parseWaitUntil,
    )
    .option('--report-file <path>', 'validation JSON path relative to the artifact run')
    .action(
      async (
        manifest: string,
        url: string | undefined,
        options: ValidateCommandOptions,
        command: Command,
      ) => {
        const resolved = await resolveForCommand(command);
        const global = globalOptions(command);
        const report = await selectorValidator(resolved.config, manifest, {
          command: 'validate',
          ...(options.name === undefined ? {} : { name: options.name }),
          ...(url === undefined ? {} : { url }),
          ...(options.waitUntil === undefined ? {} : { waitUntil: options.waitUntil }),
          ...(options.reportFile === undefined ? {} : { reportFile: options.reportFile }),
        });
        writeOut(
          global.json === true
            ? `${JSON.stringify(report, null, 2)}\n`
            : `${formatSelectorValidation(report)}\n`,
        );
        setExitCode(selectorValidationExitCode(report.summary));
      },
    );

  program
    .command('repair')
    .description('generate review-only replacement suggestions for failed selectors')
    .argument('<manifest>', 'JSON or YAML selector manifest')
    .argument('[url]', 'URL to inspect; overrides manifest url and baseUrl')
    .option('--name <name>', 'optional artifact-run name')
    .option(
      '--wait-until <state>',
      'navigation readiness: load, domcontentloaded, networkidle, or commit',
      parseWaitUntil,
    )
    .option('--provider <name>', 'advisor provider: none or openai', parseRepairProvider, 'none')
    .option('--model <model>', 'AI model; defaults to SELECTOR_AI_MODEL or gpt-5-mini')
    .option('--ai-timeout <ms>', 'AI advisor timeout in milliseconds', parsePositiveInteger)
    .option('--include-optional', 'include optional selector failures')
    .option('--max-suggestions <count>', 'maximum suggestions per selector', parsePositiveInteger)
    .option('--minimum-score <score>', 'minimum score required for a proposal', parseScore)
    .option('--all-elements', 'inspect all elements instead of interactive elements only')
    .option('--include-hidden', 'include hidden elements in repair matching')
    .option('--max-elements <count>', 'maximum number of recorded elements', parsePositiveInteger)
    .option('--max-frame-depth <count>', 'maximum child-frame depth', parseNonNegativeInteger)
    .option(
      '--text-limit <count>',
      'maximum characters retained per text field',
      parseNonNegativeInteger,
    )
    .option('--no-redact', 'disable sensitive-text and URL query redaction')
    .option('--report-file <path>', 'repair JSON path relative to the artifact run')
    .option('--proposal-file <path>', 'review-only YAML proposal path relative to the artifact run')
    .option('--fail-on-unresolved', 'return exit code 1 when required selectors remain unresolved')
    .action(
      async (
        manifest: string,
        url: string | undefined,
        options: RepairCommandOptions,
        command: Command,
      ) => {
        const resolved = await resolveForCommand(command);
        const global = globalOptions(command);
        const aiModel = options.model ?? env['SELECTOR_AI_MODEL'];
        const report = await selectorRepairer(resolved.config, manifest, {
          command: 'repair',
          ...(options.name === undefined ? {} : { name: options.name }),
          ...(url === undefined ? {} : { url }),
          ...(options.waitUntil === undefined ? {} : { waitUntil: options.waitUntil }),
          provider: options.provider ?? 'none',
          ...(aiModel === undefined ? {} : { model: aiModel }),
          ...(env['OPENAI_API_KEY'] === undefined ? {} : { apiKey: env['OPENAI_API_KEY'] }),
          ...(env['OPENAI_BASE_URL'] === undefined ? {} : { apiBaseUrl: env['OPENAI_BASE_URL'] }),
          ...(options.aiTimeout === undefined ? {} : { aiTimeoutMs: options.aiTimeout }),
          includeOptional: options.includeOptional ?? false,
          ...(options.maxSuggestions === undefined
            ? {}
            : { maxSuggestions: options.maxSuggestions }),
          ...(options.minimumScore === undefined ? {} : { minimumScore: options.minimumScore }),
          scope: options.allElements === true ? 'all' : 'interactive',
          includeHidden: options.includeHidden ?? false,
          ...(options.maxElements === undefined ? {} : { maxElements: options.maxElements }),
          ...(options.maxFrameDepth === undefined ? {} : { maxFrameDepth: options.maxFrameDepth }),
          ...(options.textLimit === undefined ? {} : { textLimit: options.textLimit }),
          redact: options.redact ?? true,
          ...(options.reportFile === undefined ? {} : { reportFile: options.reportFile }),
          ...(options.proposalFile === undefined ? {} : { proposalFile: options.proposalFile }),
        });
        writeOut(
          global.json === true
            ? `${JSON.stringify(report, null, 2)}\n`
            : `${formatSelectorRepair(report)}\n`,
        );
        setExitCode(selectorRepairExitCode(report, options.failOnUnresolved ?? false));
      },
    );

  program
    .command('evidence')
    .description('capture a packaged browser diagnostic evidence bundle')
    .argument('[url]', 'URL to inspect; defaults to baseUrl')
    .option('--name <name>', 'optional artifact-run name')
    .option(
      '--wait-until <state>',
      'navigation readiness: load, domcontentloaded, networkidle, or commit',
      parseWaitUntil,
      'domcontentloaded',
    )
    .option('--wait-after <ms>', 'additional wait after navigation', parseNonNegativeInteger)
    .option('--element <css>', 'capture an element screenshot; may be repeated', collectString, [])
    .option('--no-full-page', 'omit the full-page screenshot')
    .option('--no-viewport', 'omit the viewport screenshot')
    .option('--no-trace', 'omit the Playwright trace')
    .option('--no-console', 'omit console and page-error collection')
    .option('--no-network', 'omit failed-request and HTTP-error collection')
    .option('--no-dom-snapshot', 'omit the redacted DOM snapshot')
    .option('--no-html-snapshot', 'omit sanitized HTML snapshots')
    .option('--no-archive', 'do not package the evidence as a ZIP archive')
    .option(
      '--max-entries <count>',
      'maximum entries retained per event category',
      parsePositiveInteger,
    )
    .option(
      '--max-element-screenshots <count>',
      'maximum element screenshots across all selectors',
      parsePositiveInteger,
    )
    .option('--no-redact', 'disable text and URL redaction')
    .option('--report-file <path>', 'JSON evidence manifest relative to the artifact run')
    .option('--archive-file <path>', 'ZIP evidence archive relative to the artifact run')
    .option('--fail-on-page-error', 'return exit code 1 when a page error is captured')
    .option('--fail-on-request-failure', 'return exit code 1 when a request fails')
    .option('--fail-on-http-error', 'return exit code 1 when an HTTP response is 400 or greater')
    .action(async (url: string | undefined, options: EvidenceCommandOptions, command: Command) => {
      const resolved = await resolveForCommand(command);
      const global = globalOptions(command);
      const target = url ?? resolved.config.baseUrl;
      if (target === undefined) {
        throw new ToolkitError(
          'CLI_USAGE_ERROR',
          'evidence requires a URL argument or configured baseUrl',
          { exitCode: 2 },
        );
      }
      const report = await diagnosticEvidenceCapturer(resolved.config, target, {
        command: 'evidence',
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.waitUntil === undefined ? {} : { waitUntil: options.waitUntil }),
        ...(options.waitAfter === undefined ? {} : { waitAfterMs: options.waitAfter }),
        includeTrace: options.trace ?? true,
        includeConsole: options.console ?? true,
        includeNetwork: options.network ?? true,
        includeDomSnapshot: options.domSnapshot ?? true,
        includeHtmlSnapshot: options.htmlSnapshot ?? true,
        fullPageScreenshot: options.fullPage ?? true,
        viewportScreenshot: options.viewport ?? true,
        elementScreenshots: (options.element ?? []).map((selector, index) => ({
          id: `element-${index + 1}`,
          selector,
          maxMatches: 1,
        })),
        ...(options.maxEntries === undefined ? {} : { maxEntries: options.maxEntries }),
        ...(options.maxElementScreenshots === undefined
          ? {}
          : { maxElementScreenshots: options.maxElementScreenshots }),
        redact: options.redact ?? true,
        archive: options.archive ?? true,
        ...(options.reportFile === undefined ? {} : { reportFile: options.reportFile }),
        ...(options.archiveFile === undefined ? {} : { archiveFile: options.archiveFile }),
        failOnPageError: options.failOnPageError ?? false,
        failOnRequestFailure: options.failOnRequestFailure ?? false,
        failOnHttpError: options.failOnHttpError ?? false,
      });
      writeOut(
        global.json === true
          ? `${JSON.stringify(report, null, 2)}
`
          : `${formatDiagnosticEvidence(report)}
`,
      );
      setExitCode(diagnosticEvidenceExitCode(report));
    });

  program
    .command('report')
    .description('build a portable self-contained HTML report from toolkit JSON outputs')
    .argument('<inputs...>', 'JSON report files or artifact directories')
    .option('--name <name>', 'optional artifact-run name')
    .option('--title <title>', 'report title')
    .option('--output <path>', 'HTML output path relative to the artifact run')
    .option('--manifest <path>', 'JSON manifest path relative to the artifact run')
    .option('--no-embed-images', 'do not embed screenshots as data URIs')
    .option('--max-image-bytes <count>', 'maximum bytes per embedded image', parsePositiveInteger)
    .option('--max-items <count>', 'maximum rows rendered per report section', parsePositiveInteger)
    .option('--max-directory-depth <count>', 'maximum directory scan depth', parsePositiveInteger)
    .option('--no-interactive', 'render a static report without offline dashboard controls')
    .action(async (inputs: string[], options: ReportCommandOptions, command: Command) => {
      const resolved = await resolveForCommand(command);
      const global = globalOptions(command);
      const report = await htmlReportBuilder(resolved.config, inputs, {
        command: 'report',
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.title === undefined ? {} : { title: options.title }),
        ...(options.output === undefined ? {} : { outputFile: options.output }),
        ...(options.manifest === undefined ? {} : { manifestFile: options.manifest }),
        embedImages: options.embedImages ?? true,
        ...(options.maxImageBytes === undefined ? {} : { maxImageBytes: options.maxImageBytes }),
        ...(options.maxItems === undefined ? {} : { maxItemsPerSection: options.maxItems }),
        ...(options.maxDirectoryDepth === undefined
          ? {}
          : { maxDirectoryDepth: options.maxDirectoryDepth }),
        interactive: options.interactive ?? true,
      });
      writeOut(
        global.json === true
          ? `${JSON.stringify(report, null, 2)}
`
          : `${formatHtmlReport(report)}
`,
      );
    });

  const browser = program.command('browser').description('inspect browser and session behavior');

  browser
    .command('inspect')
    .description('launch a managed browser session and inspect a URL')
    .argument('[url]', 'URL to inspect; defaults to baseUrl or about:blank')
    .option('--name <name>', 'optional artifact-run name')
    .option(
      '--wait-until <state>',
      'navigation readiness: load, domcontentloaded, networkidle, or commit',
      parseWaitUntil,
      'domcontentloaded',
    )
    .action(
      async (url: string | undefined, options: BrowserInspectCommandOptions, command: Command) => {
        const resolved = await resolveForCommand(command);
        const global = globalOptions(command);
        const target = url ?? resolved.config.baseUrl ?? 'about:blank';
        const report = await browserInspector(resolved.config, target, {
          command: 'browser-inspect',
          ...(options.name === undefined ? {} : { name: options.name }),
          ...(options.waitUntil === undefined ? {} : { waitUntil: options.waitUntil }),
        });
        writeOut(
          global.json === true
            ? `${JSON.stringify(report, null, 2)}\n`
            : `${formatBrowserInspection(report)}\n`,
        );
      },
    );

  const artifacts = program
    .command('artifacts')
    .description('manage structured artifact output directories');

  artifacts
    .command('init')
    .description('create a new timestamped artifact run directory')
    .option('--name <name>', 'optional human-readable run name')
    .action(async (options: ArtifactInitCommandOptions, command: Command) => {
      const resolved = await resolveForCommand(command);
      const global = globalOptions(command);
      const run = await artifactRunCreator(resolved.config, {
        command: 'artifacts-init',
        ...(options.name === undefined ? {} : { name: options.name }),
      });
      writeOut(
        global.json === true ? `${JSON.stringify(run, null, 2)}\n` : `${formatArtifactRun(run)}\n`,
      );
    });

  return program;
}

export async function runCli(
  argv = process.argv,
  dependencies: CliDependencies = {},
): Promise<void> {
  const program = createProgram(dependencies);
  await program.parseAsync(argv);
}
