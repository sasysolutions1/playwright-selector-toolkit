import type {
  ElementLocatorCandidates,
  LocatorCandidate,
  LocatorConfidence,
  LocatorSpec,
} from '../../types/locator.js';
import type { RepairAdvisorCandidate, SelectorRepairSuggestion } from '../../types/repair.js';
import type { SelectorManifestEntry } from '../../types/validation.js';

const WORD = /[a-z0-9]+/giu;

function tokens(value: string | null | undefined): ReadonlySet<string> {
  return new Set((value?.toLowerCase().match(WORD) ?? []).filter((token) => token.length > 1));
}

function jaccard(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function locatorText(spec: LocatorSpec): string {
  switch (spec.type) {
    case 'role':
      return `${spec.role} ${spec.name ?? ''}`;
    case 'label':
    case 'placeholder':
    case 'text':
      return spec.value;
    case 'test-id':
      return `${spec.attribute} ${spec.value}`;
    case 'attribute':
    case 'css':
    case 'xpath':
      return spec.selector;
  }
}

function expectedRole(entry: SelectorManifestEntry): string | null {
  if (entry.locator.type === 'role') return entry.locator.role;
  const raw = locatorText(entry.locator).toLowerCase();
  if (/button|submit/u.test(raw)) return 'button';
  if (/checkbox/u.test(raw)) return 'checkbox';
  if (/radio/u.test(raw)) return 'radio';
  if (/select|combobox/u.test(raw)) return 'combobox';
  if (/input|email|password|textbox|textarea/u.test(raw)) return 'textbox';
  if (/link|anchor/u.test(raw)) return 'link';
  return null;
}

function implicitRole(element: ElementLocatorCandidates['element']): string | null {
  if (element.role !== null) return element.role;
  switch (element.kind) {
    case 'button':
      return 'button';
    case 'link':
      return 'link';
    case 'checkbox':
      return 'checkbox';
    case 'radio':
      return 'radio';
    case 'select':
      return 'combobox';
    case 'text-input':
    case 'password-input':
    case 'textarea':
    case 'contenteditable':
      return 'textbox';
    default:
      return null;
  }
}

function elementTerms(element: ElementLocatorCandidates['element']): ReadonlySet<string> {
  return tokens(
    [
      element.accessibleName,
      element.text,
      element.label,
      element.placeholder,
      element.role,
      element.kind,
      element.attributes.id,
      element.attributes.name,
      element.attributes['data-testid'],
      element.attributes['data-test'],
      element.attributes['data-qa'],
      element.attributes['aria-label'],
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' '),
  );
}

function entryTerms(entry: SelectorManifestEntry): ReadonlySet<string> {
  return tokens(
    [entry.id, entry.name, entry.description, locatorText(entry.locator), entry.framePath]
      .filter((value): value is string => typeof value === 'string')
      .join(' '),
  );
}

function confidence(score: number): LocatorConfidence {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

function elementScore(
  entry: SelectorManifestEntry,
  element: ElementLocatorCandidates['element'],
): { readonly score: number; readonly reasons: readonly string[] } {
  const reasons: string[] = [];
  let score = 0;
  const overlap = jaccard(entryTerms(entry), elementTerms(element));
  if (overlap > 0) {
    const adjustment = overlap * 45;
    score += adjustment;
    reasons.push(`Semantic token overlap contributed ${Math.round(adjustment)} points.`);
  }

  if (entry.framePath === element.framePath) {
    score += 15;
    reasons.push('Element is in the same frame as the broken selector.');
  } else {
    score -= 12;
    reasons.push('Element is in a different frame from the broken selector.');
  }

  const wantedRole = expectedRole(entry);
  const actualRole = implicitRole(element);
  if (wantedRole !== null && actualRole === wantedRole) {
    score += 18;
    reasons.push(`Role matches expected ${wantedRole}.`);
  } else if (wantedRole !== null && actualRole !== null) {
    score -= 8;
    reasons.push(`Role ${actualRole} differs from expected ${wantedRole}.`);
  }

  if (element.visibility.visible) {
    score += 6;
    reasons.push('Element is visible.');
  } else {
    score -= 15;
    reasons.push('Element is hidden.');
  }

  if (entry.assertions.editable !== undefined) {
    const editableKind = new Set(['text-input', 'password-input', 'textarea', 'contenteditable']);
    if (editableKind.has(element.kind)) {
      score += 10;
      reasons.push('Element kind is compatible with editable assertions.');
    } else {
      score -= 10;
      reasons.push('Element kind is not compatible with editable assertions.');
    }
  }

  return { score, reasons };
}

function candidateScore(
  entry: SelectorManifestEntry,
  element: ElementLocatorCandidates['element'],
  candidate: LocatorCandidate,
): { readonly score: number; readonly reasons: readonly string[] } {
  const base = elementScore(entry, element);
  const reasons = [...base.reasons];
  let score = base.score;
  const stability = candidate.stability?.score ?? 0;
  score += stability * 0.45;
  reasons.push(`Locator stability contributed ${Math.round(stability * 0.45)} points.`);

  if (candidate.evaluation.status === 'unique') {
    score += 12;
    reasons.push('Live evaluation found exactly one match.');
  } else {
    score -= 40;
    reasons.push(`Candidate live status is ${candidate.evaluation.status}.`);
  }

  if (candidate.spec.type === entry.locator.type) {
    score += 4;
    reasons.push('Uses the same locator family as the original selector.');
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

function elementSummary(element: ElementLocatorCandidates['element']) {
  return {
    elementId: element.id,
    framePath: element.framePath,
    shadowPath: element.shadowPath,
    tagName: element.tagName,
    kind: element.kind,
    role: element.role,
    accessibleName: element.accessibleName,
    label: element.label,
    placeholder: element.placeholder,
    visible: element.visibility.visible,
  } as const;
}

export function buildDeterministicRepairCandidates(
  entry: SelectorManifestEntry,
  elements: readonly ElementLocatorCandidates[],
  maxCandidates = 12,
): readonly SelectorRepairSuggestion[] {
  const suggestions: SelectorRepairSuggestion[] = [];
  for (const element of elements) {
    for (const candidate of element.candidates) {
      if (candidate.evaluation.status !== 'unique' || candidate.stability === null) continue;
      const scored = candidateScore(entry, element.element, candidate);
      suggestions.push({
        id: `${entry.id}:${candidate.id}`,
        candidateId: candidate.id,
        locator: candidate.spec,
        playwright: candidate.playwright,
        strategy: candidate.strategy,
        score: scored.score,
        confidence: confidence(scored.score),
        source: 'deterministic',
        element: elementSummary(element.element),
        reasons: scored.reasons,
        warnings: candidate.warnings,
        aiConfidence: null,
        aiRationale: null,
      });
    }
  }
  return suggestions
    .sort(
      (left, right) => right.score - left.score || left.playwright.localeCompare(right.playwright),
    )
    .slice(0, maxCandidates);
}

export function toAdvisorCandidates(
  suggestions: readonly SelectorRepairSuggestion[],
): readonly RepairAdvisorCandidate[] {
  return suggestions.map((suggestion) => ({
    candidateId: suggestion.candidateId,
    playwright: suggestion.playwright,
    strategy: suggestion.strategy,
    deterministicScore: suggestion.score,
    element: suggestion.element,
    reasons: suggestion.reasons,
    warnings: suggestion.warnings,
  }));
}

export function applyAdvisorRanking(
  suggestions: readonly SelectorRepairSuggestion[],
  recommendations: readonly {
    readonly candidateId: string;
    readonly confidence: number;
    readonly rationale: string;
  }[],
): readonly SelectorRepairSuggestion[] {
  const byId = new Map(suggestions.map((suggestion) => [suggestion.candidateId, suggestion]));
  const ordered: SelectorRepairSuggestion[] = [];
  for (const recommendation of recommendations) {
    const suggestion = byId.get(recommendation.candidateId);
    if (suggestion === undefined) continue;
    const aiConfidence = Math.max(0, Math.min(1, recommendation.confidence));
    const combined = Math.round(suggestion.score * 0.65 + aiConfidence * 100 * 0.35);
    ordered.push({
      ...suggestion,
      score: combined,
      confidence: confidence(combined),
      source: 'ai-assisted',
      aiConfidence,
      aiRationale: recommendation.rationale,
    });
    byId.delete(recommendation.candidateId);
  }
  const remaining = [...byId.values()].sort(
    (left, right) => right.score - left.score || left.playwright.localeCompare(right.playwright),
  );
  return [...ordered, ...remaining];
}
