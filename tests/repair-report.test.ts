import { describe, expect, it } from 'vitest';
import { createSelectorRepairReport, summarizeSelectorRepairs } from '../src/core/repair/report.js';
import type { SelectorRepairItem } from '../src/types/repair.js';
import type { SelectorManifestEntry, SelectorValidationResult } from '../src/types/validation.js';

function item(
  required: boolean,
  recommended: boolean,
  source: 'deterministic' | 'ai-assisted' = 'deterministic',
): SelectorRepairItem {
  const selector: SelectorManifestEntry = {
    id: required ? 'required' : 'optional',
    name: 'Control',
    required,
    framePath: 'main',
    locator: { type: 'css', selector: '#old' },
    assertions: { count: 1 },
  };
  const validation: SelectorValidationResult = {
    id: selector.id,
    name: selector.name,
    required,
    framePath: 'main',
    locator: selector.locator,
    playwright: "page.locator('#old')",
    status: 'fail',
    observed: { count: 0, visibleCount: 0, enabledCount: 0, editableCount: 0, durationMs: 1 },
    assertions: [],
    error: null,
  };
  const suggestion = {
    id: `${selector.id}:candidate`,
    candidateId: 'candidate',
    locator: { type: 'css' as const, selector: '#new' },
    playwright: "page.locator('#new')",
    strategy: 'css' as const,
    score: 80,
    confidence: 'high' as const,
    source,
    element: {
      elementId: 'element',
      framePath: 'main',
      shadowPath: [],
      tagName: 'button',
      kind: 'button' as const,
      role: 'button',
      accessibleName: 'Control',
      label: null,
      placeholder: null,
      visible: true,
    },
    reasons: [],
    warnings: [],
    aiConfidence: source === 'ai-assisted' ? 0.9 : null,
    aiRationale: source === 'ai-assisted' ? 'Best semantic match.' : null,
  };
  return {
    selector,
    validation,
    suggestions: recommended ? [suggestion] : [],
    recommendedSuggestionId: recommended ? suggestion.id : null,
    unresolvedReason: recommended ? null : 'No match',
  };
}

describe('selector repair reports', () => {
  it('summarizes required, optional, unresolved, and AI-assisted repairs', () => {
    const summary = summarizeSelectorRepairs(4, [
      item(true, true, 'ai-assisted'),
      item(false, false),
    ]);
    expect(summary).toMatchObject({
      manifestSelectorCount: 4,
      failedSelectorCount: 2,
      requiredFailureCount: 1,
      optionalFailureCount: 1,
      selectorsWithRecommendation: 1,
      unresolvedRequiredCount: 0,
      unresolvedOptionalCount: 1,
      aiAssistedCount: 1,
      approvalRequired: true,
    });
  });

  it('creates a versioned report with explicit approval requirements', () => {
    const report = createSelectorRepairReport(
      {
        manifestPath: '/tmp/selectors.yaml',
        manifestName: 'Login',
        manifestSelectorCount: 1,
        requestedUrl: 'https://example.com/login',
        finalUrl: 'https://example.com/login',
        title: 'Login',
        provider: 'none',
        model: null,
        validationSummary: {
          total: 1,
          required: 1,
          optional: 0,
          passed: 0,
          failed: 1,
          errors: 0,
          requiredFailures: 1,
          optionalFailures: 0,
          success: false,
        },
        repairs: [item(true, true)],
        proposalPath: 'reports/selector-repair-proposal.yaml',
        warnings: [],
      },
      { toolkitVersion: () => '0.15.0', now: () => new Date('2026-07-18T00:00:00Z') },
    );
    expect(report.schemaVersion).toBe('1.0');
    expect(report.approvalRequired).toBe(true);
    expect(report.summary.selectorsWithRecommendation).toBe(1);
  });
});
