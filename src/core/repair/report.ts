import type {
  RepairProviderName,
  SelectorRepairItem,
  SelectorRepairReport,
  SelectorRepairSummary,
} from '../../types/repair.js';
import type { SelectorValidationSummary } from '../../types/validation.js';
import { getToolkitVersion } from '../version.js';

export function summarizeSelectorRepairs(
  manifestSelectorCount: number,
  repairs: readonly SelectorRepairItem[],
): SelectorRepairSummary {
  const required = repairs.filter((repair) => repair.selector.required);
  const optional = repairs.filter((repair) => !repair.selector.required);
  return {
    manifestSelectorCount,
    failedSelectorCount: repairs.length,
    requiredFailureCount: required.length,
    optionalFailureCount: optional.length,
    selectorsWithSuggestions: repairs.filter((repair) => repair.suggestions.length > 0).length,
    selectorsWithRecommendation: repairs.filter((repair) => repair.recommendedSuggestionId !== null)
      .length,
    unresolvedRequiredCount: required.filter((repair) => repair.recommendedSuggestionId === null)
      .length,
    unresolvedOptionalCount: optional.filter((repair) => repair.recommendedSuggestionId === null)
      .length,
    aiAssistedCount: repairs.filter((repair) =>
      repair.suggestions.some((suggestion) => suggestion.source === 'ai-assisted'),
    ).length,
    approvalRequired: true,
  };
}

interface CreateRepairReportInput {
  readonly manifestPath: string;
  readonly manifestName: string;
  readonly manifestSelectorCount: number;
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly title: string;
  readonly provider: RepairProviderName;
  readonly model: string | null;
  readonly validationSummary: SelectorValidationSummary;
  readonly repairs: readonly SelectorRepairItem[];
  readonly proposalPath: string;
  readonly warnings: readonly string[];
}

export function createSelectorRepairReport(
  input: CreateRepairReportInput,
  dependencies: { readonly now?: () => Date; readonly toolkitVersion?: () => string } = {},
): SelectorRepairReport {
  return {
    schemaVersion: '1.0',
    toolkitVersion: dependencies.toolkitVersion?.() ?? getToolkitVersion(),
    generatedAt: (dependencies.now?.() ?? new Date()).toISOString(),
    manifestPath: input.manifestPath,
    manifestName: input.manifestName,
    requestedUrl: input.requestedUrl,
    finalUrl: input.finalUrl,
    title: input.title,
    provider: input.provider,
    model: input.model,
    summary: summarizeSelectorRepairs(input.manifestSelectorCount, input.repairs),
    validationSummary: input.validationSummary,
    repairs: input.repairs,
    proposalPath: input.proposalPath,
    approvalRequired: true,
    warnings: input.warnings,
  };
}
