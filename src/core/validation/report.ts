import type {
  SelectorManifest,
  SelectorValidationReport,
  SelectorValidationResult,
} from '../../types/validation.js';
import { getToolkitVersion } from '../version.js';
import { summarizeSelectorValidation } from './evaluator.js';

export function createSelectorValidationReport(input: {
  readonly manifest: SelectorManifest;
  readonly manifestPath: string;
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly title: string;
  readonly results: readonly SelectorValidationResult[];
  readonly toolkitVersion?: string;
  readonly now?: Date;
}): SelectorValidationReport {
  const summary = summarizeSelectorValidation(input.results);
  const warnings = input.results
    .filter((result) => !result.required && result.status !== 'pass')
    .map((result) => `Optional selector ${result.id} did not pass (${result.status}).`);
  return {
    schemaVersion: '1.0',
    toolkitVersion: input.toolkitVersion ?? getToolkitVersion(),
    generatedAt: (input.now ?? new Date()).toISOString(),
    manifestPath: input.manifestPath,
    manifestName: input.manifest.name,
    requestedUrl: input.requestedUrl,
    finalUrl: input.finalUrl,
    title: input.title,
    summary,
    results: input.results,
    warnings,
  };
}
