import { describe, expect, it } from 'vitest';
import {
  generateElementLocatorCandidates,
  generateLocatorCandidates,
} from '../src/core/locator/candidates.js';
import type { DomElementSnapshot, DomSnapshot } from '../src/types/dom.js';

function element(overrides: Partial<DomElementSnapshot> = {}): DomElementSnapshot {
  return {
    id: 'main-element-000001',
    framePath: 'main',
    shadowPath: [],
    domPath: 'html > body > button#save',
    tagName: 'button',
    kind: 'button',
    role: null,
    accessibleName: 'Save changes',
    text: 'Save changes',
    label: null,
    placeholder: null,
    attributes: { id: 'save', 'data-testid': 'save-button', type: 'button' },
    visibility: {
      visible: true,
      reason: 'visible',
      inViewport: true,
      boundingBox: { x: 0, y: 0, width: 100, height: 30 },
    },
    interactive: true,
    interactivitySources: ['native-control'],
    disabled: false,
    readonly: false,
    required: false,
    checked: null,
    selected: null,
    sensitive: false,
    redactionsApplied: 0,
    ...overrides,
  };
}

function snapshot(elements: readonly DomElementSnapshot[]): DomSnapshot {
  return {
    schemaVersion: '1.0',
    toolkitVersion: '0.4.0',
    capturedAt: '2026-07-18T00:00:00.000Z',
    requestedUrl: 'https://example.test/',
    finalUrl: 'https://example.test/',
    title: 'Fixture',
    options: {
      scope: 'interactive',
      includeHidden: false,
      maxElements: 5000,
      maxFrameDepth: 8,
      textLimit: 240,
      redact: true,
    },
    summary: {
      frameCount: 1,
      failedFrameCount: 0,
      shadowRootCount: 0,
      inspectedElementCount: elements.length,
      matchedElementCount: elements.length,
      visibleElementCount: elements.length,
      hiddenElementCount: 0,
      interactiveElementCount: elements.length,
      sensitiveElementCount: 0,
      redactionCount: 0,
      truncated: false,
      kinds: { button: elements.length },
    },
    frames: [
      {
        path: 'main',
        parentPath: null,
        depth: 0,
        index: 0,
        name: null,
        url: 'https://example.test/',
        title: 'Fixture',
        language: 'en',
        readyState: 'complete',
        shadowRootCount: 0,
        inspectedElementCount: elements.length,
        matchedElementCount: elements.length,
        truncated: false,
        elements,
      },
    ],
    failures: [],
    warnings: [],
  };
}

describe('locator candidate generation', () => {
  it('generates semantic, test-id, CSS, attribute, and XPath candidates', () => {
    const result = generateElementLocatorCandidates(element());
    expect(result.candidates.map((candidate) => candidate.strategy)).toEqual(
      expect.arrayContaining(['role', 'test-id', 'text', 'css', 'attribute', 'xpath']),
    );
    expect(result.candidates[0]?.playwright).toContain('page.getByRole');
    expect(
      result.candidates.find((candidate) => candidate.strategy === 'test-id')?.playwright,
    ).toContain('getByTestId');
  });

  it('uses frame-relative serialization for child frames', () => {
    const result = generateElementLocatorCandidates(element({ framePath: 'main/frame[0]:child' }));
    expect(result.candidates[0]?.playwright.startsWith('frame.')).toBe(true);
  });

  it('omits redacted values and shadow-root XPath', () => {
    const result = generateElementLocatorCandidates(
      element({
        accessibleName: '[REDACTED_EMAIL]',
        text: '[REDACTED_EMAIL]',
        shadowPath: ['secure-panel#host'],
        attributes: { 'aria-label': '[REDACTED_EMAIL]' },
      }),
    );
    expect(
      result.candidates.some((candidate) => JSON.stringify(candidate.spec).includes('REDACTED')),
    ).toBe(false);
    expect(result.candidates.some((candidate) => candidate.strategy === 'xpath')).toBe(false);
  });

  it('respects limits and XPath settings', () => {
    const result = generateElementLocatorCandidates(element(), {
      maxCandidatesPerElement: 2,
      includeXPath: false,
    });
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.some((candidate) => candidate.strategy === 'xpath')).toBe(false);
  });

  it('generates candidates for every snapshot element', () => {
    const result = generateLocatorCandidates(
      snapshot([
        element(),
        element({
          id: 'main-element-000002',
          attributes: { name: 'email' },
          kind: 'text-input',
          tagName: 'input',
          accessibleName: 'Email',
          text: null,
          domPath: 'html > body > input',
        }),
      ]),
    );
    expect(result).toHaveLength(2);
  });
});
