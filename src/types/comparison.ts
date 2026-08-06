import type { ArtifactRun } from './artifacts.js';
import type { BrowserSessionCloseResult, NavigationWaitUntil } from './browser.js';
import type { DomCrawlOptions, DomElementSnapshot, DomSnapshot } from './dom.js';
import type { LocatorConfidence, LocatorStrategy } from './locator.js';
import type { BaselineRecord, SnapshotBundleReport } from './snapshot.js';

export type ElementMatchMethod = 'structural' | 'semantic' | 'similarity';
export type ElementDifferenceKind =
  'unchanged' | 'added' | 'removed' | 'moved' | 'changed' | 'moved-and-changed';

export type ElementChangeField =
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
  | 'visible'
  | 'disabled'
  | 'readonly'
  | 'required'
  | 'checked'
  | 'selected'
  | 'interactive';

export interface ComparedElementSummary {
  readonly elementId: string;
  readonly framePath: string;
  readonly shadowPath: readonly string[];
  readonly domPath: string;
  readonly tagName: string;
  readonly kind: string;
  readonly role: string | null;
  readonly accessibleName: string | null;
  readonly label: string | null;
  readonly placeholder: string | null;
  readonly attributes: Readonly<Record<string, string>>;
  readonly visible: boolean;
}

export interface ReplacementLocatorSuggestion {
  readonly playwright: string;
  readonly strategy: LocatorStrategy;
  readonly score: number;
  readonly confidence: LocatorConfidence;
  readonly rationale: string;
  readonly warnings: readonly string[];
}

export interface MatchedElementDifference {
  readonly kind: Exclude<ElementDifferenceKind, 'added' | 'removed'>;
  readonly matchMethod: ElementMatchMethod;
  readonly similarity: number;
  readonly baseline: ComparedElementSummary;
  readonly current: ComparedElementSummary;
  readonly changedFields: readonly ElementChangeField[];
  readonly moved: boolean;
  readonly replacementLocators: readonly ReplacementLocatorSuggestion[];
}

export interface AddedElementDifference {
  readonly kind: 'added';
  readonly current: ComparedElementSummary;
  readonly replacementLocators: readonly ReplacementLocatorSuggestion[];
}

export interface RemovedElementDifference {
  readonly kind: 'removed';
  readonly baseline: ComparedElementSummary;
}

export type ElementDifference =
  MatchedElementDifference | AddedElementDifference | RemovedElementDifference;

export interface DomComparisonOptions {
  readonly similarityThreshold?: number;
  readonly includeUnchanged?: boolean;
  readonly maxReplacementLocators?: number;
  readonly minimumLocatorScore?: number;
}

export interface ResolvedDomComparisonOptions {
  readonly similarityThreshold: number;
  readonly includeUnchanged: boolean;
  readonly maxReplacementLocators: number;
  readonly minimumLocatorScore: number;
}

export interface DomComparisonSummary {
  readonly baselineElementCount: number;
  readonly currentElementCount: number;
  readonly matchedElementCount: number;
  readonly unchangedElementCount: number;
  readonly addedElementCount: number;
  readonly removedElementCount: number;
  readonly movedElementCount: number;
  readonly changedElementCount: number;
  readonly movedAndChangedElementCount: number;
  readonly driftElementCount: number;
  readonly driftDetected: boolean;
  readonly matchMethods: Readonly<Record<ElementMatchMethod, number>>;
}

export interface DomComparisonReport {
  readonly schemaVersion: '1.0';
  readonly toolkitVersion: string;
  readonly generatedAt: string;
  readonly baseline: {
    readonly name: string;
    readonly version: string;
    readonly capturedAt: string;
    readonly finalUrl: string;
    readonly title: string;
  };
  readonly current: {
    readonly capturedAt: string;
    readonly finalUrl: string;
    readonly title: string;
  };
  readonly options: ResolvedDomComparisonOptions;
  readonly summary: DomComparisonSummary;
  readonly differences: readonly ElementDifference[];
  readonly warnings: readonly string[];
}

export interface LoadedBaselineSnapshot {
  readonly baseline: BaselineRecord;
  readonly domSnapshot: DomSnapshot;
}

export interface DomComparisonRunOptions extends DomCrawlOptions, DomComparisonOptions {
  readonly command?: string;
  readonly name?: string;
  readonly version?: string;
  readonly waitUntil?: NavigationWaitUntil;
  readonly reportFile?: string;
}

export interface DomComparisonRunReport {
  readonly baseline: BaselineRecord;
  readonly currentSnapshot: SnapshotBundleReport;
  readonly artifactRun: ArtifactRun;
  readonly reportPath: string;
  readonly comparison: DomComparisonReport;
  readonly close: BrowserSessionCloseResult;
}

export interface ComparisonElementInput {
  readonly element: DomElementSnapshot;
  readonly semanticHash: string;
  readonly structuralHash: string;
  readonly semanticOrdinal: number;
}
