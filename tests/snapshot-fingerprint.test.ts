import { describe, expect, it } from 'vitest';
import {
  createElementFingerprintIndex,
  semanticElementFingerprint,
  structuralElementFingerprint,
} from '../src/core/snapshot/fingerprint.js';
import type { DomElementSnapshot, DomSnapshot } from '../src/types/dom.js';

function element(overrides: Partial<DomElementSnapshot> = {}): DomElementSnapshot {
  return {
    id: 'main-element-1',
    framePath: 'main',
    shadowPath: [],
    domPath: 'html > body > button#send',
    tagName: 'button',
    kind: 'button',
    role: 'button',
    accessibleName: 'Send',
    text: 'Send',
    label: null,
    placeholder: null,
    attributes: { id: 'send', class: 'primary' },
    visibility: {
      visible: true,
      reason: 'visible',
      inViewport: true,
      boundingBox: { x: 1, y: 2, width: 100, height: 30 },
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
    toolkitVersion: '0.8.0-test',
    capturedAt: '2026-07-18T00:00:00.000Z',
    requestedUrl: 'https://example.test',
    finalUrl: 'https://example.test/',
    title: 'Fixture',
    options: {
      scope: 'interactive',
      includeHidden: false,
      maxElements: 500,
      maxFrameDepth: 8,
      textLimit: 200,
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

describe('element fingerprints', () => {
  it('keeps semantic identity stable across structural movement', () => {
    const first = element();
    const moved = element({ domPath: 'html > body > main > section > button#send' });
    expect(semanticElementFingerprint(first)).toBe(semanticElementFingerprint(moved));
    expect(structuralElementFingerprint(first)).not.toBe(structuralElementFingerprint(moved));
  });

  it('ignores volatile classes but includes stable test IDs', () => {
    const first = element({ attributes: { class: 'css-a1b2', 'data-testid': 'send' } });
    const second = element({ attributes: { class: 'css-z9y8', 'data-testid': 'send' } });
    expect(semanticElementFingerprint(first)).toBe(semanticElementFingerprint(second));
  });

  it('assigns ordinals to semantically duplicate elements', () => {
    const first = element({ id: 'a', domPath: 'html > body > button:nth-of-type(1)' });
    const second = element({ id: 'b', domPath: 'html > body > button:nth-of-type(2)' });
    const index = createElementFingerprintIndex(snapshot([first, second]), {
      now: new Date('2026-07-18T01:00:00.000Z'),
      toolkitVersion: '0.8.0-test',
    });
    expect(index.records.map((record) => record.semanticOrdinal)).toEqual([1, 2]);
    expect(index.summary).toEqual({
      elementCount: 2,
      uniqueSemanticHashCount: 1,
      duplicateSemanticGroupCount: 1,
      uniqueStructuralHashCount: 2,
    });
  });
});
