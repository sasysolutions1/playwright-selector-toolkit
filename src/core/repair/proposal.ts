import { stringify as stringifyYaml } from 'yaml';
import { RepairError } from '../../errors/toolkit-error.js';
import type { SelectorManifest } from '../../types/validation.js';
import type { SelectorRepairItem } from '../../types/repair.js';

export function createRepairProposalManifest(
  manifest: SelectorManifest,
  repairs: readonly SelectorRepairItem[],
): SelectorManifest {
  const replacements = new Map(
    repairs.flatMap((repair) => {
      const recommended = repair.suggestions.find(
        (suggestion) => suggestion.id === repair.recommendedSuggestionId,
      );
      return recommended === undefined ? [] : [[repair.selector.id, recommended.locator] as const];
    }),
  );

  return {
    ...manifest,
    selectors: manifest.selectors.map((selector) => {
      const locator = replacements.get(selector.id);
      return locator === undefined ? selector : { ...selector, locator };
    }),
  };
}

export function serializeRepairProposal(manifest: SelectorManifest): string {
  try {
    return [
      '# REVIEW REQUIRED: generated selector repair proposal.',
      '# The original manifest was not modified. Validate and approve each change before use.',
      stringifyYaml(manifest, { lineWidth: 100 }),
    ].join('\n');
  } catch (error) {
    throw new RepairError('REPAIR_PROPOSAL_FAILED', 'Could not serialize repair proposal', {
      cause: error,
    });
  }
}
