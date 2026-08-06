import { describe, expect, it } from 'vitest';
import { redactSensitiveText, sanitizeUrl } from '../src/core/dom/redaction.js';

describe('DOM redaction', () => {
  it('redacts common sensitive values while preserving surrounding text', () => {
    const result = redactSensitiveText(
      'Email hunter@example.com, call 719-555-1212, SSN 123-45-6789.',
    );

    expect(result.value).toBe('Email [REDACTED_EMAIL], call [REDACTED_PHONE], SSN [REDACTED_SSN].');
    expect(result.redactionsApplied).toBe(3);
  });

  it('redacts named secret assignments', () => {
    const result = redactSensitiveText('token=secret-value password: hunter2 api_key=abc123');
    expect(result.value).not.toContain('secret-value');
    expect(result.value).not.toContain('hunter2');
    expect(result.value).not.toContain('abc123');
    expect(result.redactionsApplied).toBe(3);
  });

  it('removes URL query strings and fragments by default', () => {
    const result = sanitizeUrl('https://example.com/account?token=secret#profile', true);

    expect(result.value).toBe('https://example.com/account');
    expect(result.redactionsApplied).toBe(1);
  });

  it('preserves URLs when redaction is disabled', () => {
    const value = 'https://example.com/account?token=secret#profile';
    expect(sanitizeUrl(value, false)).toEqual({ value, redactionsApplied: 0 });
  });
});
