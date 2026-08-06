import { describe, expect, it } from 'vitest';
import {
  analyzeIdentifier,
  isStructuralSelector,
  rankElementLocatorCandidates,
  rankLocatorCandidates,
  recommendedCandidate,
} from '../src/core/locator/stability.js';
import type {
  ElementLocatorCandidates,
  LocatorCandidate,
  LocatorEvaluationStatus,
  LocatorSpec,
  LocatorStrategy,
} from '../src/types/locator.js';

function evaluation(status: LocatorEvaluationStatus) {
  return {
    status,
    count: status === 'unique' ? 1 : status === 'multiple' ? 3 : status === 'none' ? 0 : null,
    visibleCount: status === 'unique' ? 1 : null,
    enabledCount: status === 'unique' ? 1 : null,
    durationMs: status === 'not-tested' ? null : 4,
    error: status === 'error' ? 'evaluation failed' : null,
  } as const;
}

function candidate(
  id: string,
  strategy: LocatorStrategy,
  spec: LocatorSpec,
  status: LocatorEvaluationStatus = 'unique',
  warnings: readonly string[] = [],
): LocatorCandidate {
  return {
    id,
    elementId: 'element-1',
    framePath: 'main',
    shadowPath: [],
    strategy,
    priority: 10,
    spec,
    playwright: `page.${id}`,
    relativePlaywright: `locator.${id}`,
    rationale: id,
    warnings,
    evaluation: evaluation(status),
    stability: null,
  };
}

function element(candidates: readonly LocatorCandidate[]): ElementLocatorCandidates {
  return {
    element: {
      id: 'element-1',
      framePath: 'main',
      shadowPath: [],
      domPath: 'html > body:nth-child(2) > button:nth-child(1)',
      tagName: 'button',
      kind: 'button',
      role: 'button',
      accessibleName: 'Save changes',
      text: 'Save changes',
      label: null,
      placeholder: null,
      attributes: { id: 'save', 'data-testid': 'save-action' },
      visibility: {
        visible: true,
        reason: 'visible',
        inViewport: true,
        boundingBox: null,
      },
      sensitive: false,
    },
    candidates,
    recommendedCandidateId: null,
  };
}

describe('identifier stability analysis', () => {
  it('recognizes stable human-authored identifiers', () => {
    expect(analyzeIdentifier('save-button')).toEqual({ generated: false, reasons: [] });
  });

  it.each([
    '550e8400-e29b-41d4-a716-446655440000',
    ':r17:',
    'react-482991',
    '12345678',
    'field-a4b35c781d',
  ])('recognizes generated identifier %s', (value) => {
    expect(analyzeIdentifier(value).generated).toBe(true);
  });
});

describe('structural selector classification', () => {
  it('marks DOM paths and structural XPath as structural', () => {
    expect(
      isStructuralSelector(
        { type: 'css', selector: 'html > body:nth-child(2) > button:nth-child(1)' },
        'html > body:nth-child(2) > button:nth-child(1)',
      ),
    ).toBe(true);
    expect(
      isStructuralSelector(
        { type: 'xpath', selector: '/html/body[1]/button[1]' },
        'html > body > button',
      ),
    ).toBe(true);
  });

  it('does not mark id selectors as structural', () => {
    expect(isStructuralSelector({ type: 'css', selector: '#save' }, '#save')).toBe(false);
    expect(isStructuralSelector({ type: 'xpath', selector: "//*[@id='save']" }, '#save')).toBe(
      false,
    );
  });
});

describe('locator stability ranking', () => {
  it('prefers an explicit stable test hook over copy and structure', () => {
    const ranked = rankElementLocatorCandidates(
      element([
        candidate('text', 'text', { type: 'text', value: 'Save changes', exact: true }),
        candidate('path', 'css', {
          type: 'css',
          selector: 'html > body:nth-child(2) > button:nth-child(1)',
        }),
        candidate('testid', 'test-id', {
          type: 'test-id',
          attribute: 'data-testid',
          value: 'save-action',
        }),
      ]),
    );

    expect(ranked.candidates[0]?.id).toBe('testid');
    expect(ranked.recommendedCandidateId).toBe('testid');
    expect(ranked.candidates[0]?.stability).toMatchObject({
      recommended: true,
      confidence: 'high',
      generatedIdentifier: false,
    });
  });

  it('penalizes generated identifiers even when unique', () => {
    const ranked = rankElementLocatorCandidates(
      element([
        candidate('generated', 'test-id', {
          type: 'test-id',
          attribute: 'data-testid',
          value: 'react-482991',
        }),
        candidate('role', 'role', {
          type: 'role',
          role: 'button',
          name: 'Save changes',
          exact: true,
        }),
      ]),
    );

    const generated = ranked.candidates.find((entry) => entry.id === 'generated');
    expect(generated?.stability?.generatedIdentifier).toBe(true);
    expect(
      generated?.stability?.signals.some((signal) => signal.code === 'generated-identifier'),
    ).toBe(true);
    expect(ranked.recommendedCandidateId).toBe('role');
  });

  it('never recommends ambiguous, missing, or errored candidates', () => {
    const ranked = rankElementLocatorCandidates(
      element([
        candidate(
          'ambiguous',
          'test-id',
          { type: 'test-id', attribute: 'data-testid', value: 'save-action' },
          'multiple',
        ),
        candidate('missing', 'label', { type: 'label', value: 'Save', exact: true }, 'none'),
        candidate(
          'error',
          'role',
          { type: 'role', role: 'button', name: 'Save', exact: true },
          'error',
        ),
      ]),
    );

    expect(ranked.recommendedCandidateId).toBeNull();
    expect(ranked.candidates.every((entry) => entry.stability?.eligible === false)).toBe(true);
  });

  it('caps untested candidates at medium confidence', () => {
    const ranked = rankElementLocatorCandidates(
      element([
        candidate(
          'testid',
          'test-id',
          { type: 'test-id', attribute: 'data-testid', value: 'save-action' },
          'not-tested',
        ),
      ]),
      { minimumRecommendedScore: 40 },
    );

    expect(ranked.candidates[0]?.stability?.confidence).toBe('medium');
    expect(ranked.recommendedCandidateId).toBe('testid');
  });

  it('honors the minimum recommendation score', () => {
    const source = element([
      candidate('text', 'text', { type: 'text', value: 'Save changes', exact: true }),
    ]);
    expect(
      rankElementLocatorCandidates(source, { minimumRecommendedScore: 90 }).recommendedCandidateId,
    ).toBeNull();
    expect(
      rankElementLocatorCandidates(source, { minimumRecommendedScore: 40 }).recommendedCandidateId,
    ).toBe('text');
  });

  it('assigns deterministic ranks and exactly one recommendation', () => {
    const ranked = rankElementLocatorCandidates(
      element([
        candidate('label', 'label', { type: 'label', value: 'Save changes', exact: true }),
        candidate('role', 'role', {
          type: 'role',
          role: 'button',
          name: 'Save changes',
          exact: true,
        }),
        candidate('id', 'css', { type: 'css', selector: '#save' }),
      ]),
    );

    expect(ranked.candidates.map((entry) => entry.stability?.rank)).toEqual([1, 2, 3]);
    expect(ranked.candidates.filter((entry) => entry.stability?.recommended)).toHaveLength(1);
    expect(recommendedCandidate(ranked)?.id).toBe(ranked.recommendedCandidateId);
  });

  it('ranks multiple elements independently', () => {
    const first = element([
      candidate('first', 'role', {
        type: 'role',
        role: 'button',
        name: 'First',
        exact: true,
      }),
    ]);
    const second = {
      ...element([
        {
          ...candidate('second', 'label', { type: 'label', value: 'Email', exact: true }),
          elementId: 'element-2',
        },
      ]),
      element: { ...element([]).element, id: 'element-2', kind: 'text-input' as const },
    };

    const ranked = rankLocatorCandidates([first, second]);
    expect(ranked.map((entry) => entry.recommendedCandidateId)).toEqual(['first', 'second']);
  });
});
