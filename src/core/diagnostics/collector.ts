import type { ConsoleMessage, Page, Request, Response } from 'playwright';
import type {
  DiagnosticConsoleEntry,
  DiagnosticHttpErrorEntry,
  DiagnosticPageErrorEntry,
  DiagnosticRecorderSnapshot,
  DiagnosticRequestFailureEntry,
} from '../../types/diagnostics.js';
import { redactSensitiveText, sanitizeUrl } from '../dom/redaction.js';

export interface DiagnosticRecorderOptions {
  readonly includeConsole?: boolean;
  readonly includeNetwork?: boolean;
  readonly maxEntries?: number;
  readonly redact?: boolean;
  readonly now?: () => Date;
}

interface MutableCounters {
  droppedConsoleEntries: number;
  droppedPageErrors: number;
  droppedRequestFailures: number;
  droppedHttpErrors: number;
  redactionCount: number;
}

function sanitizeText(value: string, redact: boolean, counters: MutableCounters): string {
  const limited = value.length > 8_000 ? `${value.slice(0, 8_000)}…` : value;
  if (!redact) return limited;
  const result = redactSensitiveText(limited);
  counters.redactionCount += result.redactionsApplied;
  return result.value;
}

function safeUrl(value: string, redact: boolean, counters: MutableCounters): string {
  const result = sanitizeUrl(value, redact);
  counters.redactionCount += result.redactionsApplied;
  return result.value;
}

function pushLimited<Value>(
  values: Value[],
  value: Value,
  maxEntries: number,
  onDrop: () => void,
): void {
  if (values.length >= maxEntries) {
    onDrop();
    return;
  }
  values.push(value);
}

export class DiagnosticRecorder {
  readonly #page: Page;
  readonly #includeConsole: boolean;
  readonly #includeNetwork: boolean;
  readonly #maxEntries: number;
  readonly #redact: boolean;
  readonly #now: () => Date;
  readonly #console: DiagnosticConsoleEntry[] = [];
  readonly #pageErrors: DiagnosticPageErrorEntry[] = [];
  readonly #requestFailures: DiagnosticRequestFailureEntry[] = [];
  readonly #httpErrors: DiagnosticHttpErrorEntry[] = [];
  readonly #counters: MutableCounters = {
    droppedConsoleEntries: 0,
    droppedPageErrors: 0,
    droppedRequestFailures: 0,
    droppedHttpErrors: 0,
    redactionCount: 0,
  };
  #started = false;

  readonly #onConsole = (message: ConsoleMessage): void => {
    const location = message.location();
    pushLimited(
      this.#console,
      {
        timestamp: this.#now().toISOString(),
        type: message.type(),
        text: sanitizeText(message.text(), this.#redact, this.#counters),
        location:
          location.url === ''
            ? null
            : {
                url: safeUrl(location.url, this.#redact, this.#counters),
                lineNumber: location.lineNumber,
                columnNumber: location.columnNumber,
              },
      },
      this.#maxEntries,
      () => {
        this.#counters.droppedConsoleEntries += 1;
      },
    );
  };

  readonly #onPageError = (error: Error): void => {
    pushLimited(
      this.#pageErrors,
      {
        timestamp: this.#now().toISOString(),
        name: sanitizeText(error.name, this.#redact, this.#counters),
        message: sanitizeText(error.message, this.#redact, this.#counters),
        stack:
          error.stack === undefined
            ? null
            : sanitizeText(error.stack, this.#redact, this.#counters),
      },
      this.#maxEntries,
      () => {
        this.#counters.droppedPageErrors += 1;
      },
    );
  };

  readonly #onRequestFailed = (request: Request): void => {
    pushLimited(
      this.#requestFailures,
      {
        timestamp: this.#now().toISOString(),
        method: request.method(),
        url: safeUrl(request.url(), this.#redact, this.#counters),
        resourceType: request.resourceType(),
        failureText:
          request.failure()?.errorText === undefined
            ? null
            : sanitizeText(request.failure()?.errorText ?? '', this.#redact, this.#counters),
      },
      this.#maxEntries,
      () => {
        this.#counters.droppedRequestFailures += 1;
      },
    );
  };

  readonly #onResponse = (response: Response): void => {
    if (response.status() < 400) return;
    const request = response.request();
    pushLimited(
      this.#httpErrors,
      {
        timestamp: this.#now().toISOString(),
        method: request.method(),
        url: safeUrl(response.url(), this.#redact, this.#counters),
        resourceType: request.resourceType(),
        status: response.status(),
        statusText: sanitizeText(response.statusText(), this.#redact, this.#counters),
      },
      this.#maxEntries,
      () => {
        this.#counters.droppedHttpErrors += 1;
      },
    );
  };

  constructor(page: Page, options: DiagnosticRecorderOptions = {}) {
    this.#page = page;
    this.#includeConsole = options.includeConsole ?? true;
    this.#includeNetwork = options.includeNetwork ?? true;
    this.#maxEntries = options.maxEntries ?? 250;
    this.#redact = options.redact ?? true;
    this.#now = options.now ?? (() => new Date());
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    if (this.#includeConsole) {
      this.#page.on('console', this.#onConsole);
      this.#page.on('pageerror', this.#onPageError);
    }
    if (this.#includeNetwork) {
      this.#page.on('requestfailed', this.#onRequestFailed);
      this.#page.on('response', this.#onResponse);
    }
  }

  stop(): void {
    if (!this.#started) return;
    this.#started = false;
    this.#page.off('console', this.#onConsole);
    this.#page.off('pageerror', this.#onPageError);
    this.#page.off('requestfailed', this.#onRequestFailed);
    this.#page.off('response', this.#onResponse);
  }

  snapshot(): DiagnosticRecorderSnapshot {
    return {
      schemaVersion: '1.0',
      capturedAt: this.#now().toISOString(),
      console: [...this.#console],
      pageErrors: [...this.#pageErrors],
      requestFailures: [...this.#requestFailures],
      httpErrors: [...this.#httpErrors],
      summary: {
        consoleEntryCount: this.#console.length,
        pageErrorCount: this.#pageErrors.length,
        requestFailureCount: this.#requestFailures.length,
        httpErrorCount: this.#httpErrors.length,
        droppedConsoleEntries: this.#counters.droppedConsoleEntries,
        droppedPageErrors: this.#counters.droppedPageErrors,
        droppedRequestFailures: this.#counters.droppedRequestFailures,
        droppedHttpErrors: this.#counters.droppedHttpErrors,
        redactionCount: this.#counters.redactionCount,
      },
    };
  }
}
