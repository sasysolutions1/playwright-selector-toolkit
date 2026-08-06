import type { DomElementSnapshot, DomSnapshot } from '../src/types/dom.js';

export function element(
  id: string,
  overrides: Partial<DomElementSnapshot> = {},
): DomElementSnapshot {
  return {
    id,
    framePath: 'main',
    shadowPath: [],
    domPath: `html > body > button:nth-of-type(${id.replace(/\D/gu, '') || '1'})`,
    tagName: 'button',
    kind: 'button',
    role: 'button',
    accessibleName: 'Save',
    text: 'Save',
    label: null,
    placeholder: null,
    attributes: { 'data-testid': 'save-button' },
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

export function snapshot(
  elements: readonly DomElementSnapshot[],
  capturedAt = '2026-07-18T00:00:00.000Z',
): DomSnapshot {
  const kinds: Record<string, number> = {};
  for (const item of elements) kinds[item.kind] = (kinds[item.kind] ?? 0) + 1;
  return {
    schemaVersion: '1.0',
    toolkitVersion: '0.9.0-test',
    capturedAt,
    requestedUrl: 'https://example.test',
    finalUrl: 'https://example.test/',
    title: 'Fixture',
    options: {
      scope: 'interactive',
      includeHidden: false,
      maxElements: 1000,
      maxFrameDepth: 6,
      textLimit: 500,
      redact: true,
    },
    summary: {
      frameCount: 1,
      failedFrameCount: 0,
      shadowRootCount: 0,
      inspectedElementCount: elements.length,
      matchedElementCount: elements.length,
      visibleElementCount: elements.filter((item) => item.visibility.visible).length,
      hiddenElementCount: elements.filter((item) => !item.visibility.visible).length,
      interactiveElementCount: elements.filter((item) => item.interactive).length,
      sensitiveElementCount: elements.filter((item) => item.sensitive).length,
      redactionCount: elements.reduce((total, item) => total + item.redactionsApplied, 0),
      truncated: false,
      kinds,
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
