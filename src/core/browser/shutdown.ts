import type { BrowserSessionHandle, GracefulShutdownOptions } from '../../types/browser.js';

const DEFAULT_EXIT_CODES: Readonly<Record<'SIGINT' | 'SIGTERM', number>> = {
  SIGINT: 130,
  SIGTERM: 143,
};

export function registerGracefulShutdown(
  session: BrowserSessionHandle,
  options: GracefulShutdownOptions = {},
): () => void {
  const host = options.processHost ?? process;
  const signals = options.signals ?? ['SIGINT', 'SIGTERM'];
  const handlers = new Map<NodeJS.Signals, () => void>();
  let handling = false;

  for (const signal of signals) {
    const handler = (): void => {
      if (handling) return;
      handling = true;

      void Promise.resolve()
        .then(async () => options.onSignal?.(signal))
        .catch(() => undefined)
        .then(async () =>
          session.close({
            success: false,
            reason: `Received ${signal}`,
          }),
        )
        .finally(() => {
          host.exitCode =
            options.exitCodes?.[signal] ??
            (signal === 'SIGINT' || signal === 'SIGTERM' ? DEFAULT_EXIT_CODES[signal] : 1);
        });
    };

    handlers.set(signal, handler);
    host.once(signal, handler);
  }

  return () => {
    for (const [signal, handler] of handlers) {
      host.removeListener(signal, handler);
    }
  };
}
