import type {
  ComparedElementSummary,
  ComparisonElementInput,
  DomComparisonOptions,
  DomComparisonReport,
  DomComparisonSummary,
  ElementChangeField,
  ElementDifference,
  ElementMatchMethod,
  MatchedElementDifference,
  ReplacementLocatorSuggestion,
} from '../../types/comparison.js';
import type { DomElementSnapshot, DomSnapshot } from '../../types/dom.js';
import type { ElementFingerprintIndex } from '../../types/snapshot.js';
import { generateElementLocatorCandidates } from '../locator/candidates.js';
import { rankElementLocatorCandidates } from '../locator/stability.js';
import { recommendedCandidate } from '../locator/stability.js';
import { createElementFingerprintIndex } from '../snapshot/fingerprint.js';
import { getToolkitVersion } from '../version.js';
import { resolveDomComparisonOptions } from './options.js';
import { elementSimilarity } from './similarity.js';

interface MatchPair {
  readonly baseline: ComparisonElementInput;
  readonly current: ComparisonElementInput;
  readonly method: ElementMatchMethod;
  readonly similarity: number;
}

function flattenSnapshot(
  snapshot: DomSnapshot,
  fingerprints: ElementFingerprintIndex,
): readonly ComparisonElementInput[] {
  const elements = new Map(
    snapshot.frames.flatMap((frame) =>
      frame.elements.map((element) => [element.id, element] as const),
    ),
  );
  return fingerprints.records.flatMap((record) => {
    const element = elements.get(record.elementId);
    return element === undefined
      ? []
      : [
          {
            element,
            semanticHash: record.semanticHash,
            structuralHash: record.structuralHash,
            semanticOrdinal: record.semanticOrdinal,
          },
        ];
  });
}

function elementSummary(element: DomElementSnapshot): ComparedElementSummary {
  return {
    elementId: element.id,
    framePath: element.framePath,
    shadowPath: element.shadowPath,
    domPath: element.domPath,
    tagName: element.tagName,
    kind: element.kind,
    role: element.role,
    accessibleName: element.accessibleName,
    label: element.label,
    placeholder: element.placeholder,
    attributes: element.attributes,
    visible: element.visibility.visible,
  };
}

function equality(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changedFields(left: DomElementSnapshot, right: DomElementSnapshot): ElementChangeField[] {
  const changes: ElementChangeField[] = [];
  const checks: readonly [ElementChangeField, unknown, unknown][] = [
    ['framePath', left.framePath, right.framePath],
    ['shadowPath', left.shadowPath, right.shadowPath],
    ['domPath', left.domPath, right.domPath],
    ['tagName', left.tagName, right.tagName],
    ['kind', left.kind, right.kind],
    ['role', left.role, right.role],
    ['accessibleName', left.accessibleName, right.accessibleName],
    ['text', left.text, right.text],
    ['label', left.label, right.label],
    ['placeholder', left.placeholder, right.placeholder],
    ['attributes', left.attributes, right.attributes],
    ['visible', left.visibility.visible, right.visibility.visible],
    ['disabled', left.disabled, right.disabled],
    ['readonly', left.readonly, right.readonly],
    ['required', left.required, right.required],
    ['checked', left.checked, right.checked],
    ['selected', left.selected, right.selected],
    ['interactive', left.interactive, right.interactive],
  ];
  for (const [field, baselineValue, currentValue] of checks) {
    if (!equality(baselineValue, currentValue)) changes.push(field);
  }
  return changes;
}

function moved(fields: readonly ElementChangeField[]): boolean {
  return (
    fields.includes('framePath') || fields.includes('shadowPath') || fields.includes('domPath')
  );
}

function contentChanged(fields: readonly ElementChangeField[]): boolean {
  return fields.some((field) => !['framePath', 'shadowPath', 'domPath'].includes(field));
}

function replacementLocators(
  element: DomElementSnapshot,
  maximum: number,
  minimumScore: number,
): readonly ReplacementLocatorSuggestion[] {
  if (maximum === 0) return [];
  const ranked = rankElementLocatorCandidates(generateElementLocatorCandidates(element), {
    liveTest: false,
    minimumRecommendedScore: minimumScore,
    maxCandidatesPerElement: Math.max(maximum, 8),
  });
  const preferred = recommendedCandidate(ranked);
  const ordered = [
    ...(preferred === null ? [] : [preferred]),
    ...ranked.candidates.filter((candidate) => candidate.id !== preferred?.id),
  ];
  return ordered
    .filter((candidate) => (candidate.stability?.score ?? 0) >= minimumScore)
    .slice(0, maximum)
    .map((candidate) => ({
      playwright: candidate.playwright,
      strategy: candidate.strategy,
      score: candidate.stability?.score ?? 0,
      confidence: candidate.stability?.confidence ?? 'low',
      rationale: candidate.rationale,
      warnings: candidate.warnings,
    }));
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    groups.set(value, [...(groups.get(value) ?? []), item]);
  }
  return groups;
}

function exactMatches(
  baseline: readonly ComparisonElementInput[],
  current: readonly ComparisonElementInput[],
  baselineUsed: Set<string>,
  currentUsed: Set<string>,
): MatchPair[] {
  const matches: MatchPair[] = [];
  const currentStructural = groupBy(current, (item) => item.structuralHash);
  for (const before of baseline) {
    if (baselineUsed.has(before.element.id)) continue;
    const candidates = (currentStructural.get(before.structuralHash) ?? []).filter(
      (item) => !currentUsed.has(item.element.id),
    );
    if (candidates.length === 0) continue;
    const after =
      candidates.find((item) => item.semanticHash === before.semanticHash) ?? candidates[0];
    if (after === undefined) continue;
    baselineUsed.add(before.element.id);
    currentUsed.add(after.element.id);
    matches.push({ baseline: before, current: after, method: 'structural', similarity: 1 });
  }

  const currentSemantic = groupBy(current, (item) => item.semanticHash);
  for (const before of baseline) {
    if (baselineUsed.has(before.element.id)) continue;
    const candidates = (currentSemantic.get(before.semanticHash) ?? []).filter(
      (item) => !currentUsed.has(item.element.id),
    );
    if (candidates.length === 0) continue;
    const after =
      candidates.find((item) => item.semanticOrdinal === before.semanticOrdinal) ?? candidates[0];
    if (after === undefined) continue;
    baselineUsed.add(before.element.id);
    currentUsed.add(after.element.id);
    matches.push({ baseline: before, current: after, method: 'semantic', similarity: 1 });
  }
  return matches;
}

function similarityMatches(
  baseline: readonly ComparisonElementInput[],
  current: readonly ComparisonElementInput[],
  baselineUsed: Set<string>,
  currentUsed: Set<string>,
  threshold: number,
): MatchPair[] {
  const candidates: Array<{
    before: ComparisonElementInput;
    after: ComparisonElementInput;
    score: number;
  }> = [];
  for (const before of baseline) {
    if (baselineUsed.has(before.element.id)) continue;
    for (const after of current) {
      if (currentUsed.has(after.element.id)) continue;
      const score = elementSimilarity(before.element, after.element);
      if (score >= threshold) candidates.push({ before, after, score });
    }
  }
  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      left.before.element.id.localeCompare(right.before.element.id) ||
      left.after.element.id.localeCompare(right.after.element.id),
  );
  const matches: MatchPair[] = [];
  for (const candidate of candidates) {
    if (
      baselineUsed.has(candidate.before.element.id) ||
      currentUsed.has(candidate.after.element.id)
    ) {
      continue;
    }
    baselineUsed.add(candidate.before.element.id);
    currentUsed.add(candidate.after.element.id);
    matches.push({
      baseline: candidate.before,
      current: candidate.after,
      method: 'similarity',
      similarity: candidate.score,
    });
  }
  return matches;
}

function summarize(
  differences: readonly ElementDifference[],
  baselineCount: number,
  currentCount: number,
): DomComparisonSummary {
  const matched = differences.filter((item) => !['added', 'removed'].includes(item.kind));
  const count = (kind: ElementDifference['kind']) =>
    differences.filter((item) => item.kind === kind).length;
  const methods: Record<ElementMatchMethod, number> = { structural: 0, semantic: 0, similarity: 0 };
  for (const item of matched) {
    if ('matchMethod' in item) methods[item.matchMethod] += 1;
  }
  const driftElementCount = differences.filter((item) => item.kind !== 'unchanged').length;
  return {
    baselineElementCount: baselineCount,
    currentElementCount: currentCount,
    matchedElementCount: matched.length,
    unchangedElementCount: count('unchanged'),
    addedElementCount: count('added'),
    removedElementCount: count('removed'),
    movedElementCount: count('moved'),
    changedElementCount: count('changed'),
    movedAndChangedElementCount: count('moved-and-changed'),
    driftElementCount,
    driftDetected: driftElementCount > 0,
    matchMethods: methods,
  };
}

export function compareDomSnapshots(
  baselineName: string,
  baselineVersion: string,
  baselineSnapshot: DomSnapshot,
  currentSnapshot: DomSnapshot,
  options: DomComparisonOptions = {},
): DomComparisonReport {
  const resolved = resolveDomComparisonOptions(options);
  const baselineInputs = flattenSnapshot(
    baselineSnapshot,
    createElementFingerprintIndex(baselineSnapshot),
  );
  const currentInputs = flattenSnapshot(
    currentSnapshot,
    createElementFingerprintIndex(currentSnapshot),
  );
  const baselineUsed = new Set<string>();
  const currentUsed = new Set<string>();
  const matches = [
    ...exactMatches(baselineInputs, currentInputs, baselineUsed, currentUsed),
    ...similarityMatches(
      baselineInputs,
      currentInputs,
      baselineUsed,
      currentUsed,
      resolved.similarityThreshold,
    ),
  ];

  const differences: ElementDifference[] = [];
  for (const match of matches) {
    const fields = changedFields(match.baseline.element, match.current.element);
    const didMove = moved(fields);
    const didChange = contentChanged(fields);
    const kind: MatchedElementDifference['kind'] = didMove
      ? didChange
        ? 'moved-and-changed'
        : 'moved'
      : didChange
        ? 'changed'
        : 'unchanged';
    if (kind === 'unchanged' && !resolved.includeUnchanged) continue;
    differences.push({
      kind,
      matchMethod: match.method,
      similarity: match.similarity,
      baseline: elementSummary(match.baseline.element),
      current: elementSummary(match.current.element),
      changedFields: fields,
      moved: didMove,
      replacementLocators:
        kind === 'unchanged'
          ? []
          : replacementLocators(
              match.current.element,
              resolved.maxReplacementLocators,
              resolved.minimumLocatorScore,
            ),
    });
  }

  for (const before of baselineInputs) {
    if (!baselineUsed.has(before.element.id)) {
      differences.push({ kind: 'removed', baseline: elementSummary(before.element) });
    }
  }
  for (const after of currentInputs) {
    if (!currentUsed.has(after.element.id)) {
      differences.push({
        kind: 'added',
        current: elementSummary(after.element),
        replacementLocators: replacementLocators(
          after.element,
          resolved.maxReplacementLocators,
          resolved.minimumLocatorScore,
        ),
      });
    }
  }

  const kindOrder: Readonly<Record<ElementDifference['kind'], number>> = {
    removed: 0,
    changed: 1,
    'moved-and-changed': 2,
    moved: 3,
    added: 4,
    unchanged: 5,
  };
  differences.sort((left, right) => {
    const kindDifference = kindOrder[left.kind] - kindOrder[right.kind];
    if (kindDifference !== 0) return kindDifference;
    const leftId = 'baseline' in left ? left.baseline.elementId : left.current.elementId;
    const rightId = 'baseline' in right ? right.baseline.elementId : right.current.elementId;
    return leftId.localeCompare(rightId);
  });

  const completeDifferences: ElementDifference[] = resolved.includeUnchanged
    ? differences
    : [
        ...differences,
        ...matches
          .filter(
            (match) => changedFields(match.baseline.element, match.current.element).length === 0,
          )
          .map<MatchedElementDifference>((match) => ({
            kind: 'unchanged',
            matchMethod: match.method,
            similarity: match.similarity,
            baseline: elementSummary(match.baseline.element),
            current: elementSummary(match.current.element),
            changedFields: [],
            moved: false,
            replacementLocators: [],
          })),
      ];
  const summary = summarize(completeDifferences, baselineInputs.length, currentInputs.length);

  return {
    schemaVersion: '1.0',
    toolkitVersion: getToolkitVersion(),
    generatedAt: new Date().toISOString(),
    baseline: {
      name: baselineName,
      version: baselineVersion,
      capturedAt: baselineSnapshot.capturedAt,
      finalUrl: baselineSnapshot.finalUrl,
      title: baselineSnapshot.title,
    },
    current: {
      capturedAt: currentSnapshot.capturedAt,
      finalUrl: currentSnapshot.finalUrl,
      title: currentSnapshot.title,
    },
    options: resolved,
    summary,
    differences: resolved.includeUnchanged
      ? completeDifferences
      : completeDifferences.filter((item) => item.kind !== 'unchanged'),
    warnings: [
      ...baselineSnapshot.warnings.map((warning) => `Baseline: ${warning}`),
      ...currentSnapshot.warnings.map((warning) => `Current: ${warning}`),
    ],
  };
}
