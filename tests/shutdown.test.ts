import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { registerGracefulShutdown } from '../src/core/browser/shutdown.js';
import type { BrowserSessionHandle } from '../src/types/browser.js';

class FakeProcess extends EventEmitter {
  exitCode: number | undefined;
}

describe('registerGracefulShutdown', () => {
  it('closes once, sets a signal exit code, and supports unregistering', async () => {
    const host = new FakeProcess();
    const close = vi.fn(async () => ({
      closedAt: '2026-07-17T00:00:00.000Z',
      tracePath: null,
      screenshotPath: null,
      storageStatePath: null,
      warnings: [],
    }));
    const session = { close } as unknown as BrowserSessionHandle;
    const unregister = registerGracefulShutdown(session, {
      processHost: host as unknown as NodeJS.Process,
      signals: ['SIGTERM'],
    });

    host.emit('SIGTERM');
    host.emit('SIGTERM');
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(host.exitCode).toBe(143));

    unregister();
    expect(host.listenerCount('SIGTERM')).toBe(0);
  });
});
