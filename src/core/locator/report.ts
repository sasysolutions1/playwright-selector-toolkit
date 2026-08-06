import type { DomSnapshot } from '../../types/dom.js';
import type {
  ElementLocatorCandidates,
  LocatorGenerationOptions,
  LocatorGenerationSummary,
  LocatorRecommendationSummary,
  LocatorReport,
} from '../../types/locator.js';
import { getToolkitVersion } from '../version.js';
import { resolveLocatorGenerationOptions } from './options.js';
import { rankLocatorCandidates, recommendedCandidate } from './stability.js';

export function collectLocatorRecommendations(
  elements: readonly ElementLocatorCandidates[],
): readonly LocatorRecommendationSummary[] {
  return elements.flatMap((element) => {
    const candidate = recommendedCandidate(element);
    if (candidate?.stability === null || candidate?.stability === undefined) return [];
    return [
      {
        elementId: element.element.id,
        elementKind: element.element.kind,
        framePath: element.element.framePath,
        playwright: candidate.playwright,
        strategy: candidate.strategy,
        score: candidate.stability.score,
        confidence: candidate.stability.confidence,
      },
    ];
  });
}

export function summarizeLocatorCandidates(
  elements: readonly ElementLocatorCandidates[],
): LocatorGenerationSummary {
  const strategies: Record<string, number> = {};
  let candidateCount = 0;
  let testedCandidateCount = 0;
  let uniqueCandidateCount = 0;
  let multipleCandidateCount = 0;
  let missingCandidateCount = 0;
  let errorCandidateCount = 0;
  let elementsWithUniqueCandidate = 0;
  let elementsWithoutCandidates = 0;
  let recommendedLocatorCount = 0;
  let highConfidenceCandidateCount = 0;
  let mediumConfidenceCandidateCount = 0;
  let lowConfidenceCandidateCount = 0;
  let stabilityScoreTotal = 0;
  let stabilityScoreCount = 0;

  for (const element of elements) {
    if (element.candidates.length === 0) elementsWithoutCandidates += 1;
    if (element.recommendedCandidateId !== null) recommendedLocatorCount += 1;
    if (element.candidates.some((candidate) => candidate.evaluation.status === 'unique')) {
      elementsWithUniqueCandidate += 1;
    }
    for (const candidate of element.candidates) {
      candidateCount += 1;
      strategies[candidate.strategy] = (strategies[candidate.strategy] ?? 0) + 1;
      if (candidate.evaluation.status !== 'not-tested') testedCandidateCount += 1;
      if (candidate.evaluation.status === 'unique') uniqueCandidateCount += 1;
      if (candidate.evaluation.status === 'multiple') multipleCandidateCount += 1;
      if (candidate.evaluation.status === 'none') missingCandidateCount += 1;
      if (candidate.evaluation.status === 'error') errorCandidateCount += 1;
      if (candidate.stability !== null) {
        stabilityScoreTotal += candidate.stability.score;
        stabilityScoreCount += 1;
        if (candidate.stability.confidence === 'high') highConfidenceCandidateCount += 1;
        if (candidate.stability.confidence === 'medium') mediumConfidenceCandidateCount += 1;
        if (candidate.stability.confidence === 'low') lowConfidenceCandidateCount += 1;
      }
    }
  }

  return {
    elementCount: elements.length,
    candidateCount,
    testedCandidateCount,
    uniqueCandidateCount,
    multipleCandidateCount,
    missingCandidateCount,
    errorCandidateCount,
    elementsWithUniqueCandidate,
    elementsWithoutCandidates,
    strategies,
    recommendedLocatorCount,
    elementsWithRecommendation: recommendedLocatorCount,
    elementsWithoutRecommendation: elements.length - recommendedLocatorCount,
    highConfidenceCandidateCount,
    mediumConfidenceCandidateCount,
    lowConfidenceCandidateCount,
    averageStabilityScore:
      stabilityScoreCount === 0 ? 0 : Math.round(stabilityScoreTotal / stabilityScoreCount),
  };
}

export function createLocatorReport(
  snapshot: DomSnapshot,
  elements: readonly ElementLocatorCandidates[],
  options: LocatorGenerationOptions = {},
  dependencies: { readonly now?: () => Date; readonly toolkitVersion?: () => string } = {},
): LocatorReport {
  const warnings = [...snapshot.warnings];
  if (snapshot.options.redact) {
    warnings.push(
      'Candidates derived from redacted values are omitted because they cannot match the live page.',
    );
  }

  const rankedElements = rankLocatorCandidates(elements, options);

  return {
    schemaVersion: '1.1',
    toolkitVersion: dependencies.toolkitVersion?.() ?? getToolkitVersion(),
    generatedAt: (dependencies.now?.() ?? new Date()).toISOString(),
    requestedUrl: snapshot.requestedUrl,
    finalUrl: snapshot.finalUrl,
    title: snapshot.title,
    options: resolveLocatorGenerationOptions(options),
    domSummary: snapshot.summary,
    summary: summarizeLocatorCandidates(rankedElements),
    elements: rankedElements,
    failures: snapshot.failures,
    warnings,
    recommendations: collectLocatorRecommendations(rankedElements),
  };
}
