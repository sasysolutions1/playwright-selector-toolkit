import { RepairError } from '../../errors/toolkit-error.js';
import type { ResolvedSelectorRepairOptions, SelectorRepairOptions } from '../../types/repair.js';

export const DEFAULT_REPAIR_OPTIONS: ResolvedSelectorRepairOptions = {
  provider: 'none',
  model: null,
  apiBaseUrl: 'https://api.openai.com/v1',
  aiTimeoutMs: 30_000,
  includeOptional: false,
  maxSuggestions: 3,
  minimumScore: 55,
};

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RepairError('REPAIR_OPTIONS_INVALID', `${field} must be a positive integer`, {
      details: { field, value },
      exitCode: 2,
    });
  }
  return value;
}

function score(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RepairError('REPAIR_OPTIONS_INVALID', 'minimumScore must be between 0 and 100', {
      details: { minimumScore: value },
      exitCode: 2,
    });
  }
  return value;
}

export function resolveSelectorRepairOptions(
  options: SelectorRepairOptions = {},
): ResolvedSelectorRepairOptions {
  const provider = options.provider ?? DEFAULT_REPAIR_OPTIONS.provider;
  if (provider !== 'none' && provider !== 'openai') {
    throw new RepairError('REPAIR_OPTIONS_INVALID', 'provider must be none or openai', {
      details: { provider },
      exitCode: 2,
    });
  }
  const model =
    provider === 'openai'
      ? (options.model ?? process.env['SELECTOR_AI_MODEL'] ?? 'gpt-5-mini')
      : null;
  return {
    provider,
    model,
    apiBaseUrl: (
      options.apiBaseUrl ??
      process.env['OPENAI_BASE_URL'] ??
      DEFAULT_REPAIR_OPTIONS.apiBaseUrl
    ).replace(/\/+$/u, ''),
    aiTimeoutMs: positiveInteger(
      options.aiTimeoutMs ?? DEFAULT_REPAIR_OPTIONS.aiTimeoutMs,
      'aiTimeoutMs',
    ),
    includeOptional: options.includeOptional ?? DEFAULT_REPAIR_OPTIONS.includeOptional,
    maxSuggestions: positiveInteger(
      options.maxSuggestions ?? DEFAULT_REPAIR_OPTIONS.maxSuggestions,
      'maxSuggestions',
    ),
    minimumScore: score(options.minimumScore ?? DEFAULT_REPAIR_OPTIONS.minimumScore),
  };
}
