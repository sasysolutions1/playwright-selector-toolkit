import { SnapshotError } from '../../errors/toolkit-error.js';
import type { ResolvedSanitizedHtmlOptions, SanitizedHtmlOptions } from '../../types/snapshot.js';

export const DEFAULT_SANITIZED_HTML_OPTIONS: ResolvedSanitizedHtmlOptions = {
  redact: true,
  maxFrameDepth: 8,
  maxFrameCharacters: 2_000_000,
  includeStyles: false,
};

function integerInRange(
  value: number | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new SnapshotError(
      'SNAPSHOT_OPTIONS_INVALID',
      `${name} must be an integer between ${minimum} and ${maximum}`,
      { details: { name, value, minimum, maximum }, exitCode: 2 },
    );
  }
  return value;
}

export function resolveSanitizedHtmlOptions(
  input: SanitizedHtmlOptions = {},
): ResolvedSanitizedHtmlOptions {
  return {
    redact: input.redact ?? DEFAULT_SANITIZED_HTML_OPTIONS.redact,
    maxFrameDepth: integerInRange(
      input.maxFrameDepth,
      DEFAULT_SANITIZED_HTML_OPTIONS.maxFrameDepth,
      'maxFrameDepth',
      0,
      32,
    ),
    maxFrameCharacters: integerInRange(
      input.maxFrameCharacters,
      DEFAULT_SANITIZED_HTML_OPTIONS.maxFrameCharacters,
      'maxFrameCharacters',
      1_000,
      20_000_000,
    ),
    includeStyles: input.includeStyles ?? DEFAULT_SANITIZED_HTML_OPTIONS.includeStyles,
  };
}
