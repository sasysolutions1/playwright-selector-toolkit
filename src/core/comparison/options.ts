import { ComparisonError } from '../../errors/toolkit-error.js';
import type { DomComparisonOptions, ResolvedDomComparisonOptions } from '../../types/comparison.js';

export const DEFAULT_DOM_COMPARISON_OPTIONS: ResolvedDomComparisonOptions = {
  similarityThreshold: 0.62,
  includeUnchanged: false,
  maxReplacementLocators: 3,
  minimumLocatorScore: 50,
};

export function resolveDomComparisonOptions(
  options: DomComparisonOptions = {},
): ResolvedDomComparisonOptions {
  const resolved = {
    similarityThreshold:
      options.similarityThreshold ?? DEFAULT_DOM_COMPARISON_OPTIONS.similarityThreshold,
    includeUnchanged: options.includeUnchanged ?? DEFAULT_DOM_COMPARISON_OPTIONS.includeUnchanged,
    maxReplacementLocators:
      options.maxReplacementLocators ?? DEFAULT_DOM_COMPARISON_OPTIONS.maxReplacementLocators,
    minimumLocatorScore:
      options.minimumLocatorScore ?? DEFAULT_DOM_COMPARISON_OPTIONS.minimumLocatorScore,
  };

  if (
    !Number.isFinite(resolved.similarityThreshold) ||
    resolved.similarityThreshold < 0 ||
    resolved.similarityThreshold > 1
  ) {
    throw new ComparisonError(
      'COMPARISON_OPTIONS_INVALID',
      'similarityThreshold must be between 0 and 1',
      { details: { similarityThreshold: resolved.similarityThreshold }, exitCode: 2 },
    );
  }
  if (
    !Number.isSafeInteger(resolved.maxReplacementLocators) ||
    resolved.maxReplacementLocators < 0
  ) {
    throw new ComparisonError(
      'COMPARISON_OPTIONS_INVALID',
      'maxReplacementLocators must be a non-negative integer',
      { details: { maxReplacementLocators: resolved.maxReplacementLocators }, exitCode: 2 },
    );
  }
  if (
    !Number.isFinite(resolved.minimumLocatorScore) ||
    resolved.minimumLocatorScore < 0 ||
    resolved.minimumLocatorScore > 100
  ) {
    throw new ComparisonError(
      'COMPARISON_OPTIONS_INVALID',
      'minimumLocatorScore must be between 0 and 100',
      { details: { minimumLocatorScore: resolved.minimumLocatorScore }, exitCode: 2 },
    );
  }
  return resolved;
}
