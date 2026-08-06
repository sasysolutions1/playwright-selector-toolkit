import { extname } from 'node:path';
import { LocatorError, ToolkitError } from '../../errors/toolkit-error.js';
import type { BrowserSessionHandle, OpenBrowserSessionOptions } from '../../types/browser.js';
import type { ToolkitConfig } from '../../types/config.js';
import type { DomSnapshot } from '../../types/dom.js';
import type {
  ElementLocatorCandidates,
  LocatorAnalysisOptions,
  LocatorAnalysisReport,
} from '../../types/locator.js';
import { writeJsonArtifact } from '../artifacts/manager.js';
import { openBrowserSession } from '../browser/session.js';
import { crawlDomSnapshot } from '../dom/crawler.js';
import { generateLocatorCandidates } from './candidates.js';
import { evaluateLocatorCandidates } from './evaluator.js';
import { resolveLocatorGenerationOptions } from './options.js';
import { createLocatorReport } from './report.js';

export interface LocatorAnalysisDependencies {
  readonly openSession?: (
    config: ToolkitConfig,
    options?: OpenBrowserSessionOptions,
  ) => Promise<BrowserSessionHandle>;
  readonly crawler?: (
    page: BrowserSessionHandle['page'],
    requestedUrl: string,
    options: LocatorAnalysisOptions,
  ) => Promise<DomSnapshot>;
  readonly generator?: (
    snapshot: DomSnapshot,
    options: LocatorAnalysisOptions,
  ) => readonly ElementLocatorCandidates[];
  readonly evaluator?: (
    page: BrowserSessionHandle['page'],
    snapshot: DomSnapshot,
    elements: readonly ElementLocatorCandidates[],
  ) => Promise<readonly ElementLocatorCandidates[]>;
  readonly writeArtifact?: (
    run: BrowserSessionHandle['artifactRun'],
    relativePath: string,
    value: unknown,
  ) => Promise<string>;
}

function jsonFile(value: string | undefined, fallback: string, field: string): string {
  const path = value ?? fallback;
  if (extname(path).toLowerCase() !== '.json') {
    throw new LocatorError('LOCATOR_REPORT_FAILED', `${field} must end in .json`, {
      details: { [field]: path },
      exitCode: 2,
    });
  }
  return path;
}

export async function analyzeLocators(
  config: ToolkitConfig,
  url: string,
  options: LocatorAnalysisOptions = {},
  dependencies: LocatorAnalysisDependencies = {},
): Promise<LocatorAnalysisReport> {
  const session = await (dependencies.openSession ?? openBrowserSession)(config, {
    command: options.command ?? 'locators',
    ...(options.name === undefined ? {} : { name: options.name }),
  });

  try {
    const navigation = await session.navigate(url, options.waitUntil ?? 'domcontentloaded');
    const snapshot = await (dependencies.crawler ?? crawlDomSnapshot)(session.page, url, {
      ...options,
      ...(session.plugins === undefined ? {} : { pluginHost: session.plugins }),
    });
    const generationOptions = resolveLocatorGenerationOptions(options);
    const generated = (dependencies.generator ?? generateLocatorCandidates)(snapshot, {
      ...options,
      ...(session.plugins === undefined ? {} : { pluginHost: session.plugins }),
    });
    const elements = generationOptions.liveTest
      ? await (dependencies.evaluator ?? evaluateLocatorCandidates)(
          session.page,
          snapshot,
          generated,
        )
      : generated;
    const locatorReport = createLocatorReport(snapshot, elements, options);
    const writer = dependencies.writeArtifact ?? writeJsonArtifact;
    const snapshotPath = await writer(
      session.artifactRun,
      jsonFile(options.snapshotFile, 'snapshots/dom-snapshot.json', 'snapshotFile'),
      snapshot,
    );
    const candidatePath = await writer(
      session.artifactRun,
      jsonFile(options.candidateFile, 'reports/locator-candidates.json', 'candidateFile'),
      locatorReport,
    );
    const summary = session.summary();
    const close = await session.close({ success: true });

    return {
      navigation,
      session: summary,
      artifactRun: session.artifactRun,
      snapshotPath,
      candidatePath,
      domSummary: snapshot.summary,
      summary: locatorReport.summary,
      failures: snapshot.failures,
      warnings: [...locatorReport.warnings, ...close.warnings],
      recommendations: locatorReport.recommendations,
      close,
    };
  } catch (error) {
    await session.close({ success: false, reason: 'Locator analysis failed' });
    if (
      error instanceof ToolkitError ||
      (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        String(error.code).startsWith('LOCATOR_'))
    ) {
      throw error;
    }
    throw new LocatorError(
      'LOCATOR_GENERATION_FAILED',
      `Could not generate locator candidates at ${url}`,
      { cause: error, details: { url } },
    );
  }
}
