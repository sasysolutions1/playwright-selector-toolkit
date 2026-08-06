import { describe, expect, it } from 'vitest';
import {
  applyAdvisorRanking,
  buildDeterministicRepairCandidates,
} from '../src/core/repair/matcher.js';
import type { ElementLocatorCandidates } from '../src/types/locator.js';
import type { SelectorManifestEntry } from '../src/types/validation.js';

const selector: SelectorManifestEntry = {
  id: 'submit-login',
  name: 'Sign in button',
  description: 'Primary submit control for sign in',
  required: true,
  framePath: 'main',
  locator: { type: 'role', role: 'button', name: 'Log in', exact: true },
  assertions: { count: 1, visible: 'all', enabled: 'all' },
};

function element(
  id: string,
  name: string,
  score: number,
  kind: 'button' | 'link' = 'button',
): ElementLocatorCandidates {
  return {
    element: {
      id,
      framePath: 'main',
      shadowPath: [],
      domPath: `html > body > ${kind}:nth-child(1)`,
      tagName: kind === 'button' ? 'button' : 'a',
      kind,
      role: kind,
      accessibleName: name,
      text: name,
      label: null,
      placeholder: null,
      attributes: { 'data-testid': id },
      visibility: { visible: true, reason: 'visible', inViewport: true, boundingBox: null },
      sensitive: false,
    },
    recommendedCandidateId: `${id}:role`,
    candidates: [
      {
        id: `${id}:role`,
        elementId: id,
        framePath: 'main',
        shadowPath: [],
        strategy: 'role',
        priority: 10,
        spec: { type: 'role', role: kind, name, exact: true },
        playwright: `page.getByRole('${kind}', { name: '${name}' })`,
        relativePlaywright: `getByRole('${kind}', { name: '${name}' })`,
        rationale: 'semantic role',
        warnings: [],
        evaluation: {
          status: 'unique',
          count: 1,
          visibleCount: 1,
          enabledCount: 1,
          durationMs: 1,
          error: null,
        },
        stability: {
          score,
          confidence: score >= 80 ? 'high' : 'medium',
          rank: 1,
          recommended: true,
          eligible: true,
          generatedIdentifier: false,
          structural: false,
          signals: [],
        },
      },
    ],
  };
}

describe('deterministic repair matching', () => {
  it('prefers semantically compatible visible controls', () => {
    const suggestions = buildDeterministicRepairCandidates(selector, [
      element('help', 'Help', 90, 'link'),
      element('sign-in', 'Sign in', 88),
    ]);
    expect(suggestions[0]?.element.elementId).toBe('sign-in');
    expect(suggestions[0]?.score).toBeGreaterThan(60);
  });

  it('ignores ambiguous or unranked candidates', () => {
    const source = element('sign-in', 'Sign in', 88);
    const broken = {
      ...source,
      candidates: source.candidates.map((candidate) => ({
        ...candidate,
        evaluation: { ...candidate.evaluation, status: 'multiple' as const, count: 2 },
      })),
    };
    expect(buildDeterministicRepairCandidates(selector, [broken])).toEqual([]);
  });

  it('allows AI advice to reorder only existing candidates', () => {
    const suggestions = buildDeterministicRepairCandidates(selector, [
      element('sign-in', 'Sign in', 88),
      element('submit', 'Submit', 85),
    ]);
    const reranked = applyAdvisorRanking(suggestions, [
      {
        candidateId: suggestions[1]!.candidateId,
        confidence: 0.98,
        rationale: 'Closer to the application submit convention.',
      },
      { candidateId: 'invented', confidence: 1, rationale: 'Must be ignored.' },
    ]);
    expect(reranked[0]?.candidateId).toBe(suggestions[1]?.candidateId);
    expect(reranked.some((item) => item.candidateId === 'invented')).toBe(false);
    expect(reranked[0]?.source).toBe('ai-assisted');
  });
});
