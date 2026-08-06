import type { Frame, Locator, Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { evaluateLocatorCandidates, mapFrames } from '../src/core/locator/evaluator.js';
import type { DomSnapshot } from '../src/types/dom.js';
import type { ElementLocatorCandidates } from '../src/types/locator.js';

function fakeLocator(count: number): Locator {
  return {
    count: vi.fn(async () => count),
    nth: vi.fn(() => ({
      isVisible: vi.fn(async () => true),
      isEnabled: vi.fn(async () => true),
    })),
  } as unknown as Locator;
}

function fakeFrame(name: string, children: Frame[] = []): Frame {
  return {
    name: () => name,
    childFrames: () => children,
    getByRole: vi.fn(() => fakeLocator(1)),
    getByLabel: vi.fn(() => fakeLocator(1)),
    getByPlaceholder: vi.fn(() => fakeLocator(1)),
    getByText: vi.fn(() => fakeLocator(2)),
    getByTestId: vi.fn(() => fakeLocator(1)),
    locator: vi.fn((selector: string) => fakeLocator(selector.includes('missing') ? 0 : 1)),
  } as unknown as Frame;
}

const snapshot = { frames: [] } as unknown as DomSnapshot;
const baseElement: ElementLocatorCandidates = {
  element: {
    id: 'element-1',
    framePath: 'main',
    shadowPath: [],
    domPath: '#save',
    tagName: 'button',
    kind: 'button',
    role: 'button',
    accessibleName: 'Save',
    text: 'Save',
    label: null,
    placeholder: null,
    attributes: {},
    visibility: {
      visible: true,
      reason: 'visible',
      inViewport: true,
      boundingBox: null,
    },
    sensitive: false,
  },
  candidates: [
    {
      id: 'role',
      elementId: 'element-1',
      framePath: 'main',
      shadowPath: [],
      strategy: 'role',
      priority: 10,
      spec: { type: 'role', role: 'button', name: 'Save', exact: true },
      playwright: '',
      relativePlaywright: '',
      rationale: '',
      warnings: [],
      evaluation: {
        status: 'not-tested',
        count: null,
        visibleCount: null,
        enabledCount: null,
        durationMs: null,
        error: null,
      },
      stability: null,
    },
    {
      id: 'text',
      elementId: 'element-1',
      framePath: 'main',
      shadowPath: [],
      strategy: 'text',
      priority: 30,
      spec: { type: 'text', value: 'Save', exact: true },
      playwright: '',
      relativePlaywright: '',
      rationale: '',
      warnings: [],
      evaluation: {
        status: 'not-tested',
        count: null,
        visibleCount: null,
        enabledCount: null,
        durationMs: null,
        error: null,
      },
      stability: null,
    },
  ],
  recommendedCandidateId: null,
};

describe('live locator evaluation', () => {
  it('maps main and child frames with crawler-compatible paths', () => {
    const child = fakeFrame('login');
    const main = fakeFrame('', [child]);
    const map = mapFrames({ mainFrame: () => main } as unknown as Page);
    expect(map.get('main')).toBe(main);
    expect(map.get('main/frame[0]:login')).toBe(child);
  });

  it('classifies unique and ambiguous candidates', async () => {
    const main = fakeFrame('');
    const result = await evaluateLocatorCandidates(
      { mainFrame: () => main } as unknown as Page,
      snapshot,
      [baseElement],
    );
    expect(result[0]?.candidates.map((candidate) => candidate.evaluation.status)).toEqual([
      'unique',
      'multiple',
    ]);
    expect(result[0]?.candidates[0]?.evaluation).toMatchObject({
      count: 1,
      visibleCount: 1,
      enabledCount: 1,
    });
  });

  it('returns errors when a frame disappears', async () => {
    const main = fakeFrame('');
    const childElement = {
      ...baseElement,
      element: { ...baseElement.element, framePath: 'main/frame[0]:gone' },
    };
    const result = await evaluateLocatorCandidates(
      { mainFrame: () => main } as unknown as Page,
      snapshot,
      [childElement],
    );
    expect(
      result[0]?.candidates.every((candidate) => candidate.evaluation.status === 'error'),
    ).toBe(true);
  });
});
