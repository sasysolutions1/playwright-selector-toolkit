export {
  createArtifactRun,
  ensureArtifactRoot,
  resolveArtifactPath,
  writeJsonArtifact,
  writeTextArtifact,
} from './core/artifacts/manager.js';
export { CONFIG_FILENAMES, findConfigFile, readConfigFile } from './core/config/discovery.js';
export { readEnvironmentConfig } from './core/config/environment.js';
export { DEFAULT_TOOLKIT_CONFIG, resolveToolkitConfig } from './core/config/resolver.js';
export { doctorExitCode, runDoctor } from './core/doctor.js';
export {
  inspectBrowserSession,
  ManagedBrowserSession,
  openBrowserSession,
  withBrowserSession,
} from './core/browser/session.js';
export { acquireBrowserProfileLock } from './core/browser/profile-lock.js';
export { getPlaywrightBrowserType, launchBrowserRuntime } from './core/browser/runtime.js';
export { registerGracefulShutdown } from './core/browser/shutdown.js';
export { crawlDomSnapshot, summarizeDomSnapshot } from './core/dom/crawler.js';
export { discoverDom } from './core/dom/discovery.js';
export { analyzeLocators } from './core/locator/analysis.js';
export {
  generateElementLocatorCandidates,
  generateLocatorCandidates,
} from './core/locator/candidates.js';
export { evaluateLocatorCandidates, locatorFromSpec, mapFrames } from './core/locator/evaluator.js';
export {
  domPathToXPath,
  escapeCssIdentifier,
  quoteCssAttribute,
  quoteJavaScript,
  quoteXPath,
} from './core/locator/escaping.js';
export {
  DEFAULT_LOCATOR_GENERATION_OPTIONS,
  DEFAULT_TEST_ID_ATTRIBUTES,
  resolveLocatorGenerationOptions,
} from './core/locator/options.js';
export {
  collectLocatorRecommendations,
  createLocatorReport,
  summarizeLocatorCandidates,
} from './core/locator/report.js';
export {
  analyzeIdentifier,
  isStructuralSelector,
  rankElementLocatorCandidates,
  rankLocatorCandidates,
  recommendedCandidate,
} from './core/locator/stability.js';
export { serializePlaywrightLocator, serializeRelativeLocator } from './core/locator/serializer.js';
export { inspectFrameDocument } from './core/dom/frame-script.js';
export { DEFAULT_DOM_CRAWL_OPTIONS, resolveDomCrawlOptions } from './core/dom/options.js';
export { redactSensitiveText, sanitizeUrl } from './core/dom/redaction.js';
export { getToolkitVersion } from './core/version.js';

export { monitorManifestSchema } from './core/monitoring/schema.js';
export { loadMonitorManifest } from './core/monitoring/manifest.js';
export {
  createEmptyMonitorState,
  emptyTargetState,
  loadMonitorState,
  saveMonitorState,
} from './core/monitoring/state.js';
export {
  advanceMonitorTargetState,
  monitorTargetIsDue,
  recordMonitorNotificationAttempt,
} from './core/monitoring/incidents.js';
export {
  createMonitorNotification,
  createNotificationAdapter,
  deliverMonitorNotification,
} from './core/monitoring/notifications.js';
export type {
  MonitorNotificationAdapter,
  NotificationAdapterDependencies,
} from './core/monitoring/notifications.js';
export {
  defaultMonitorStatePath,
  loadMonitorStatus,
  monitorCycleExitCode,
  runMonitorCycle,
  watchMonitor,
} from './core/monitoring/runner.js';
export type { MonitorRunnerDependencies } from './core/monitoring/runner.js';
export {
  appendMonitorHistory,
  buildMonitorHistoryReport,
  defaultMonitorHistoryPath,
  historyRecordsFromCycle,
  loadMonitorHistory,
  pruneMonitorHistory,
} from './core/monitoring/history.js';

export { definePlugin, validatePluginDefinition } from './core/plugins/definition.js';
export { loadPlugin, loadPlugins, resolvePluginSpecifier } from './core/plugins/loader.js';
export { PluginHost } from './core/plugins/host.js';
export { createPluginHost } from './core/plugins/runtime.js';
export { inspectConfiguredPlugins } from './core/plugins/report.js';

export { createDiagnosticArchive } from './core/diagnostics/archive.js';
export { DiagnosticRecorder } from './core/diagnostics/collector.js';
export { captureDiagnosticPageMetadata } from './core/diagnostics/metadata.js';
export {
  DEFAULT_DIAGNOSTIC_EVIDENCE_OPTIONS,
  resolveDiagnosticEvidenceOptions,
} from './core/diagnostics/options.js';
export {
  captureDiagnosticEvidence,
  diagnosticEvidenceExitCode,
  runWithDiagnosticEvidence,
  withFailureEvidence,
} from './core/diagnostics/runner.js';
export { captureDiagnosticScreenshots } from './core/diagnostics/screenshots.js';
export { buildHtmlReport } from './core/report/runner.js';
export { collectHtmlReportImages } from './core/report/images.js';
export { summarizeHtmlReportSource } from './core/report/model.js';
export { DEFAULT_HTML_REPORT_OPTIONS, resolveHtmlReportOptions } from './core/report/options.js';
export { renderPortableHtmlReport } from './core/report/render.js';
export { detectHtmlReportSource, loadHtmlReportSources } from './core/report/sources.js';

export {
  DEFAULT_SANITIZED_HTML_OPTIONS,
  resolveSanitizedHtmlOptions,
} from './core/snapshot/options.js';
export { serializeSanitizedFrameHtml } from './core/snapshot/frame-html-script.js';
export { captureSanitizedHtml, summarizeSanitizedHtml } from './core/snapshot/html.js';
export {
  createElementFingerprintIndex,
  semanticElementFingerprint,
  semanticFingerprintPayload,
  structuralElementFingerprint,
  structuralFingerprintPayload,
  summarizeElementFingerprints,
} from './core/snapshot/fingerprint.js';
export { captureSnapshotBundle } from './core/snapshot/bundle.js';
export { captureBaseline } from './core/baseline/capture.js';
export { loadBaselineSnapshot } from './core/comparison/baseline.js';
export { compareDomSnapshots } from './core/comparison/compare.js';
export { elementSimilarity } from './core/comparison/similarity.js';
export {
  DEFAULT_DOM_COMPARISON_OPTIONS,
  resolveDomComparisonOptions,
} from './core/comparison/options.js';
export { compareBaselineToUrl, comparisonExitCode } from './core/comparison/runner.js';
export {
  baselineDisplayPath,
  baselineRoot,
  listBaselines,
  loadBaseline,
  saveBaseline,
  validateBaselineName,
} from './core/baseline/store.js';
export { createProgram, runCli } from './cli/program.js';
export {
  formatArtifactRun,
  formatBrowserInspection,
  formatCliError,
  formatDoctorReport,
  formatDomDiscovery,
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
  formatMonitorCycle,
  formatMonitorState,
  formatMonitorWatch,
  formatMonitorHistory,
  formatMonitorHistoryPrune,
} from './cli/output.js';
export {
  ArtifactError,
  BrowserError,
  DomError,
  LocatorError,
  SnapshotError,
  BaselineError,
  ComparisonError,
  DiagnosticError,
  ReportError,
  PluginError,
  RepairError,
  ReleaseError,
  MonitoringError,
  ValidationError,
  ConfigError,
  ToolkitError,
  normalizeError,
  toErrorReport,
} from './errors/toolkit-error.js';
export type {
  ArtifactRun,
  ArtifactRunDirectories,
  CreateArtifactRunOptions,
} from './types/artifacts.js';
export type {
  BrowserName,
  PluginFailureMode,
  ConfigSourceSummary,
  ResolveConfigOptions,
  ResolvedToolkitConfig,
  ScreenshotMode,
  ToolkitConfig,
  ToolkitConfigInput,
  TraceMode,
  ViewportConfig,
} from './types/config.js';
export type { DoctorCheck, DoctorOptions, DoctorReport, DoctorStatus } from './types/doctor.js';
export type { ErrorReport, ToolkitErrorCode, ToolkitErrorOptions } from './errors/toolkit-error.js';

export type {
  BrowserInspectionReport,
  BrowserNavigationResult,
  BrowserProfileLock,
  BrowserProfileLockOwner,
  BrowserRuntime,
  BrowserSessionCloseOptions,
  BrowserSessionCloseResult,
  BrowserSessionHandle,
  BrowserSessionMode,
  BrowserSessionSummary,
  GracefulShutdownOptions,
  NavigationWaitUntil,
  OpenBrowserSessionOptions,
} from './types/browser.js';

export type {
  DomBoundingBox,
  DomCrawlOptions,
  DomDiscoveryOptions,
  DomDiscoveryReport,
  DomElementKind,
  DomElementScope,
  DomElementSnapshot,
  DomFrameSnapshot,
  DomInteractivitySource,
  DomSnapshot,
  DomSnapshotFailure,
  DomSnapshotSummary,
  DomVisibility,
  DomVisibilityReason,
  FrameDocumentPayload,
  ResolvedDomCrawlOptions,
} from './types/dom.js';

export type {
  ElementLocatorCandidates,
  LocatorAnalysisOptions,
  LocatorConfidence,
  LocatorAnalysisReport,
  LocatorCandidate,
  LocatorEvaluation,
  LocatorEvaluationStatus,
  LocatorGenerationOptions,
  LocatorGenerationSummary,
  LocatorRecommendationSummary,
  LocatorReport,
  LocatorRoleSpec,
  LocatorSelectorSpec,
  LocatorSpec,
  LocatorStability,
  LocatorStabilitySignal,
  LocatorStabilitySignalCode,
  LocatorStrategy,
  LocatorTestIdSpec,
  LocatorTextSpec,
  ResolvedLocatorGenerationOptions,
} from './types/locator.js';

export { loadSelectorManifest } from './core/validation/manifest.js';
export {
  selectorValidationExitCode,
  summarizeSelectorValidation,
  validateManifestSelectors,
} from './core/validation/evaluator.js';
export { createSelectorValidationReport } from './core/validation/report.js';
export { runSelectorValidation } from './core/validation/runner.js';
export { runSelectorRepair, selectorRepairExitCode } from './core/repair/runner.js';
export { createRepairAdvisor, DeterministicRepairAdvisor } from './core/repair/advisor.js';
export { OpenAiRepairAdvisor } from './core/repair/openai.js';
export type { OpenAiRepairAdvisorOptions } from './core/repair/openai.js';
export { DEFAULT_REPAIR_OPTIONS, resolveSelectorRepairOptions } from './core/repair/options.js';
export {
  buildDeterministicRepairCandidates,
  applyAdvisorRanking,
  toAdvisorCandidates,
} from './core/repair/matcher.js';
export { createRepairProposalManifest, serializeRepairProposal } from './core/repair/proposal.js';
export { createSelectorRepairReport, summarizeSelectorRepairs } from './core/repair/report.js';
export { selectorManifestSchema } from './core/validation/schema.js';
export type {
  AssertionValidationStatus,
  LoadedSelectorManifest,
  SelectorAssertionResult,
  SelectorAssertions,
  SelectorCountRange,
  SelectorManifest,
  SelectorManifestEntry,
  SelectorObservedState,
  SelectorValidationOptions,
  SelectorValidationReport,
  SelectorValidationResult,
  SelectorValidationRunReport,
  SelectorValidationStatus,
  SelectorValidationSummary,
  ValidationPresenceMode,
} from './types/validation.js';

export type {
  BaselineManifest,
  BaselineRecord,
  BaselineSaveReport,
  BaselineSummary,
  ElementFingerprintIndex,
  ElementFingerprintRecord,
  ElementFingerprintSummary,
  FrameHtmlPayload,
  ResolvedSanitizedHtmlOptions,
  SanitizedHtmlCapture,
  SanitizedHtmlFrameArtifact,
  SanitizedHtmlFrameCapture,
  SanitizedHtmlFrameStats,
  SanitizedHtmlOptions,
  SanitizedHtmlSnapshotManifest,
  SanitizedHtmlSnapshotSummary,
  SnapshotBundleManifest,
  SnapshotBundleOptions,
  SnapshotBundleReport,
  SnapshotHashAlgorithm,
} from './types/snapshot.js';

export type {
  AddedElementDifference,
  ComparedElementSummary,
  ComparisonElementInput,
  DomComparisonOptions,
  DomComparisonReport,
  DomComparisonRunOptions,
  DomComparisonRunReport,
  DomComparisonSummary,
  ElementChangeField,
  ElementDifference,
  ElementDifferenceKind,
  ElementMatchMethod,
  LoadedBaselineSnapshot,
  MatchedElementDifference,
  RemovedElementDifference,
  ReplacementLocatorSuggestion,
  ResolvedDomComparisonOptions,
} from './types/comparison.js';

export type {
  DiagnosticConsoleEntry,
  DiagnosticElementScreenshotRequest,
  DiagnosticEvidenceExecution,
  DiagnosticEvidenceFiles,
  DiagnosticEvidenceManifest,
  DiagnosticEvidenceOptions,
  DiagnosticEvidenceReport,
  DiagnosticFailure,
  DiagnosticHttpErrorEntry,
  DiagnosticLocation,
  DiagnosticOperation,
  DiagnosticPageErrorEntry,
  DiagnosticPageMetadata,
  DiagnosticRecorderSnapshot,
  DiagnosticRecorderSummary,
  DiagnosticRequestFailureEntry,
  DiagnosticScreenshotArtifact,
  DiagnosticScreenshotFailure,
  DiagnosticScreenshotReport,
  ResolvedDiagnosticEvidenceOptions,
} from './types/diagnostics.js';

export type {
  HtmlReportBuildReport,
  HtmlReportImage,
  HtmlReportManifest,
  HtmlReportOptions,
  HtmlReportSource,
  HtmlReportSourceData,
  HtmlReportSourceKind,
  HtmlReportSourceSummary,
  ResolvedHtmlReportOptions,
} from './types/html-report.js';

export type {
  LoadedPlugin,
  PluginAuthenticationContext,
  PluginAuthenticationHook,
  PluginAuthenticationResult,
  PluginBaseContext,
  PluginDiagnosticEvent,
  PluginGeneratedLocatorCandidate,
  PluginHookKind,
  PluginHookStatus,
  PluginHostLike,
  PluginHostReport,
  PluginLocatorCandidateGenerator,
  PluginLocatorCandidateInput,
  PluginLocatorContext,
  PluginLogger,
  PluginMetadata,
  PluginPageStateContext,
  PluginPageStateDetector,
  PluginPageStateMatch,
  PluginRedactionContext,
  PluginRedactor,
  PluginRuntimeOptions,
  PluginSetupContext,
  SelectorToolkitPlugin,
} from './types/plugins.js';

export type {
  RepairAdvisor,
  RepairAdvisorCandidate,
  RepairAdvisorRecommendation,
  RepairAdvisorRequest,
  RepairAdvisorResponse,
  RepairElementSummary,
  RepairProviderName,
  RepairSuggestionSource,
  ResolvedSelectorRepairOptions,
  SelectorRepairItem,
  SelectorRepairOptions,
  SelectorRepairReport,
  SelectorRepairRunReport,
  SelectorRepairSuggestion,
  SelectorRepairSummary,
} from './types/repair.js';

export {
  compareVersions,
  compatibilityExitCode,
  parseVersion,
  runCompatibilityReview,
} from './core/release/compatibility.js';
export {
  runSecurityReview,
  scanRepositorySecrets,
  securityReviewExitCode,
} from './core/release/security.js';
export type {
  CompatibilityReport,
  CompatibilityReviewOptions,
  CompatibilityRuntime,
  PackageVerificationReport,
  ParsedVersion,
  ReviewCheck,
  ReviewStatus,
  ReviewSummary,
  SecurityFinding,
  SecurityReviewOptions,
  SecurityReviewReport,
} from './types/release.js';

export type {
  LoadedMonitorManifest,
  MonitorCycleReport,
  MonitorCycleSummary,
  MonitorEscalationPolicy,
  MonitorEventType,
  MonitorHealthOutcome,
  MonitorHistoryPruneOptions,
  MonitorHistoryPruneReport,
  MonitorHistoryQueryOptions,
  MonitorHistoryRecord,
  MonitorHistoryReport,
  MonitorHistorySummary,
  MonitorHistoryWindow,
  MonitorDailyTrend,
  MonitorIncidentTrend,
  MonitorTargetTrendSummary,
  MonitorIncident,
  MonitorIncidentStatus,
  MonitorManifest,
  MonitorNotification,
  MonitorNotificationAdapterConfig,
  MonitorNotificationAdapterType,
  MonitorNotificationResult,
  MonitorNotificationStatus,
  MonitorRunOptions,
  MonitorSeverity,
  MonitorState,
  MonitorTarget,
  MonitorTargetRunResult,
  MonitorTargetState,
  MonitorTransition,
  MonitorWatchOptions,
  MonitorWatchReport,
} from './types/monitoring.js';
