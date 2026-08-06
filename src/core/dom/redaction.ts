export interface RedactedValue {
  readonly value: string;
  readonly redactionsApplied: number;
}

const REDACTION_PATTERNS: readonly Readonly<{ pattern: RegExp; replacement: string }>[] = [
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    pattern: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/gu,
    replacement: '[REDACTED_PHONE]',
  },
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/gu,
    replacement: '[REDACTED_SSN]',
  },
  {
    pattern: /\b(?:\d[ -]*?){13,19}\b/gu,
    replacement: '[REDACTED_PAYMENT_CARD]',
  },
  {
    pattern: /\b(?:bearer\s+)?[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/giu,
    replacement: '[REDACTED_TOKEN]',
  },
  {
    pattern: /\b(?:sk|pk|api|token|secret)[-_][A-Za-z0-9_-]{16,}\b/giu,
    replacement: '[REDACTED_SECRET]',
  },
  {
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|authorization|password|passwd|secret|token)\s*[:=]\s*["']?[^\s"',;]+["']?/giu,
    replacement: '[REDACTED_SECRET]',
  },
];

export function redactSensitiveText(value: string): RedactedValue {
  let result = value;
  let redactionsApplied = 0;

  for (const entry of REDACTION_PATTERNS) {
    result = result.replace(entry.pattern, () => {
      redactionsApplied += 1;
      return entry.replacement;
    });
  }

  return { value: result, redactionsApplied };
}

export function sanitizeUrl(value: string, redact: boolean): RedactedValue {
  if (!redact) return { value, redactionsApplied: 0 };

  try {
    const parsed = new URL(value, 'https://selector-toolkit.invalid');
    const hadSensitiveSuffix = parsed.search !== '' || parsed.hash !== '';
    parsed.search = '';
    parsed.hash = '';
    const serialized =
      parsed.origin === 'https://selector-toolkit.invalid'
        ? `${parsed.pathname}`
        : parsed.toString();
    return {
      value: serialized,
      redactionsApplied: hadSensitiveSuffix ? 1 : 0,
    };
  } catch {
    return redactSensitiveText(value);
  }
}
