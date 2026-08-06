import type { ArtifactRun } from './artifacts.js';
import type {
  BrowserNavigationResult,
  BrowserSessionCloseResult,
  BrowserSessionSummary,
  NavigationWaitUntil,
} from './browser.js';
import type { DomCrawlOptions, DomElementKind } from './dom.js';
import type { LocatorConfidence, LocatorSpec, LocatorStrategy } from './locator.js';
import type {
  SelectorManifestEntry,
  SelectorValidationResult,
  SelectorValidationSummary,
} from './validation.js';

export type RepairProviderName = 'none' | 'openai';
export type RepairSuggestionSource = 'deterministic' | 'ai-assisted';

export interface RepairElementSummary {
  readonly elementId: string;
  readonly framePath: string;
  readonly shadowPath: readonly string[];
  readonly tagName: string;
  readonly kind: DomElementKind;
  readonly role: string | null;
  readonly accessibleName: string | null;
  readonly label: string | null;
  readonly placeholder: string | null;
  readonly visible: boolean;
}

export interface SelectorRepairSuggestion {
  readonly id: string;
  readonly candidateId: string;
  readonly locator: LocatorSpec;
  readonly playwright: string;
  readonly strategy: LocatorStrategy;
  readonly score: number;
  readonly confidence: LocatorConfidence;
  readonly source: RepairSuggestionSource;
  readonly element: RepairElementSummary;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly aiConfidence: number | null;
  readonly aiRationale: string | null;
}

export interface SelectorRepairItem {
  readonly selector: SelectorManifestEntry;
  readonly validation: SelectorValidationResult;
  readonly suggestions: readonly SelectorRepairSuggestion[];
  readonly recommendedSuggestionId: string | null;
  readonly unresolvedReason: string | null;
}

export interface SelectorRepairSummary {
  readonly manifestSelectorCount: number;
  readonly failedSelectorCount: number;
  readonly requiredFailureCount: number;
  readonly optionalFailureCount: number;
  readonly selectorsWithSuggestions: number;
  readonly selectorsWithRecommendation: number;
  readonly unresolvedRequiredCount: number;
  readonly unresolvedOptionalCount: number;
  readonly aiAssistedCount: number;
  readonly approvalRequired: true;
}

export interface SelectorRepairReport {
  readonly schemaVersion: '1.0';
  readonly toolkitVersion: string;
  readonly generatedAt: string;
  readonly manifestPath: string;
  readonly manifestName: string;
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly title: string;
  readonly provider: RepairProviderName;
  readonly model: string | null;
  readonly summary: SelectorRepairSummary;
  readonly validationSummary: SelectorValidationSummary;
  readonly repairs: readonly SelectorRepairItem[];
  readonly proposalPath: string;
  readonly approvalRequired: true;
  readonly warnings: readonly string[];
}

export interface SelectorRepairOptions extends DomCrawlOptions {
  readonly command?: string;
  readonly name?: string;
  readonly url?: string;
  readonly waitUntil?: NavigationWaitUntil;
  readonly provider?: RepairProviderName;
  readonly model?: string;
  readonly apiKey?: string;
  readonly apiBaseUrl?: string;
  readonly aiTimeoutMs?: number;
  readonly includeOptional?: boolean;
  readonly maxSuggestions?: number;
  readonly minimumScore?: number;
  readonly reportFile?: string;
  readonly proposalFile?: string;
}

export interface ResolvedSelectorRepairOptions {
  readonly provider: RepairProviderName;
  readonly model: string | null;
  readonly apiBaseUrl: string;
  readonly aiTimeoutMs: number;
  readonly includeOptional: boolean;
  readonly maxSuggestions: number;
  readonly minimumScore: number;
}

export interface SelectorRepairRunReport {
  readonly navigation: BrowserNavigationResult;
  readonly session: BrowserSessionSummary;
  readonly artifactRun: ArtifactRun;
  readonly manifestPath: string;
  readonly reportPath: string;
  readonly proposalPath: string;
  readonly report: SelectorRepairReport;
  readonly close: BrowserSessionCloseResult;
}

export interface RepairAdvisorCandidate {
  readonly candidateId: string;
  readonly playwright: string;
  readonly strategy: LocatorStrategy;
  readonly deterministicScore: number;
  readonly element: RepairElementSummary;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
}

export interface RepairAdvisorRequest {
  readonly selector: Pick<
    SelectorManifestEntry,
    'id' | 'name' | 'description' | 'required' | 'framePath' | 'locator' | 'assertions'
  >;
  readonly validation: Pick<
    SelectorValidationResult,
    'status' | 'observed' | 'assertions' | 'error'
  >;
  readonly candidates: readonly RepairAdvisorCandidate[];
}

export interface RepairAdvisorRecommendation {
  readonly candidateId: string;
  readonly confidence: number;
  readonly rationale: string;
}

export interface RepairAdvisorResponse {
  readonly recommendations: readonly RepairAdvisorRecommendation[];
  readonly notes: readonly string[];
}

export interface RepairAdvisor {
  readonly provider: RepairProviderName;
  readonly model: string | null;
  advise(request: RepairAdvisorRequest): Promise<RepairAdvisorResponse>;
}
