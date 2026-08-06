import { describe, expect, it } from 'vitest';
import { createLocatorReport, summarizeLocatorCandidates } from '../src/core/locator/report.js';
import type { DomSnapshot } from '../src/types/dom.js';
import type { ElementLocatorCandidates, LocatorCandidate } from '../src/types/locator.js';

function candidate(
  status: LocatorCandidate['evaluation']['status'],
  strategy: LocatorCandidate['strategy'],
): LocatorCandidate {
  return {
    id: `${strategy}-${status}`,
    elementId: 'element-1',
    framePath: 'main',
    shadowPath: [],
    strategy,
    priority: 10,
    spec: { type: 'css', selector: '#x' },
    playwright: 'page.locator("#x")',
    relativePlaywright: 'locator("#x")',
    rationale: 'test',
    warnings: [],
    evaluation: {
      status,
      count: status === 'unique' ? 1 : status === 'multiple' ? 2 : status === 'none' ? 0 : null,
      visibleCount: null,
      enabledCount: null,
      durationMs: null,
      error: status === 'error' ? 'bad' : null,
    },
    stability: null,
  };
}

const elements: readonly ElementLocatorCandidates[] = [
  {
    element: {
      id: 'element-1',
      framePath: 'main',
      shadowPath: [],
      domPath: '#x',
      tagName: 'button',
      kind: 'button',
      role: 'button',
      accessibleName: 'X',
      text: 'X',
      label: null,
      placeholder: null,
      attributes: {},
      visibility: { visible: true, reason: 'visible', inViewport: true, boundingBox: null },
      sensitive: false,
    },
    candidates: [
      candidate('unique', 'role'),
      candidate('multiple', 'css'),
      candidate('none', 'xpath'),
      candidate('error', 'attribute'),
    ],
    recommendedCandidateId: null,
  },
];

const snapshot: DomSnapshot = {
  schemaVersion: '1.0',
  toolkitVersion: '0.4.0',
  capturedAt: '2026-07-18T00:00:00.000Z',
  requestedUrl: 'https://example.test',
  finalUrl: 'https://example.test/',
  title: 'Test',
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
    inspectedElementCount: 1,
    matchedElementCount: 1,
    visibleElementCount: 1,
    hiddenElementCount: 0,
    interactiveElementCount: 1,
    sensitiveElementCount: 0,
    redactionCount: 0,
    truncated: false,
    kinds: { button: 1 },
  },
  frames: [],
  failures: [],
  warnings: [],
};

describe('locator reports', () => {
  it('summarizes live statuses and strategies', () => {
    expect(summarizeLocatorCandidates(elements)).toMatchObject({
      candidateCount: 4,
      uniqueCandidateCount: 1,
      multipleCandidateCount: 1,
      missingCandidateCount: 1,
      errorCandidateCount: 1,
      elementsWithUniqueCandidate: 1,
    });
  });

  it('creates a versioned report', () => {
    const report = createLocatorReport(
      snapshot,
      elements,
      {},
      {
        now: () => new Date('2026-07-18T01:00:00.000Z'),
        toolkitVersion: () => '0.5.0',
      },
    );
    expect(report).toMatchObject({
      schemaVersion: '1.1',
      toolkitVersion: '0.5.0',
      generatedAt: '2026-07-18T01:00:00.000Z',
      summary: { candidateCount: 4 },
    });
  });
});
