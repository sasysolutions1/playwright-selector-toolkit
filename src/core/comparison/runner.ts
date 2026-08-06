import { readFile } from 'node:fs/promises';
import { ComparisonError } from '../../errors/toolkit-error.js';
import type { ToolkitConfig } from '../../types/config.js';
import type { DomComparisonRunOptions, DomComparisonRunReport } from '../../types/comparison.js';
import type { DomSnapshot } from '../../types/dom.js';
import { writeJsonArtifact } from '../artifacts/manager.js';
import { captureSnapshotBundle } from '../snapshot/bundle.js';
import { loadBaselineSnapshot } from './baseline.js';
import { compareDomSnapshots } from './compare.js';

async function readCurrentSnapshot(path: string): Promise<DomSnapshot> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as DomSnapshot;
  } catch (error) {
    throw new ComparisonError(
      'COMPARISON_CAPTURE_FAILED',
      `Could not read current DOM snapshot: ${path}`,
      {
        cause: error,
        details: { path },
      },
    );
  }
}

export async function compareBaselineToUrl(
  config: ToolkitConfig,
  baselineName: string,
  url?: string,
  options: DomComparisonRunOptions = {},
): Promise<DomComparisonRunReport> {
  const loaded = await loadBaselineSnapshot(config, baselineName, options.version);
  const target = url ?? loaded.baseline.manifest.finalUrl;
  const baselineOptions = loaded.domSnapshot.options;

  const currentSnapshot = await captureSnapshotBundle(config, target, {
    command: options.command ?? 'compare',
    name: options.name ?? baselineName,
    ...(options.waitUntil === undefined ? {} : { waitUntil: options.waitUntil }),
    scope: options.scope ?? baselineOptions.scope,
    includeHidden: options.includeHidden ?? baselineOptions.includeHidden,
    maxElements: options.maxElements ?? baselineOptions.maxElements,
    maxFrameDepth: options.maxFrameDepth ?? baselineOptions.maxFrameDepth,
    textLimit: options.textLimit ?? baselineOptions.textLimit,
    redact: options.redact ?? baselineOptions.redact,
  });
  const currentDom = await readCurrentSnapshot(currentSnapshot.domSnapshotPath);
  const comparison = compareDomSnapshots(
    loaded.baseline.name,
    loaded.baseline.version,
    loaded.domSnapshot,
    currentDom,
    options,
  );
  const reportPath = await writeJsonArtifact(
    currentSnapshot.artifactRun,
    options.reportFile ?? 'reports/dom-comparison.json',
    comparison,
  );

  return {
    baseline: loaded.baseline,
    currentSnapshot,
    artifactRun: currentSnapshot.artifactRun,
    reportPath,
    comparison,
    close: currentSnapshot.close,
  };
}

export function comparisonExitCode(
  report: Pick<DomComparisonRunReport, 'comparison'>,
  failOnDrift = false,
): number {
  return failOnDrift && report.comparison.summary.driftDetected ? 1 : 0;
}
