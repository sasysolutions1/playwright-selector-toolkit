import { describe, expect, it } from 'vitest';
import {
  createRepairProposalManifest,
  serializeRepairProposal,
} from '../src/core/repair/proposal.js';
import type { SelectorManifest } from '../src/types/validation.js';
import type { SelectorRepairItem } from '../src/types/repair.js';

const manifest: SelectorManifest = {
  schemaVersion: '1.0',
  name: 'Login',
  waitUntil: 'domcontentloaded',
  selectors: [
    {
      id: 'submit',
      name: 'Submit',
      required: true,
      framePath: 'main',
      locator: { type: 'css', selector: '#old-submit' },
      assertions: { count: 1 },
    },
  ],
};

const repair: SelectorRepairItem = {
  selector: manifest.selectors[0]!,
  validation: {
    id: 'submit',
    name: 'Submit',
    required: true,
    framePath: 'main',
    locator: manifest.selectors[0]!.locator,
    playwright: "page.locator('#old-submit')",
    status: 'fail',
    observed: { count: 0, visibleCount: 0, enabledCount: 0, editableCount: 0, durationMs: 1 },
    assertions: [],
    error: null,
  },
  suggestions: [
    {
      id: 'submit:candidate',
      candidateId: 'candidate',
      locator: { type: 'test-id', attribute: 'data-testid', value: 'submit' },
      playwright: "page.getByTestId('submit')",
      strategy: 'test-id',
      score: 94,
      confidence: 'high',
      source: 'deterministic',
      element: {
        elementId: 'button',
        framePath: 'main',
        shadowPath: [],
        tagName: 'button',
        kind: 'button',
        role: 'button',
        accessibleName: 'Submit',
        label: null,
        placeholder: null,
        visible: true,
      },
      reasons: [],
      warnings: [],
      aiConfidence: null,
      aiRationale: null,
    },
  ],
  recommendedSuggestionId: 'submit:candidate',
  unresolvedReason: null,
};

describe('repair proposal', () => {
  it('creates a new manifest without mutating the original', () => {
    const proposal = createRepairProposalManifest(manifest, [repair]);
    expect(proposal.selectors[0]?.locator).toEqual({
      type: 'test-id',
      attribute: 'data-testid',
      value: 'submit',
    });
    expect(manifest.selectors[0]?.locator).toEqual({ type: 'css', selector: '#old-submit' });
  });

  it('adds explicit human-review warnings to YAML output', () => {
    const output = serializeRepairProposal(createRepairProposalManifest(manifest, [repair]));
    expect(output).toContain('REVIEW REQUIRED');
    expect(output).toContain('data-testid');
  });
});
