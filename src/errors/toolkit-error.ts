export type ToolkitErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_READ_FAILED'
  | 'CONFIG_PARSE_FAILED'
  | 'CONFIG_INVALID'
  | 'ARTIFACT_DIRECTORY_FAILED'
  | 'ARTIFACT_PATH_INVALID'
  | 'BROWSER_LAUNCH_FAILED'
  | 'BROWSER_CONTEXT_FAILED'
  | 'BROWSER_PROFILE_IN_USE'
  | 'BROWSER_PROFILE_LOCK_FAILED'
  | 'BROWSER_STORAGE_STATE_FAILED'
  | 'BROWSER_TRACE_FAILED'
  | 'BROWSER_NAVIGATION_FAILED'
  | 'BROWSER_SESSION_CLOSED'
  | 'DOM_OPTIONS_INVALID'
  | 'DOM_CRAWL_FAILED'
  | 'DOM_SNAPSHOT_FAILED'
  | 'LOCATOR_OPTIONS_INVALID'
  | 'LOCATOR_GENERATION_FAILED'
  | 'LOCATOR_EVALUATION_FAILED'
  | 'LOCATOR_REPORT_FAILED'
  | 'VALIDATION_MANIFEST_READ_FAILED'
  | 'VALIDATION_MANIFEST_PARSE_FAILED'
  | 'VALIDATION_MANIFEST_INVALID'
  | 'VALIDATION_TARGET_REQUIRED'
  | 'VALIDATION_FAILED'
  | 'VALIDATION_REPORT_FAILED'
  | 'SNAPSHOT_OPTIONS_INVALID'
  | 'SNAPSHOT_CAPTURE_FAILED'
  | 'HTML_SNAPSHOT_FAILED'
  | 'FINGERPRINT_FAILED'
  | 'BASELINE_NAME_INVALID'
  | 'BASELINE_SAVE_FAILED'
  | 'BASELINE_NOT_FOUND'
  | 'BASELINE_READ_FAILED'
  | 'COMPARISON_OPTIONS_INVALID'
  | 'COMPARISON_BASELINE_READ_FAILED'
  | 'COMPARISON_CAPTURE_FAILED'
  | 'COMPARISON_REPORT_FAILED'
  | 'DIAGNOSTIC_OPTIONS_INVALID'
  | 'DIAGNOSTIC_CAPTURE_FAILED'
  | 'DIAGNOSTIC_ARCHIVE_FAILED'
  | 'DIAGNOSTIC_OPERATION_FAILED'
  | 'REPORT_OPTIONS_INVALID'
  | 'REPORT_SOURCE_REQUIRED'
  | 'REPORT_SOURCE_READ_FAILED'
  | 'REPORT_SOURCE_UNSUPPORTED'
  | 'REPORT_RENDER_FAILED'
  | 'PLUGIN_SPECIFIER_INVALID'
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_LOAD_FAILED'
  | 'PLUGIN_EXPORT_MISSING'
  | 'PLUGIN_INVALID'
  | 'PLUGIN_API_UNSUPPORTED'
  | 'PLUGIN_DUPLICATE'
  | 'PLUGIN_HOOK_FAILED'
  | 'PLUGIN_HOOK_TIMEOUT'
  | 'PLUGIN_REPORT_FAILED'
  | 'REPAIR_OPTIONS_INVALID'
  | 'REPAIR_ADVISOR_FAILED'
  | 'REPAIR_REPORT_FAILED'
  | 'REPAIR_PROPOSAL_FAILED'
  | 'REPAIR_FAILED'
  | 'COMPATIBILITY_REVIEW_FAILED'
  | 'SECURITY_REVIEW_FAILED'
  | 'RELEASE_PACKAGE_FAILED'
  | 'MONITOR_MANIFEST_READ_FAILED'
  | 'MONITOR_MANIFEST_PARSE_FAILED'
  | 'MONITOR_MANIFEST_INVALID'
  | 'MONITOR_STATE_READ_FAILED'
  | 'MONITOR_STATE_WRITE_FAILED'
  | 'MONITOR_HISTORY_READ_FAILED'
  | 'MONITOR_HISTORY_WRITE_FAILED'
  | 'MONITOR_HISTORY_QUERY_FAILED'
  | 'MONITOR_NOTIFICATION_FAILED'
  | 'MONITOR_RUN_FAILED'
  | 'MONITOR_WATCH_FAILED'
  | 'CLI_USAGE_ERROR'
  | 'UNKNOWN_ERROR';

export interface ToolkitErrorOptions {
  readonly cause?: unknown;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly exitCode?: number;
}

export class ToolkitError extends Error {
  readonly code: ToolkitErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  readonly exitCode: number;

  constructor(code: ToolkitErrorCode, message: string, options: ToolkitErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ToolkitError';
    this.code = code;
    this.details = options.details ?? {};
    this.exitCode = options.exitCode ?? 1;
  }
}

export class ConfigError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      'CONFIG_NOT_FOUND' | 'CONFIG_READ_FAILED' | 'CONFIG_PARSE_FAILED' | 'CONFIG_INVALID'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'ConfigError';
  }
}

export class ArtifactError extends ToolkitError {
  constructor(
    code: Extract<ToolkitErrorCode, 'ARTIFACT_DIRECTORY_FAILED' | 'ARTIFACT_PATH_INVALID'>,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'ArtifactError';
  }
}

export class BrowserError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      | 'BROWSER_LAUNCH_FAILED'
      | 'BROWSER_CONTEXT_FAILED'
      | 'BROWSER_PROFILE_IN_USE'
      | 'BROWSER_PROFILE_LOCK_FAILED'
      | 'BROWSER_STORAGE_STATE_FAILED'
      | 'BROWSER_TRACE_FAILED'
      | 'BROWSER_NAVIGATION_FAILED'
      | 'BROWSER_SESSION_CLOSED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'BrowserError';
  }
}

export class DomError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      'DOM_OPTIONS_INVALID' | 'DOM_CRAWL_FAILED' | 'DOM_SNAPSHOT_FAILED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'DomError';
  }
}

export class LocatorError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      | 'LOCATOR_OPTIONS_INVALID'
      | 'LOCATOR_GENERATION_FAILED'
      | 'LOCATOR_EVALUATION_FAILED'
      | 'LOCATOR_REPORT_FAILED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'LocatorError';
  }
}

export class ValidationError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      | 'VALIDATION_MANIFEST_READ_FAILED'
      | 'VALIDATION_MANIFEST_PARSE_FAILED'
      | 'VALIDATION_MANIFEST_INVALID'
      | 'VALIDATION_TARGET_REQUIRED'
      | 'VALIDATION_FAILED'
      | 'VALIDATION_REPORT_FAILED'
      | 'SNAPSHOT_OPTIONS_INVALID'
      | 'SNAPSHOT_CAPTURE_FAILED'
      | 'HTML_SNAPSHOT_FAILED'
      | 'FINGERPRINT_FAILED'
      | 'BASELINE_NAME_INVALID'
      | 'BASELINE_SAVE_FAILED'
      | 'BASELINE_NOT_FOUND'
      | 'BASELINE_READ_FAILED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'ValidationError';
  }
}

export class SnapshotError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      | 'SNAPSHOT_OPTIONS_INVALID'
      | 'SNAPSHOT_CAPTURE_FAILED'
      | 'HTML_SNAPSHOT_FAILED'
      | 'FINGERPRINT_FAILED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'SnapshotError';
  }
}

export class BaselineError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      | 'BASELINE_NAME_INVALID'
      | 'BASELINE_SAVE_FAILED'
      | 'BASELINE_NOT_FOUND'
      | 'BASELINE_READ_FAILED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'BaselineError';
  }
}

export class ComparisonError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      | 'COMPARISON_OPTIONS_INVALID'
      | 'COMPARISON_BASELINE_READ_FAILED'
      | 'COMPARISON_CAPTURE_FAILED'
      | 'COMPARISON_REPORT_FAILED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'ComparisonError';
  }
}

export class DiagnosticError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      | 'DIAGNOSTIC_OPTIONS_INVALID'
      | 'DIAGNOSTIC_CAPTURE_FAILED'
      | 'DIAGNOSTIC_ARCHIVE_FAILED'
      | 'DIAGNOSTIC_OPERATION_FAILED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'DiagnosticError';
  }
}

export class PluginError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      | 'PLUGIN_SPECIFIER_INVALID'
      | 'PLUGIN_NOT_FOUND'
      | 'PLUGIN_LOAD_FAILED'
      | 'PLUGIN_EXPORT_MISSING'
      | 'PLUGIN_INVALID'
      | 'PLUGIN_API_UNSUPPORTED'
      | 'PLUGIN_DUPLICATE'
      | 'PLUGIN_HOOK_FAILED'
      | 'PLUGIN_HOOK_TIMEOUT'
      | 'PLUGIN_REPORT_FAILED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'PluginError';
  }
}

export class RepairError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      | 'REPAIR_OPTIONS_INVALID'
      | 'REPAIR_ADVISOR_FAILED'
      | 'REPAIR_REPORT_FAILED'
      | 'REPAIR_PROPOSAL_FAILED'
      | 'REPAIR_FAILED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'RepairError';
  }
}

export class ReportError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      | 'REPORT_OPTIONS_INVALID'
      | 'REPORT_SOURCE_REQUIRED'
      | 'REPORT_SOURCE_READ_FAILED'
      | 'REPORT_SOURCE_UNSUPPORTED'
      | 'REPORT_RENDER_FAILED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'ReportError';
  }
}

export class ReleaseError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      'COMPATIBILITY_REVIEW_FAILED' | 'SECURITY_REVIEW_FAILED' | 'RELEASE_PACKAGE_FAILED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'ReleaseError';
  }
}

export class MonitoringError extends ToolkitError {
  constructor(
    code: Extract<
      ToolkitErrorCode,
      | 'MONITOR_MANIFEST_READ_FAILED'
      | 'MONITOR_MANIFEST_PARSE_FAILED'
      | 'MONITOR_MANIFEST_INVALID'
      | 'MONITOR_STATE_READ_FAILED'
      | 'MONITOR_STATE_WRITE_FAILED'
      | 'MONITOR_HISTORY_READ_FAILED'
      | 'MONITOR_HISTORY_WRITE_FAILED'
      | 'MONITOR_HISTORY_QUERY_FAILED'
      | 'MONITOR_NOTIFICATION_FAILED'
      | 'MONITOR_RUN_FAILED'
      | 'MONITOR_WATCH_FAILED'
    >,
    message: string,
    options: ToolkitErrorOptions = {},
  ) {
    super(code, message, options);
    this.name = 'MonitoringError';
  }
}

export interface ErrorReport {
  readonly name: string;
  readonly code: ToolkitErrorCode;
  readonly message: string;
  readonly exitCode: number;
  readonly details: Readonly<Record<string, unknown>>;
}

export function normalizeError(error: unknown): ToolkitError {
  if (error instanceof ToolkitError) {
    return error;
  }

  if (error instanceof Error) {
    return new ToolkitError('UNKNOWN_ERROR', error.message, { cause: error });
  }

  return new ToolkitError('UNKNOWN_ERROR', String(error));
}

export function toErrorReport(error: unknown): ErrorReport {
  const normalized = normalizeError(error);

  return {
    name: normalized.name,
    code: normalized.code,
    message: normalized.message,
    exitCode: normalized.exitCode,
    details: normalized.details,
  };
}
