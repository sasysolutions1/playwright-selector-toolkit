import type { Frame, Locator, Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import {
  selectorValidationExitCode,
  summarizeSelectorValidation,
  validateManifestSelectors,
} from '../src/core/validation/evaluator.js';
import type { SelectorManifest, SelectorValidationResult } from '../src/types/validation.js';

function fakeLocator(
  states: readonly { visible: boolean; enabled: boolean; editable: boolean }[],
): Locator {
  return {
    count: vi.fn(async () => states.length),
    nth: vi.fn((index: number) => ({
      isVisible: vi.fn(async () => states[index]?.visible ?? false),
      isEnabled: vi.fn(async () => states[index]?.enabled ?? false),
      isEditable: vi.fn(async () => states[index]?.editable ?? false),
    })),
  } as unknown as Locator;
}

function fakeFrame(locator: Locator, children: readonly Frame[] = [], name = ''): Frame {
  return {
    name: () => name,
    childFrames: () => [...children],
    getByRole: vi.fn(() => locator),
    getByLabel: vi.fn(() => locator),
    getByPlaceholder: vi.fn(() => locator),
    getByText: vi.fn(() => locator),
    getByTestId: vi.fn(() => locator),
    locator: vi.fn(() => locator),
  } as unknown as Frame;
}

function manifest(
  overrides: Partial<SelectorManifest['selectors'][number]> = {},
): SelectorManifest {
  return {
    schemaVersion: '1.0',
    name: 'Test',
    waitUntil: 'domcontentloaded',
    selectors: [
      {
        id: 'field',
        name: 'Field',
        required: true,
        framePath: 'main',
        locator: { type: 'label', value: 'Email', exact: true },
        assertions: { count: 1, visible: 'all', enabled: 'all', editable: 'all' },
        ...overrides,
      },
    ],
  };
}

describe('selector validation evaluator', () => {
  it('passes count and element-state assertions', async () => {
    const frame = fakeFrame(fakeLocator([{ visible: true, enabled: true, editable: true }]));
    const results = await validateManifestSelectors(
      { mainFrame: () => frame } as unknown as Page,
      manifest(),
    );
    expect(results[0]).toMatchObject({ status: 'pass', observed: { count: 1, visibleCount: 1 } });
    expect(results[0]?.assertions).toHaveLength(4);
  });

  it('fails assertions without throwing', async () => {
    const frame = fakeFrame(fakeLocator([{ visible: false, enabled: true, editable: false }]));
    const results = await validateManifestSelectors(
      { mainFrame: () => frame } as unknown as Page,
      manifest(),
    );
    expect(results[0]?.status).toBe('fail');
    expect(results[0]?.assertions.filter((item) => item.status === 'fail')).toHaveLength(2);
  });

  it('supports count ranges and any/none modes', async () => {
    const frame = fakeFrame(
      fakeLocator([
        { visible: true, enabled: true, editable: false },
        { visible: false, enabled: true, editable: false },
      ]),
    );
    const results = await validateManifestSelectors(
      { mainFrame: () => frame } as unknown as Page,
      manifest({ assertions: { count: { min: 1, max: 3 }, visible: 'any', editable: 'none' } }),
    );
    expect(results[0]?.status).toBe('pass');
  });

  it('records a missing child frame as an error', async () => {
    const frame = fakeFrame(fakeLocator([]));
    const results = await validateManifestSelectors(
      { mainFrame: () => frame } as unknown as Page,
      manifest({ framePath: 'main/frame[0]:login' }),
    );
    expect(results[0]?.status).toBe('error');
    expect(results[0]?.error).toContain('not available');
  });

  it('makes only required failures fatal', () => {
    const base = {
      id: 'x',
      name: 'X',
      framePath: 'main',
      locator: { type: 'css', selector: '#x' } as const,
      playwright: 'page.locator("#x")',
      observed: { count: 0, visibleCount: 0, enabledCount: 0, editableCount: 0, durationMs: 1 },
      assertions: [],
      error: null,
    };
    const results: SelectorValidationResult[] = [
      { ...base, required: true, status: 'pass' },
      { ...base, id: 'optional', required: false, status: 'fail' },
    ];
    const summary = summarizeSelectorValidation(results);
    expect(summary).toMatchObject({ success: true, optionalFailures: 1, requiredFailures: 0 });
    expect(selectorValidationExitCode(summary)).toBe(0);
  });
});
