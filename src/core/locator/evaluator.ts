import type { Frame, Locator, Page } from 'playwright';
import type { DomSnapshot } from '../../types/dom.js';
import type {
  ElementLocatorCandidates,
  LocatorCandidate,
  LocatorEvaluation,
  LocatorSpec,
} from '../../types/locator.js';

function safeFrameSegment(value: string): string {
  const normalized = value
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 50);
  return normalized === '' ? 'unnamed' : normalized;
}

function childFramePath(parentPath: string, index: number, name: string): string {
  return `${parentPath}/frame[${index}]:${safeFrameSegment(name)}`;
}

export function mapFrames(page: Page): ReadonlyMap<string, Frame> {
  const frames = new Map<string, Frame>();
  function visit(frame: Frame, path: string): void {
    frames.set(path, frame);
    for (const [index, child] of frame.childFrames().entries()) {
      visit(child, childFramePath(path, index, child.name()));
    }
  }
  visit(page.mainFrame(), 'main');
  return frames;
}

export function locatorFromSpec(frame: Frame, spec: LocatorSpec): Locator {
  switch (spec.type) {
    case 'role':
      return frame.getByRole(spec.role as never, {
        ...(spec.name === undefined ? {} : { name: spec.name }),
        exact: spec.exact,
      });
    case 'label':
      return frame.getByLabel(spec.value, { exact: spec.exact });
    case 'placeholder':
      return frame.getByPlaceholder(spec.value, { exact: spec.exact });
    case 'text':
      return frame.getByText(spec.value, { exact: spec.exact });
    case 'test-id':
      return spec.attribute === 'data-testid'
        ? frame.getByTestId(spec.value)
        : frame.locator(`[${spec.attribute}=${JSON.stringify(spec.value)}]`);
    case 'attribute':
    case 'css':
      return frame.locator(spec.selector);
    case 'xpath':
      return frame.locator(`xpath=${spec.selector}`);
  }
}

async function evaluateCandidate(
  frame: Frame,
  candidate: LocatorCandidate,
): Promise<LocatorEvaluation> {
  const started = performance.now();
  try {
    const locator = locatorFromSpec(frame, candidate.spec);
    const count = await locator.count();
    let visibleCount = 0;
    let enabledCount = 0;
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false)) visibleCount += 1;
      if (await item.isEnabled().catch(() => false)) enabledCount += 1;
    }
    return {
      status: count === 0 ? 'none' : count === 1 ? 'unique' : 'multiple',
      count,
      visibleCount,
      enabledCount,
      durationMs: Math.round((performance.now() - started) * 100) / 100,
      error: null,
    };
  } catch (error) {
    return {
      status: 'error',
      count: null,
      visibleCount: null,
      enabledCount: null,
      durationMs: Math.round((performance.now() - started) * 100) / 100,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

export async function evaluateLocatorCandidates(
  page: Page,
  _snapshot: DomSnapshot,
  elements: readonly ElementLocatorCandidates[],
): Promise<readonly ElementLocatorCandidates[]> {
  const frames = mapFrames(page);
  const results: ElementLocatorCandidates[] = [];

  for (const element of elements) {
    const frame = frames.get(element.element.framePath);
    if (frame === undefined) {
      results.push({
        ...element,
        candidates: element.candidates.map((candidate) => ({
          ...candidate,
          evaluation: {
            status: 'error',
            count: null,
            visibleCount: null,
            enabledCount: null,
            durationMs: null,
            error: `Frame ${element.element.framePath} is no longer available`,
          },
        })),
      });
      continue;
    }

    const candidates: LocatorCandidate[] = [];
    for (const candidate of element.candidates) {
      candidates.push({
        ...candidate,
        evaluation: await evaluateCandidate(frame, candidate),
      });
    }
    results.push({ ...element, candidates });
  }

  return results;
}
