import { extname } from 'node:path';
import { ValidationError, ToolkitError } from '../../errors/toolkit-error.js';
import type { BrowserSessionHandle, OpenBrowserSessionOptions } from '../../types/browser.js';
import type { ToolkitConfig } from '../../types/config.js';
import type {
  LoadedSelectorManifest,
  SelectorValidationOptions,
  SelectorValidationRunReport,
} from '../../types/validation.js';
import { writeJsonArtifact } from '../artifacts/manager.js';
import { openBrowserSession } from '../browser/session.js';
import { validateManifestSelectors } from './evaluator.js';
import { loadSelectorManifest } from './manifest.js';
import { createSelectorValidationReport } from './report.js';

export interface SelectorValidationDependencies {
  readonly loadManifest?: (path: string) => Promise<LoadedSelectorManifest>;
  readonly openSession?: (
    config: ToolkitConfig,
    options?: OpenBrowserSessionOptions,
  ) => Promise<BrowserSessionHandle>;
  readonly writeArtifact?: (
    run: BrowserSessionHandle['artifactRun'],
    relativePath: string,
    value: unknown,
  ) => Promise<string>;
}

function reportFile(value: string | undefined): string {
  const path = value ?? 'reports/selector-validation.json';
  if (extname(path).toLowerCase() !== '.json') {
    throw new ValidationError('VALIDATION_REPORT_FAILED', 'reportFile must end in .json', {
      details: { reportFile: path },
      exitCode: 2,
    });
  }
  return path;
}

export async function runSelectorValidation(
  config: ToolkitConfig,
  manifestPath: string,
  options: SelectorValidationOptions = {},
  dependencies: SelectorValidationDependencies = {},
): Promise<SelectorValidationRunReport> {
  const loaded = await (dependencies.loadManifest ?? loadSelectorManifest)(manifestPath);
  const url = options.url ?? loaded.manifest.url ?? config.baseUrl;
  if (url === undefined) {
    throw new ValidationError(
      'VALIDATION_TARGET_REQUIRED',
      'Validation requires a URL argument, manifest url, or configured baseUrl',
      { exitCode: 2 },
    );
  }
  const session = await (dependencies.openSession ?? openBrowserSession)(config, {
    command: options.command ?? 'validate',
    ...(options.name === undefined ? {} : { name: options.name }),
  });
  try {
    const navigation = await session.navigate(url, options.waitUntil ?? loaded.manifest.waitUntil);
    const results = await validateManifestSelectors(session.page, loaded.manifest);
    const report = createSelectorValidationReport({
      manifest: loaded.manifest,
      manifestPath: loaded.sourcePath,
      requestedUrl: url,
      finalUrl: navigation.finalUrl,
      title: navigation.title,
      results,
    });
    const reportPath = await (dependencies.writeArtifact ?? writeJsonArtifact)(
      session.artifactRun,
      reportFile(options.reportFile),
      report,
    );
    const summary = session.summary();
    const close = await session.close({
      success: report.summary.success,
      reason: report.summary.success ? 'Selector validation passed' : 'Selector validation failed',
    });
    return {
      navigation,
      session: summary,
      artifactRun: session.artifactRun,
      manifestPath: loaded.sourcePath,
      reportPath,
      summary: report.summary,
      results: report.results,
      warnings: [...report.warnings, ...close.warnings],
      close,
    };
  } catch (error) {
    await session.close({ success: false, reason: 'Selector validation crashed' });
    if (error instanceof ToolkitError) throw error;
    throw new ValidationError('VALIDATION_FAILED', `Could not validate selectors at ${url}`, {
      cause: error,
      details: { url, manifestPath: loaded.sourcePath },
    });
  }
}
