import { LocatorError } from '../../errors/toolkit-error.js';
import type {
  LocatorGenerationOptions,
  ResolvedLocatorGenerationOptions,
} from '../../types/locator.js';

export const DEFAULT_TEST_ID_ATTRIBUTES = [
  'data-testid',
  'data-test-id',
  'data-test',
  'data-qa',
  'data-cy',
] as const;

export const DEFAULT_LOCATOR_GENERATION_OPTIONS: ResolvedLocatorGenerationOptions = {
  maxCandidatesPerElement: 12,
  includeXPath: true,
  includeRoleWithoutName: true,
  testIdAttributes: DEFAULT_TEST_ID_ATTRIBUTES,
  liveTest: true,
  minimumRecommendedScore: 50,
};

export function resolveLocatorGenerationOptions(
  options: LocatorGenerationOptions = {},
): ResolvedLocatorGenerationOptions {
  const maxCandidatesPerElement =
    options.maxCandidatesPerElement ?? DEFAULT_LOCATOR_GENERATION_OPTIONS.maxCandidatesPerElement;
  if (
    !Number.isSafeInteger(maxCandidatesPerElement) ||
    maxCandidatesPerElement <= 0 ||
    maxCandidatesPerElement > 100
  ) {
    throw new LocatorError(
      'LOCATOR_OPTIONS_INVALID',
      'maxCandidatesPerElement must be an integer between 1 and 100',
      { details: { maxCandidatesPerElement }, exitCode: 2 },
    );
  }

  const testIdAttributes = (options.testIdAttributes ?? DEFAULT_TEST_ID_ATTRIBUTES).map((value) =>
    value.toLowerCase(),
  );
  if (
    testIdAttributes.length === 0 ||
    testIdAttributes.some((value) => !/^data-[a-z0-9_-]+$/u.test(value))
  ) {
    throw new LocatorError(
      'LOCATOR_OPTIONS_INVALID',
      'testIdAttributes must contain one or more valid data-* attribute names',
      { details: { testIdAttributes }, exitCode: 2 },
    );
  }

  const minimumRecommendedScore =
    options.minimumRecommendedScore ?? DEFAULT_LOCATOR_GENERATION_OPTIONS.minimumRecommendedScore;
  if (
    !Number.isFinite(minimumRecommendedScore) ||
    minimumRecommendedScore < 0 ||
    minimumRecommendedScore > 100
  ) {
    throw new LocatorError(
      'LOCATOR_OPTIONS_INVALID',
      'minimumRecommendedScore must be a number between 0 and 100',
      { details: { minimumRecommendedScore }, exitCode: 2 },
    );
  }

  return {
    maxCandidatesPerElement,
    includeXPath: options.includeXPath ?? true,
    includeRoleWithoutName: options.includeRoleWithoutName ?? true,
    testIdAttributes: [...new Set(testIdAttributes)],
    liveTest: options.liveTest ?? true,
    minimumRecommendedScore,
  };
}
