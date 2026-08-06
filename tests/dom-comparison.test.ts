import { describe, expect, it } from 'vitest';
import { compareDomSnapshots } from '../src/core/comparison/compare.js';
import { element, snapshot } from './comparison-fixtures.js';

describe('DOM comparison', () => {
  it('summarizes unchanged elements while omitting them from default output', () => {
    const baseline = snapshot([element('element-1')]);
    const report = compareDomSnapshots('login', 'v1', baseline, baseline);
    expect(report.summary).toMatchObject({ unchangedElementCount: 1, driftDetected: false });
    expect(report.differences).toEqual([]);
  });

  it('detects semantic movement and suggests replacement locators', () => {
    const before = snapshot([element('element-1')]);
    const after = snapshot([
      element('element-2', { domPath: 'html > body > main > form > button', framePath: 'main' }),
    ]);
    const report = compareDomSnapshots('login', 'v1', before, after);
    expect(report.summary.movedElementCount).toBe(1);
    expect(report.differences[0]).toMatchObject({ kind: 'moved', matchMethod: 'semantic' });
    const difference = report.differences[0];
    expect(
      difference && 'replacementLocators' in difference ? difference.replacementLocators.length : 0,
    ).toBeGreaterThan(0);
  });

  it('detects changed accessible names through fuzzy matching', () => {
    const before = snapshot([element('element-1', { accessibleName: 'Save', text: 'Save' })]);
    const after = snapshot([
      element('element-2', {
        accessibleName: 'Save changes',
        text: 'Save changes',
        attributes: { 'data-testid': 'save-button-v2' },
        domPath: 'html > body > button:nth-of-type(1)',
      }),
    ]);
    const report = compareDomSnapshots('login', 'v1', before, after, { similarityThreshold: 0.55 });
    expect(report.summary.changedElementCount).toBe(1);
    expect(report.differences[0]).toMatchObject({ kind: 'changed', matchMethod: 'similarity' });
    expect(
      report.differences[0] && 'changedFields' in report.differences[0]
        ? report.differences[0].changedFields
        : [],
    ).toContain('accessibleName');
  });

  it('detects added and removed elements', () => {
    const before = snapshot([element('element-1', { accessibleName: 'Save' })]);
    const after = snapshot([
      element('element-2', {
        tagName: 'a',
        kind: 'link',
        role: 'link',
        accessibleName: 'Help',
        text: 'Help',
        attributes: { href: '/help' },
      }),
    ]);
    const report = compareDomSnapshots('login', 'v1', before, after);
    expect(report.summary).toMatchObject({ addedElementCount: 1, removedElementCount: 1 });
    expect(report.differences.map((item) => item.kind)).toEqual(['removed', 'added']);
  });

  it('includes unchanged entries only when requested', () => {
    const baseline = snapshot([element('element-1')]);
    const report = compareDomSnapshots('login', 'v1', baseline, baseline, {
      includeUnchanged: true,
    });
    expect(report.differences).toHaveLength(1);
    expect(report.differences[0]?.kind).toBe('unchanged');
  });
});
