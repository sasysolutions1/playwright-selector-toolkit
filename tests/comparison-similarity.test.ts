import { describe, expect, it } from 'vitest';
import { elementSimilarity } from '../src/core/comparison/similarity.js';
import { element } from './comparison-fixtures.js';

describe('element similarity', () => {
  it('scores identical semantic elements highly despite movement', () => {
    expect(
      elementSimilarity(element('a'), element('b', { domPath: 'html > body > section > button' })),
    ).toBeGreaterThan(0.9);
  });

  it('scores unrelated elements below the default match threshold', () => {
    const score = elementSimilarity(
      element('a'),
      element('b', {
        tagName: 'input',
        kind: 'text-input',
        role: 'textbox',
        accessibleName: 'Email',
        text: null,
        label: 'Email',
        attributes: { name: 'email' },
      }),
    );
    expect(score).toBeLessThan(0.62);
  });
});
