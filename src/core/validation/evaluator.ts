import type { Frame, Page } from 'playwright';
import type {
  SelectorAssertionResult,
  SelectorManifest,
  SelectorManifestEntry,
  SelectorValidationResult,
  SelectorValidationSummary,
  ValidationPresenceMode,
} from '../../types/validation.js';
import { locatorFromSpec, mapFrames } from '../locator/evaluator.js';
import { serializePlaywrightLocator } from '../locator/serializer.js';

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function countExpectation(value: SelectorManifestEntry['assertions']['count']): string {
  if (typeof value === 'number') return `exactly ${value}`;
  if (value.min !== undefined && value.max !== undefined)
    return `between ${value.min} and ${value.max}`;
  if (value.min !== undefined) return `at least ${value.min}`;
  return `at most ${String(value.max)}`;
}

function countPass(actual: number, value: SelectorManifestEntry['assertions']['count']): boolean {
  if (typeof value === 'number') return actual === value;
  return (
    (value.min === undefined || actual >= value.min) &&
    (value.max === undefined || actual <= value.max)
  );
}

function presencePass(mode: ValidationPresenceMode, actual: number, total: number): boolean {
  if (mode === 'none') return actual === 0;
  if (mode === 'all') return total > 0 && actual === total;
  return actual > 0;
}

function assertion(
  assertionName: SelectorAssertionResult['assertion'],
  expected: string,
  actual: number,
  passed: boolean,
): SelectorAssertionResult {
  return {
    assertion: assertionName,
    status: passed ? 'pass' : 'fail',
    expected,
    actual,
    message: passed
      ? `${assertionName} assertion passed (${actual}; expected ${expected})`
      : `${assertionName} assertion failed (${actual}; expected ${expected})`,
  };
}

async function evaluateEntry(
  frame: Frame,
  entry: SelectorManifestEntry,
): Promise<SelectorValidationResult> {
  const started = performance.now();
  const playwright = serializePlaywrightLocator(entry.locator, entry.framePath);
  try {
    const locator = locatorFromSpec(frame, entry.locator);
    const count = await locator.count();
    let visibleCount = 0;
    let enabledCount = 0;
    let editableCount = 0;
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false)) visibleCount += 1;
      if (await item.isEnabled().catch(() => false)) enabledCount += 1;
      if (await item.isEditable().catch(() => false)) editableCount += 1;
    }

    const results: SelectorAssertionResult[] = [];
    const countExpected = countExpectation(entry.assertions.count);
    results.push(
      assertion('count', countExpected, count, countPass(count, entry.assertions.count)),
    );
    for (const [name, actual] of [
      ['visible', visibleCount],
      ['enabled', enabledCount],
      ['editable', editableCount],
    ] as const) {
      const mode = entry.assertions[name];
      if (mode !== undefined)
        results.push(assertion(name, mode, actual, presencePass(mode, actual, count)));
    }

    return {
      id: entry.id,
      name: entry.name,
      ...(entry.description === undefined ? {} : { description: entry.description }),
      required: entry.required,
      framePath: entry.framePath,
      locator: entry.locator,
      playwright,
      status: results.every((result) => result.status === 'pass') ? 'pass' : 'fail',
      observed: {
        count,
        visibleCount,
        enabledCount,
        editableCount,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
      },
      assertions: results,
      error: null,
    };
  } catch (error) {
    return {
      id: entry.id,
      name: entry.name,
      ...(entry.description === undefined ? {} : { description: entry.description }),
      required: entry.required,
      framePath: entry.framePath,
      locator: entry.locator,
      playwright,
      status: 'error',
      observed: {
        count: null,
        visibleCount: null,
        enabledCount: null,
        editableCount: null,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
      },
      assertions: [],
      error: errorText(error),
    };
  }
}

function missingFrame(entry: SelectorManifestEntry): SelectorValidationResult {
  return {
    id: entry.id,
    name: entry.name,
    ...(entry.description === undefined ? {} : { description: entry.description }),
    required: entry.required,
    framePath: entry.framePath,
    locator: entry.locator,
    playwright: serializePlaywrightLocator(entry.locator, entry.framePath),
    status: 'error',
    observed: {
      count: null,
      visibleCount: null,
      enabledCount: null,
      editableCount: null,
      durationMs: 0,
    },
    assertions: [],
    error: `Frame ${entry.framePath} is not available`,
  };
}

export function summarizeSelectorValidation(
  results: readonly SelectorValidationResult[],
): SelectorValidationSummary {
  const required = results.filter((result) => result.required).length;
  const passed = results.filter((result) => result.status === 'pass').length;
  const failed = results.filter((result) => result.status === 'fail').length;
  const errors = results.filter((result) => result.status === 'error').length;
  const requiredFailures = results.filter(
    (result) => result.required && result.status !== 'pass',
  ).length;
  const optionalFailures = results.filter(
    (result) => !result.required && result.status !== 'pass',
  ).length;
  return {
    total: results.length,
    required,
    optional: results.length - required,
    passed,
    failed,
    errors,
    requiredFailures,
    optionalFailures,
    success: requiredFailures === 0,
  };
}

export async function validateManifestSelectors(
  page: Page,
  manifest: SelectorManifest,
): Promise<readonly SelectorValidationResult[]> {
  const frames = mapFrames(page);
  const results: SelectorValidationResult[] = [];
  for (const entry of manifest.selectors) {
    const frame = frames.get(entry.framePath);
    results.push(frame === undefined ? missingFrame(entry) : await evaluateEntry(frame, entry));
  }
  return results;
}

export function selectorValidationExitCode(summary: SelectorValidationSummary): number {
  return summary.success ? 0 : 1;
}
