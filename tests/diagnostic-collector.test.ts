import type { Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { DiagnosticRecorder } from '../src/core/diagnostics/collector.js';

function fakePage() {
  const handlers = new Map<string, Set<(...args: never[]) => void>>();
  const page = {
    on: vi.fn((event: string, handler: (...args: never[]) => void) => {
      const existing = handlers.get(event) ?? new Set();
      existing.add(handler);
      handlers.set(event, existing);
      return page;
    }),
    off: vi.fn((event: string, handler: (...args: never[]) => void) => {
      handlers.get(event)?.delete(handler);
      return page;
    }),
  } as unknown as Page;

  function emit(event: string, value: unknown): void {
    for (const handler of handlers.get(event) ?? []) {
      handler(value as never);
    }
  }

  return { page, emit };
}

describe('DiagnosticRecorder', () => {
  it('captures and redacts console, page, request, and HTTP errors', () => {
    const fake = fakePage();
    const recorder = new DiagnosticRecorder(fake.page, {
      maxEntries: 10,
      now: () => new Date('2026-07-18T12:00:00.000Z'),
    });
    recorder.start();

    fake.emit('console', {
      type: () => 'error',
      text: () => 'Login failed for hunter@example.com token=secret-value',
      location: () => ({
        url: 'https://example.com/app?token=secret-value#section',
        lineNumber: 4,
        columnNumber: 2,
      }),
    });
    fake.emit('pageerror', Object.assign(new Error('Phone 719-555-1212'), { name: 'TypeError' }));

    const request = {
      method: () => 'GET',
      url: () => 'https://example.com/api?api_key=abc',
      resourceType: () => 'fetch',
      failure: () => ({ errorText: 'net::ERR_CONNECTION_REFUSED' }),
    };
    fake.emit('requestfailed', request);
    fake.emit('response', {
      status: () => 503,
      statusText: () => 'Service Unavailable',
      url: () => 'https://example.com/api?secret=abc',
      request: () => request,
    });

    recorder.stop();
    const snapshot = recorder.snapshot();

    expect(snapshot.summary).toMatchObject({
      consoleEntryCount: 1,
      pageErrorCount: 1,
      requestFailureCount: 1,
      httpErrorCount: 1,
    });
    expect(snapshot.console[0]?.text).not.toContain('hunter@example.com');
    expect(snapshot.console[0]?.location?.url).toBe('https://example.com/app');
    expect(snapshot.pageErrors[0]?.message).not.toContain('719-555-1212');
    expect(snapshot.requestFailures[0]?.url).toBe('https://example.com/api');
    expect(snapshot.httpErrors[0]?.url).toBe('https://example.com/api');
    expect(snapshot.summary.redactionCount).toBeGreaterThan(0);
    expect(fake.page.off).toHaveBeenCalledTimes(4);
  });

  it('caps each event category and records dropped entries', () => {
    const fake = fakePage();
    const recorder = new DiagnosticRecorder(fake.page, { maxEntries: 1, redact: false });
    recorder.start();
    const message = {
      type: () => 'log',
      text: () => 'message',
      location: () => ({ url: '', lineNumber: 0, columnNumber: 0 }),
    };
    fake.emit('console', message);
    fake.emit('console', message);
    const snapshot = recorder.snapshot();
    expect(snapshot.console).toHaveLength(1);
    expect(snapshot.summary.droppedConsoleEntries).toBe(1);
  });
});
