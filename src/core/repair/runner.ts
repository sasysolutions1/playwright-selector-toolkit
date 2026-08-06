import { extname } from 'node:path';
import { RepairError, ToolkitError } from '../../errors/toolkit-error.js';
import type { BrowserSessionHandle, OpenBrowserSessionOptions } from '../../types/browser.js';
import type { ToolkitConfig } from '../../types/config.js';
import type { ElementLocatorCandidates } from '../../types/locator.js';
import type {
  RepairAdvisor,
  SelectorRepairItem,
  SelectorRepairOptions,
  SelectorRepairRunReport,
} from '../../types/repair.js';
import type { LoadedSelectorManifest } from '../../types/validation.js';
import { writeJsonArtifact, writeTextArtifact } from '../artifacts/manager.js';
import { openBrowserSession } from '../browser/session.js';
import { crawlDomSnapshot } from '../dom/crawler.js';
import { generateLocatorCandidates } from '../locator/candidates.js';
import { evaluateLocatorCandidates } from '../locator/evaluator.js';
import { createLocatorReport } from '../locator/report.js';
import { validateManifestSelectors, summarizeSelectorValidation } from '../validation/evaluator.js';
import { loadSelectorManifest } from '../validation/manifest.js';
import { createRepairAdvisor } from './advisor.js';
import {
  applyAdvisorRanking,
  buildDeterministicRepairCandidates,
  toAdvisorCandidates,
} from './matcher.js';
import { resolveSelectorRepairOptions } from './options.js';
import { createRepairProposalManifest, serializeRepairProposal } from './proposal.js';
import { createSelectorRepairReport } from './report.js';

export interface SelectorRepairDependencies {
  readonly loadManifest?: (path: string) => Promise<LoadedSelectorManifest>;
  readonly openSession?: (
    config: ToolkitConfig,
    options?: OpenBrowserSessionOptions,
  ) => Promise<BrowserSessionHandle>;
  readonly advisor?: RepairAdvisor;
}

function jsonFile(value: string | undefined): string {
  const path = value ?? 'reports/selector-repair.json';
  if (extname(path).toLowerCase() !== '.json') {
    throw new RepairError('REPAIR_REPORT_FAILED', 'reportFile must end in .json', {
      details: { reportFile: path },
      exitCode: 2,
    });
  }
  return path;
}

function yamlFile(value: string | undefined): string {
  const path = value ?? 'reports/selector-repair-proposal.yaml';
  if (!['.yaml', '.yml'].includes(extname(path).toLowerCase())) {
    throw new RepairError('REPAIR_PROPOSAL_FAILED', 'proposalFile must end in .yaml or .yml', {
      details: { proposalFile: path },
      exitCode: 2,
    });
  }
  return path;
}

function selectedElements(
  elements: readonly ElementLocatorCandidates[],
): readonly ElementLocatorCandidates[] {
  return elements.filter((element) =>
    element.candidates.some(
      (candidate) => candidate.evaluation.status === 'unique' && candidate.stability !== null,
    ),
  );
}

export async function runSelectorRepair(
  config: ToolkitConfig,
  manifestPath: string,
  options: SelectorRepairOptions = {},
  dependencies: SelectorRepairDependencies = {},
): Promise<SelectorRepairRunReport> {
  const loaded = await (dependencies.loadManifest ?? loadSelectorManifest)(manifestPath);
  const target = options.url ?? loaded.manifest.url ?? config.baseUrl;
  if (target === undefined) {
    throw new RepairError(
      'REPAIR_OPTIONS_INVALID',
      'Repair requires a URL argument, manifest url, or configured baseUrl',
      { exitCode: 2 },
    );
  }
  const resolved = resolveSelectorRepairOptions(options);
  const advisor = dependencies.advisor ?? createRepairAdvisor(resolved, options);
  const session = await (dependencies.openSession ?? openBrowserSession)(config, {
    command: options.command ?? 'repair',
    ...(options.name === undefined ? {} : { name: options.name }),
  });

  try {
    const navigation = await session.navigate(
      target,
      options.waitUntil ?? loaded.manifest.waitUntil,
    );
    const validation = await validateManifestSelectors(session.page, loaded.manifest);
    const validationSummary = summarizeSelectorValidation(validation);
    const snapshot = await crawlDomSnapshot(session.page, target, {
      scope: options.scope ?? 'interactive',
      includeHidden: options.includeHidden ?? false,
      ...(options.maxElements === undefined ? {} : { maxElements: options.maxElements }),
      ...(options.maxFrameDepth === undefined ? {} : { maxFrameDepth: options.maxFrameDepth }),
      ...(options.textLimit === undefined ? {} : { textLimit: options.textLimit }),
      redact: options.redact ?? true,
      ...(session.plugins === undefined ? {} : { pluginHost: session.plugins }),
    });
    const generated = generateLocatorCandidates(snapshot, {
      maxCandidatesPerElement: Math.max(resolved.maxSuggestions * 4, 12),
      includeXPath: true,
      liveTest: true,
      minimumRecommendedScore: 0,
      ...(session.plugins === undefined ? {} : { pluginHost: session.plugins }),
    });
    const evaluated = await evaluateLocatorCandidates(session.page, snapshot, generated);
    const ranked = createLocatorReport(snapshot, evaluated, {
      maxCandidatesPerElement: Math.max(resolved.maxSuggestions * 4, 12),
      minimumRecommendedScore: 0,
    }).elements;
    const usableElements = selectedElements(ranked);
    const validationById = new Map(validation.map((result) => [result.id, result]));
    const warnings = [...snapshot.warnings];
    const repairs: SelectorRepairItem[] = [];

    for (const entry of loaded.manifest.selectors) {
      const result = validationById.get(entry.id);
      if (result === undefined || result.status === 'pass') continue;
      if (!entry.required && !resolved.includeOptional) continue;

      const deterministic = buildDeterministicRepairCandidates(
        entry,
        usableElements,
        Math.max(resolved.maxSuggestions * 4, 12),
      );
      let suggestions = deterministic;
      if (advisor.provider !== 'none' && deterministic.length > 0) {
        const advice = await advisor.advise({
          selector: entry,
          validation: result,
          candidates: toAdvisorCandidates(deterministic),
        });
        suggestions = applyAdvisorRanking(deterministic, advice.recommendations);
        warnings.push(...advice.notes.map((note) => `${entry.id}: ${note}`));
      }
      suggestions = suggestions.slice(0, resolved.maxSuggestions);
      const recommended = suggestions.find(
        (suggestion) => suggestion.score >= resolved.minimumScore,
      );
      repairs.push({
        selector: entry,
        validation: result,
        suggestions,
        recommendedSuggestionId: recommended?.id ?? null,
        unresolvedReason:
          recommended === undefined
            ? suggestions.length === 0
              ? 'No unique live locator candidates matched this selector.'
              : `No suggestion met the minimum score of ${resolved.minimumScore}.`
            : null,
      });
    }

    const proposalRelativePath = yamlFile(options.proposalFile);
    const proposal = createRepairProposalManifest(loaded.manifest, repairs);
    const proposalPath = await writeTextArtifact(
      session.artifactRun,
      proposalRelativePath,
      serializeRepairProposal(proposal),
    );
    const report = createSelectorRepairReport({
      manifestPath: loaded.sourcePath,
      manifestName: loaded.manifest.name,
      manifestSelectorCount: loaded.manifest.selectors.length,
      requestedUrl: target,
      finalUrl: navigation.finalUrl,
      title: navigation.title,
      provider: advisor.provider,
      model: advisor.model,
      validationSummary,
      repairs,
      proposalPath: proposalRelativePath,
      warnings,
    });
    const reportPath = await writeJsonArtifact(
      session.artifactRun,
      jsonFile(options.reportFile),
      report,
    );
    const summary = session.summary();
    const close = await session.close({ success: true, reason: 'Repair suggestions generated' });
    return {
      navigation,
      session: summary,
      artifactRun: session.artifactRun,
      manifestPath: loaded.sourcePath,
      reportPath,
      proposalPath,
      report: { ...report, warnings: [...report.warnings, ...close.warnings] },
      close,
    };
  } catch (error) {
    await session.close({ success: false, reason: 'Selector repair failed' });
    if (error instanceof ToolkitError) throw error;
    throw new RepairError('REPAIR_FAILED', `Could not generate selector repairs at ${target}`, {
      cause: error,
      details: { target, manifestPath: loaded.sourcePath },
    });
  }
}

export function selectorRepairExitCode(
  report: Pick<SelectorRepairRunReport, 'report'>,
  failOnUnresolved = false,
): number {
  return failOnUnresolved && report.report.summary.unresolvedRequiredCount > 0 ? 1 : 0;
}
