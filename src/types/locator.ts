import type { ArtifactRun } from './artifacts.js';
import type {
  BrowserNavigationResult,
  BrowserSessionCloseResult,
  BrowserSessionSummary,
  NavigationWaitUntil,
} from './browser.js';
import type { PluginHostLike } from './plugins.js';
import type {
  DomCrawlOptions,
  DomElementSnapshot,
  DomSnapshotFailure,
  DomSnapshotSummary,
} from './dom.js';

export type LocatorStrategy =
  'role' | 'label' | 'placeholder' | 'test-id' | 'text' | 'attribute' | 'css' | 'xpath';
export type LocatorEvaluationStatus = 'not-tested' | 'unique' | 'multiple' | 'none' | 'error';
export type LocatorConfidence = 'high' | 'medium' | 'low';
export type LocatorStabilitySignalCode =
  | 'strategy-base'
  | 'semantic-name'
  | 'explicit-test-hook'
  | 'stable-identifier'
  | 'generated-identifier'
  | 'copy-dependent'
  | 'structural-selector'
  | 'xpath'
  | 'unique-match'
  | 'ambiguous-match'
  | 'missing-match'
  | 'evaluation-error'
  | 'not-live-tested'
  | 'visible-match'
  | 'enabled-match'
  | 'hidden-element'
  | 'nested-frame'
  | 'shadow-root'
  | 'plugin-generated'
  | 'warning';

export interface LocatorStabilitySignal {
  readonly code: LocatorStabilitySignalCode;
  readonly label: string;
  readonly adjustment: number;
  readonly details?: string;
}

export interface LocatorStability {
  readonly score: number;
  readonly confidence: LocatorConfidence;
  readonly rank: number;
  readonly recommended: boolean;
  readonly eligible: boolean;
  readonly generatedIdentifier: boolean;
  readonly structural: boolean;
  readonly signals: readonly LocatorStabilitySignal[];
}

export interface LocatorRoleSpec {
  readonly type: 'role';
  readonly role: string;
  readonly name?: string;
  readonly exact: boolean;
}
export interface LocatorTextSpec {
  readonly type: 'label' | 'placeholder' | 'text';
  readonly value: string;
  readonly exact: boolean;
}
export interface LocatorTestIdSpec {
  readonly type: 'test-id';
  readonly attribute: string;
  readonly value: string;
}
export interface LocatorSelectorSpec {
  readonly type: 'attribute' | 'css' | 'xpath';
  readonly selector: string;
}
export type LocatorSpec =
  LocatorRoleSpec | LocatorTextSpec | LocatorTestIdSpec | LocatorSelectorSpec;

export interface LocatorEvaluation {
  readonly status: LocatorEvaluationStatus;
  readonly count: number | null;
  readonly visibleCount: number | null;
  readonly enabledCount: number | null;
  readonly durationMs: number | null;
  readonly error: string | null;
}
export interface LocatorCandidate {
  readonly id: string;
  readonly elementId: string;
  readonly framePath: string;
  readonly shadowPath: readonly string[];
  readonly strategy: LocatorStrategy;
  readonly priority: number;
  readonly spec: LocatorSpec;
  readonly playwright: string;
  readonly relativePlaywright: string;
  readonly rationale: string;
  readonly warnings: readonly string[];
  readonly evaluation: LocatorEvaluation;
  readonly stability: LocatorStability | null;
  readonly sourcePlugin?: string;
  readonly sourceHook?: string;
}
export interface ElementLocatorCandidates {
  readonly element: Pick<
    DomElementSnapshot,
    | 'id'
    | 'framePath'
    | 'shadowPath'
    | 'domPath'
    | 'tagName'
    | 'kind'
    | 'role'
    | 'accessibleName'
    | 'text'
    | 'label'
    | 'placeholder'
    | 'attributes'
    | 'visibility'
    | 'sensitive'
  >;
  readonly candidates: readonly LocatorCandidate[];
  readonly recommendedCandidateId: string | null;
}
export interface LocatorGenerationOptions {
  readonly maxCandidatesPerElement?: number;
  readonly includeXPath?: boolean;
  readonly includeRoleWithoutName?: boolean;
  readonly testIdAttributes?: readonly string[];
  readonly liveTest?: boolean;
  readonly minimumRecommendedScore?: number;
  readonly pluginHost?: PluginHostLike;
}
export interface ResolvedLocatorGenerationOptions {
  readonly maxCandidatesPerElement: number;
  readonly includeXPath: boolean;
  readonly includeRoleWithoutName: boolean;
  readonly testIdAttributes: readonly string[];
  readonly liveTest: boolean;
  readonly minimumRecommendedScore: number;
}
export interface LocatorGenerationSummary {
  readonly elementCount: number;
  readonly candidateCount: number;
  readonly testedCandidateCount: number;
  readonly uniqueCandidateCount: number;
  readonly multipleCandidateCount: number;
  readonly missingCandidateCount: number;
  readonly errorCandidateCount: number;
  readonly elementsWithUniqueCandidate: number;
  readonly elementsWithoutCandidates: number;
  readonly strategies: Readonly<Record<string, number>>;
  readonly recommendedLocatorCount: number;
  readonly elementsWithRecommendation: number;
  readonly elementsWithoutRecommendation: number;
  readonly highConfidenceCandidateCount: number;
  readonly mediumConfidenceCandidateCount: number;
  readonly lowConfidenceCandidateCount: number;
  readonly averageStabilityScore: number;
}
export interface LocatorRecommendationSummary {
  readonly elementId: string;
  readonly elementKind: DomElementSnapshot['kind'];
  readonly framePath: string;
  readonly playwright: string;
  readonly strategy: LocatorStrategy;
  readonly score: number;
  readonly confidence: LocatorConfidence;
}

export interface LocatorReport {
  readonly schemaVersion: '1.1';
  readonly toolkitVersion: string;
  readonly generatedAt: string;
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly title: string;
  readonly options: ResolvedLocatorGenerationOptions;
  readonly domSummary: DomSnapshotSummary;
  readonly summary: LocatorGenerationSummary;
  readonly elements: readonly ElementLocatorCandidates[];
  readonly failures: readonly DomSnapshotFailure[];
  readonly warnings: readonly string[];
  readonly recommendations: readonly LocatorRecommendationSummary[];
}
export interface LocatorAnalysisOptions extends DomCrawlOptions, LocatorGenerationOptions {
  readonly command?: string;
  readonly name?: string;
  readonly waitUntil?: NavigationWaitUntil;
  readonly snapshotFile?: string;
  readonly candidateFile?: string;
}
export interface LocatorAnalysisReport {
  readonly navigation: BrowserNavigationResult;
  readonly session: BrowserSessionSummary;
  readonly artifactRun: ArtifactRun;
  readonly snapshotPath: string;
  readonly candidatePath: string;
  readonly domSummary: DomSnapshotSummary;
  readonly summary: LocatorGenerationSummary;
  readonly failures: readonly DomSnapshotFailure[];
  readonly warnings: readonly string[];
  readonly recommendations: readonly LocatorRecommendationSummary[];
  readonly close: BrowserSessionCloseResult;
}
