import type {
  ElementLocatorCandidates,
  LocatorCandidate,
  LocatorConfidence,
  LocatorGenerationOptions,
  LocatorSpec,
  LocatorStability,
  LocatorStabilitySignal,
  LocatorStrategy,
} from '../../types/locator.js';
import { resolveLocatorGenerationOptions } from './options.js';

const STRATEGY_BASE_SCORE: Readonly<Record<LocatorStrategy, number>> = {
  'test-id': 76,
  label: 74,
  role: 70,
  placeholder: 54,
  text: 50,
  attribute: 48,
  css: 38,
  xpath: 18,
};

const STRATEGY_TIE_BREAK: readonly LocatorStrategy[] = [
  'test-id',
  'label',
  'role',
  'placeholder',
  'attribute',
  'text',
  'css',
  'xpath',
];

const GENERATED_PREFIX =
  /^(?:ember|react|vue|mui|radix|headlessui|auto|generated|chakra|mantine|ant|rc)[_:-]?/iu;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const LONG_HEX = /^[0-9a-f]{16,}$/iu;
const REACT_USE_ID = /^:r[0-9a-z]+:$/iu;
const NUMERIC_ONLY = /^\d{4,}$/u;
const GENERATED_SUFFIX = /(?:^|[-_:])[a-z]*\d{5,}$/iu;
const HASH_SUFFIX = /(?:^|[-_])[a-f0-9]{8,}$/iu;
const STRUCTURAL_CSS = /(?:^|\s)>|:nth-(?:child|of-type)|\s+[a-z][a-z0-9-]*(?:[.#[:]|$)/iu;

export interface IdentifierAnalysis {
  readonly generated: boolean;
  readonly reasons: readonly string[];
}

export function analyzeIdentifier(value: string): IdentifierAnalysis {
  const normalized = value.trim();
  const reasons: string[] = [];

  if (UUID.test(normalized)) reasons.push('UUID-shaped value');
  if (LONG_HEX.test(normalized)) reasons.push('long hexadecimal value');
  if (REACT_USE_ID.test(normalized)) reasons.push('React useId-shaped value');
  if (NUMERIC_ONLY.test(normalized)) reasons.push('long numeric value');
  if (GENERATED_PREFIX.test(normalized) && /\d/u.test(normalized)) {
    reasons.push('framework-style generated prefix with digits');
  }
  if (GENERATED_SUFFIX.test(normalized)) reasons.push('large numeric suffix');
  if (HASH_SUFFIX.test(normalized)) reasons.push('hash-like suffix');

  return { generated: reasons.length > 0, reasons };
}

export function isStructuralSelector(spec: LocatorSpec, domPath: string): boolean {
  if (spec.type === 'xpath') {
    return !/^\/\/\*\[@id=/u.test(spec.selector);
  }
  if (spec.type !== 'css') return false;
  if (/^#[^\s>+~:]+$/u.test(spec.selector)) return false;
  if (spec.selector === domPath) return true;
  return STRUCTURAL_CSS.test(spec.selector);
}

function identifierFromCandidate(candidate: LocatorCandidate): string | null {
  switch (candidate.spec.type) {
    case 'test-id':
      return candidate.spec.value;
    case 'css': {
      const id = /^#(.+)$/u.exec(candidate.spec.selector)?.[1];
      return id === undefined
        ? null
        : id.replace(/\\([0-9a-f]{1,6})\s?/giu, '').replace(/\\/gu, '');
    }
    case 'xpath': {
      const quoted = /^\/\/\*\[@id=(?:'([^']+)'|"([^"]+)")\]$/u.exec(candidate.spec.selector);
      return quoted?.[1] ?? quoted?.[2] ?? null;
    }
    case 'attribute':
    case 'label':
    case 'placeholder':
    case 'role':
    case 'text':
      return null;
  }
}

function addSignal(
  signals: LocatorStabilitySignal[],
  code: LocatorStabilitySignal['code'],
  label: string,
  adjustment: number,
  details?: string,
): void {
  signals.push({ code, label, adjustment, ...(details === undefined ? {} : { details }) });
}

function scoreCandidate(
  element: ElementLocatorCandidates['element'],
  candidate: LocatorCandidate,
  minimumRecommendedScore: number,
): Omit<LocatorStability, 'rank' | 'recommended'> {
  const signals: LocatorStabilitySignal[] = [];
  let score = STRATEGY_BASE_SCORE[candidate.strategy];
  addSignal(
    signals,
    'strategy-base',
    `${candidate.strategy} strategy base score`,
    STRATEGY_BASE_SCORE[candidate.strategy],
  );

  if (candidate.spec.type === 'role') {
    if (candidate.spec.name !== undefined) {
      score += 10;
      addSignal(signals, 'semantic-name', 'Role includes an accessible name', 10);
    } else {
      score -= 18;
      addSignal(signals, 'semantic-name', 'Role has no accessible name', -18);
    }
  }

  if (candidate.spec.type === 'label') {
    score += 10;
    addSignal(signals, 'semantic-name', 'Uses an associated form label', 10);
  }

  if (candidate.spec.type === 'test-id') {
    score += 8;
    addSignal(signals, 'explicit-test-hook', 'Uses an explicit testing hook', 8);
  }

  if (candidate.spec.type === 'placeholder') {
    score -= 8;
    addSignal(signals, 'copy-dependent', 'Placeholder copy can change', -8);
  }

  if (candidate.spec.type === 'text') {
    score -= 10;
    addSignal(signals, 'copy-dependent', 'Visible text can change or be localized', -10);
  }

  if (candidate.spec.type === 'attribute') {
    if (/\[(?:name|aria-label)=/u.test(candidate.spec.selector)) {
      score += 8;
      addSignal(signals, 'stable-identifier', 'Uses a meaningful name or aria-label attribute', 8);
    }
    if (/\[(?:title|alt)=/u.test(candidate.spec.selector)) {
      score -= 7;
      addSignal(signals, 'copy-dependent', 'Uses a user-facing copy attribute', -7);
    }
    if (/\[type=/u.test(candidate.spec.selector)) {
      score -= 12;
      addSignal(signals, 'structural-selector', 'Type-only attribute is broad', -12);
    }
  }

  const identifier = identifierFromCandidate(candidate);
  const identifierAnalysis =
    identifier === null ? { generated: false, reasons: [] } : analyzeIdentifier(identifier);
  if (identifier !== null) {
    if (identifierAnalysis.generated) {
      score -= 36;
      addSignal(
        signals,
        'generated-identifier',
        'Identifier appears generated',
        -36,
        identifierAnalysis.reasons.join(', '),
      );
    } else {
      score += candidate.spec.type === 'test-id' ? 4 : 14;
      addSignal(
        signals,
        'stable-identifier',
        candidate.spec.type === 'test-id'
          ? 'Testing-hook value appears stable'
          : 'Identifier appears human-authored',
        candidate.spec.type === 'test-id' ? 4 : 14,
      );
    }
  }

  const structural = isStructuralSelector(candidate.spec, element.domPath);
  if (structural) {
    score -= candidate.spec.type === 'xpath' ? 28 : 24;
    addSignal(
      signals,
      'structural-selector',
      candidate.spec.type === 'xpath'
        ? 'Structural XPath depends on DOM layout'
        : 'Structural CSS depends on DOM layout',
      candidate.spec.type === 'xpath' ? -28 : -24,
    );
  }

  if (candidate.spec.type === 'xpath') {
    score -= 12;
    addSignal(signals, 'xpath', 'XPath is a last-resort strategy', -12);
  }

  switch (candidate.evaluation.status) {
    case 'unique':
      score += 18;
      addSignal(signals, 'unique-match', 'Live evaluation found exactly one match', 18);
      break;
    case 'multiple':
      score -= 38;
      addSignal(
        signals,
        'ambiguous-match',
        `Live evaluation found ${candidate.evaluation.count ?? 'multiple'} matches`,
        -38,
      );
      break;
    case 'none':
      score -= 65;
      addSignal(signals, 'missing-match', 'Live evaluation found no matches', -65);
      break;
    case 'error':
      score -= 60;
      addSignal(
        signals,
        'evaluation-error',
        'Live evaluation failed',
        -60,
        candidate.evaluation.error ?? undefined,
      );
      break;
    case 'not-tested':
      score -= 5;
      addSignal(signals, 'not-live-tested', 'Candidate was not tested against the live page', -5);
      break;
  }

  if (candidate.evaluation.visibleCount === 1) {
    score += 3;
    addSignal(signals, 'visible-match', 'The unique match is visible', 3);
  }
  if (candidate.evaluation.enabledCount === 1) {
    score += 2;
    addSignal(signals, 'enabled-match', 'The unique match is enabled', 2);
  }

  if (!element.visibility.visible) {
    score -= 15;
    addSignal(signals, 'hidden-element', 'The target element is hidden', -15);
  }

  const frameDepth = candidate.framePath.split('/frame[').length - 1;
  if (frameDepth > 0) {
    const adjustment = -Math.min(6, frameDepth * 2);
    score += adjustment;
    addSignal(signals, 'nested-frame', 'Locator crosses one or more child frames', adjustment);
  }

  if (candidate.shadowPath.length > 0) {
    const adjustment = -Math.min(6, candidate.shadowPath.length * 2);
    score += adjustment;
    addSignal(signals, 'shadow-root', 'Locator crosses one or more open shadow roots', adjustment);
  }

  if (candidate.sourcePlugin !== undefined) {
    addSignal(
      signals,
      'plugin-generated',
      `Generated by plugin ${candidate.sourcePlugin}${candidate.sourceHook === undefined ? '' : `/${candidate.sourceHook}`}`,
      0,
    );
  }

  if (candidate.warnings.length > 0) {
    const adjustment = -Math.min(9, candidate.warnings.length * 3);
    score += adjustment;
    addSignal(
      signals,
      'warning',
      `${candidate.warnings.length} generator warning${candidate.warnings.length === 1 ? '' : 's'}`,
      adjustment,
    );
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let confidence: LocatorConfidence = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
  if (candidate.evaluation.status === 'not-tested' && confidence === 'high') confidence = 'medium';
  if (
    candidate.evaluation.status === 'multiple' ||
    candidate.evaluation.status === 'none' ||
    candidate.evaluation.status === 'error'
  ) {
    confidence = 'low';
  }

  const eligibleStatus =
    candidate.evaluation.status === 'unique' || candidate.evaluation.status === 'not-tested';

  return {
    score,
    confidence,
    eligible: eligibleStatus && score >= minimumRecommendedScore,
    generatedIdentifier: identifierAnalysis.generated,
    structural,
    signals,
  };
}

function strategyOrder(strategy: LocatorStrategy): number {
  return STRATEGY_TIE_BREAK.indexOf(strategy);
}

export function rankElementLocatorCandidates(
  element: ElementLocatorCandidates,
  options: LocatorGenerationOptions = {},
): ElementLocatorCandidates {
  const resolved = resolveLocatorGenerationOptions(options);
  const scored = element.candidates.map((candidate) => ({
    candidate,
    stability: scoreCandidate(element.element, candidate, resolved.minimumRecommendedScore),
  }));

  scored.sort((left, right) => {
    const scoreDifference = right.stability.score - left.stability.score;
    if (scoreDifference !== 0) return scoreDifference;
    const strategyDifference =
      strategyOrder(left.candidate.strategy) - strategyOrder(right.candidate.strategy);
    if (strategyDifference !== 0) return strategyDifference;
    const priorityDifference = left.candidate.priority - right.candidate.priority;
    if (priorityDifference !== 0) return priorityDifference;
    return left.candidate.id.localeCompare(right.candidate.id);
  });

  const recommended = scored.find((entry) => entry.stability.eligible)?.candidate.id ?? null;
  const candidates = scored.map((entry, index) => ({
    ...entry.candidate,
    stability: {
      ...entry.stability,
      rank: index + 1,
      recommended: entry.candidate.id === recommended,
    },
  }));

  return { ...element, candidates, recommendedCandidateId: recommended };
}

export function rankLocatorCandidates(
  elements: readonly ElementLocatorCandidates[],
  options: LocatorGenerationOptions = {},
): readonly ElementLocatorCandidates[] {
  return elements.map((element) => rankElementLocatorCandidates(element, options));
}

export function recommendedCandidate(element: ElementLocatorCandidates): LocatorCandidate | null {
  if (element.recommendedCandidateId === null) return null;
  return (
    element.candidates.find((candidate) => candidate.id === element.recommendedCandidateId) ?? null
  );
}
