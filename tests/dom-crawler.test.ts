import type { Frame, Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { crawlDomSnapshot, summarizeDomSnapshot } from '../src/core/dom/crawler.js';
import type {
  DomElementSnapshot,
  DomFrameSnapshot,
  FrameDocumentPayload,
} from '../src/types/dom.js';

function element(
  id: string,
  overrides: Partial<Omit<DomElementSnapshot, 'framePath'>> = {},
): Omit<DomElementSnapshot, 'framePath'> {
  return {
    id,
    shadowPath: [],
    domPath: 'html > body > button',
    tagName: 'button',
    kind: 'button',
    role: 'button',
    accessibleName: 'Send',
    text: 'Send',
    label: null,
    placeholder: null,
    attributes: { id: 'send' },
    visibility: {
      visible: true,
      reason: 'visible',
      inViewport: true,
      boundingBox: { x: 10, y: 10, width: 100, height: 30 },
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

function payload(elements: readonly Omit<DomElementSnapshot, 'framePath'>[]): FrameDocumentPayload {
  return {
    title: 'Fixture',
    language: 'en',
    readyState: 'complete',
    shadowRootCount: 1,
    inspectedElementCount: 12,
    matchedElementCount: elements.length,
    truncated: false,
    elements,
  };
}

function fakeFrame(name: string, url: string, children: Frame[] = []): Frame {
  return {
    name: vi.fn(() => name),
    url: vi.fn(() => url),
    childFrames: vi.fn(() => children),
  } as unknown as Frame;
}

describe('DOM crawler', () => {
  it('traverses child frames, qualifies IDs, and summarizes elements', async () => {
    const child = fakeFrame('payment', 'https://payments.example.test/frame');
    const main = fakeFrame('', 'https://example.test/', [child]);
    const page = {
      mainFrame: vi.fn(() => main),
      url: vi.fn(() => 'https://example.test/'),
      title: vi.fn(async () => 'Example'),
    } as unknown as Page;
    const inspectFrame = vi.fn(async (frame: Frame) =>
      frame === main
        ? payload([element('element-000001')])
        : payload([
            element('element-000001', {
              kind: 'text-input',
              tagName: 'input',
              sensitive: true,
              redactionsApplied: 1,
            }),
          ]),
    );

    const snapshot = await crawlDomSnapshot(
      page,
      'https://example.test/',
      { maxElements: 10 },
      {
        inspectFrame,
        toolkitVersion: () => '0.4.0-test',
        now: () => new Date('2026-07-18T00:00:00.000Z'),
      },
    );

    expect(snapshot.frames).toHaveLength(2);
    expect(snapshot.frames[1]?.path).toBe('main/frame[0]:payment');
    expect(snapshot.frames[0]?.elements[0]?.id).toBe('main-element-000001');
    expect(snapshot.frames[1]?.elements[0]?.id).toContain('payment-element-000001');
    expect(snapshot.summary).toMatchObject({
      frameCount: 2,
      failedFrameCount: 0,
      matchedElementCount: 2,
      sensitiveElementCount: 1,
      redactionCount: 1,
    });
    expect(snapshot.toolkitVersion).toBe('0.4.0-test');
  });

  it('records frame failures without losing successful frames', async () => {
    const child = fakeFrame('broken', 'https://broken.example.test/');
    const main = fakeFrame('', 'https://example.test/', [child]);
    const page = {
      mainFrame: () => main,
      url: () => 'https://example.test/',
      title: async () => 'Example',
    } as unknown as Page;

    const snapshot = await crawlDomSnapshot(
      page,
      'https://example.test/',
      {},
      {
        inspectFrame: async (frame) => {
          if (frame === child) throw new Error('frame detached');
          return payload([element('element-000001')]);
        },
      },
    );

    expect(snapshot.frames).toHaveLength(1);
    expect(snapshot.failures).toEqual([
      expect.objectContaining({
        framePath: 'main/frame[0]:broken',
        message: 'Error: frame detached',
      }),
    ]);
    expect(snapshot.summary.failedFrameCount).toBe(1);
  });

  it('honors frame depth and global element limits', async () => {
    const child = fakeFrame('child', 'https://child.example.test/');
    const main = fakeFrame('', 'https://example.test/', [child]);
    const page = {
      mainFrame: () => main,
      url: () => 'https://example.test/',
      title: async () => 'Example',
    } as unknown as Page;

    const snapshot = await crawlDomSnapshot(
      page,
      'https://example.test/',
      { maxElements: 1, maxFrameDepth: 0 },
      { inspectFrame: async () => payload([element('element-000001')]) },
    );

    expect(snapshot.summary.matchedElementCount).toBe(1);
    expect(snapshot.summary.truncated).toBe(true);
    expect(snapshot.warnings.join(' ')).toMatch(/maximum frame depth|global element limit/u);
  });

  it('summarizes visible and hidden element kinds deterministically', () => {
    const frame: DomFrameSnapshot = {
      path: 'main',
      parentPath: null,
      depth: 0,
      index: 0,
      name: null,
      url: 'https://example.test/',
      title: 'Example',
      language: 'en',
      readyState: 'complete',
      shadowRootCount: 0,
      inspectedElementCount: 2,
      matchedElementCount: 2,
      truncated: false,
      elements: [
        { ...element('a'), framePath: 'main' },
        {
          ...element('b', {
            kind: 'link',
            visibility: {
              visible: false,
              reason: 'display-none',
              inViewport: false,
              boundingBox: null,
            },
          }),
          framePath: 'main',
        },
      ],
    };

    expect(summarizeDomSnapshot([frame], [])).toMatchObject({
      visibleElementCount: 1,
      hiddenElementCount: 1,
      kinds: { button: 1, link: 1 },
    });
  });
});
