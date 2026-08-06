import type { ArtifactRun } from './artifacts.js';
import type {
  BrowserNavigationResult,
  BrowserSessionCloseResult,
  BrowserSessionSummary,
  NavigationWaitUntil,
} from './browser.js';
import type { DomCrawlOptions, DomSnapshot, DomSnapshotFailure } from './dom.js';

export type SnapshotHashAlgorithm = 'sha256';

export interface SanitizedHtmlOptions {
  readonly redact?: boolean;
  readonly maxFrameDepth?: number;
  readonly maxFrameCharacters?: number;
  readonly includeStyles?: boolean;
}

export interface ResolvedSanitizedHtmlOptions {
  readonly redact: boolean;
  readonly maxFrameDepth: number;
  readonly maxFrameCharacters: number;
  readonly includeStyles: boolean;
}

export interface SanitizedHtmlFrameStats {
  readonly visitedNodeCount: number;
  readonly serializedElementCount: number;
  readonly shadowRootCount: number;
  readonly omittedNodeCount: number;
  readonly omittedAttributeCount: number;
  readonly redactionCount: number;
  readonly truncated: boolean;
}

export interface SanitizedHtmlFrameCapture {
  readonly framePath: string;
  readonly parentFramePath: string | null;
  readonly depth: number;
  readonly index: number;
  readonly name: string | null;
  readonly url: string;
  readonly title: string;
  readonly html: string;
  readonly hash: string;
  readonly stats: SanitizedHtmlFrameStats;
}

export interface SanitizedHtmlFrameArtifact extends Omit<SanitizedHtmlFrameCapture, 'html'> {
  readonly relativePath: string;
  readonly characterCount: number;
}

export interface SanitizedHtmlSnapshotSummary {
  readonly frameCount: number;
  readonly failedFrameCount: number;
  readonly visitedNodeCount: number;
  readonly serializedElementCount: number;
  readonly shadowRootCount: number;
  readonly omittedNodeCount: number;
  readonly omittedAttributeCount: number;
  readonly redactionCount: number;
  readonly truncatedFrameCount: number;
}

export interface SanitizedHtmlCapture {
  readonly schemaVersion: '1.0';
  readonly toolkitVersion: string;
  readonly capturedAt: string;
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly title: string;
  readonly options: ResolvedSanitizedHtmlOptions;
  readonly summary: SanitizedHtmlSnapshotSummary;
  readonly frames: readonly SanitizedHtmlFrameCapture[];
  readonly failures: readonly DomSnapshotFailure[];
  readonly warnings: readonly string[];
}

export interface SanitizedHtmlSnapshotManifest extends Omit<SanitizedHtmlCapture, 'frames'> {
  readonly frames: readonly SanitizedHtmlFrameArtifact[];
}

export interface ElementFingerprintRecord {
  readonly elementId: string;
  readonly framePath: string;
  readonly shadowPath: readonly string[];
  readonly domPath: string;
  readonly tagName: string;
  readonly role: string | null;
  readonly accessibleName: string | null;
  readonly kind: string;
  readonly semanticHash: string;
  readonly structuralHash: string;
  readonly semanticOrdinal: number;
}

export interface ElementFingerprintSummary {
  readonly elementCount: number;
  readonly uniqueSemanticHashCount: number;
  readonly duplicateSemanticGroupCount: number;
  readonly uniqueStructuralHashCount: number;
}

export interface ElementFingerprintIndex {
  readonly schemaVersion: '1.0';
  readonly toolkitVersion: string;
  readonly generatedAt: string;
  readonly algorithm: SnapshotHashAlgorithm;
  readonly sourceSnapshotSchemaVersion: DomSnapshot['schemaVersion'];
  readonly summary: ElementFingerprintSummary;
  readonly records: readonly ElementFingerprintRecord[];
}

export interface SnapshotBundleOptions extends DomCrawlOptions, SanitizedHtmlOptions {
  readonly command?: string;
  readonly name?: string;
  readonly waitUntil?: NavigationWaitUntil;
  readonly domSnapshotFile?: string;
  readonly htmlManifestFile?: string;
  readonly fingerprintFile?: string;
  readonly bundleFile?: string;
  readonly htmlDirectory?: string;
}

export interface SnapshotBundleManifest {
  readonly schemaVersion: '1.0';
  readonly toolkitVersion: string;
  readonly createdAt: string;
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly title: string;
  readonly files: {
    readonly domSnapshot: string;
    readonly htmlSnapshot: string;
    readonly fingerprints: string;
    readonly htmlFrames: readonly string[];
  };
  readonly domSummary: DomSnapshot['summary'];
  readonly htmlSummary: SanitizedHtmlSnapshotSummary;
  readonly fingerprintSummary: ElementFingerprintSummary;
  readonly warnings: readonly string[];
}

export interface SnapshotBundleReport {
  readonly navigation: BrowserNavigationResult;
  readonly session: BrowserSessionSummary;
  readonly artifactRun: ArtifactRun;
  readonly bundlePath: string;
  readonly domSnapshotPath: string;
  readonly htmlManifestPath: string;
  readonly fingerprintPath: string;
  readonly htmlFramePaths: readonly string[];
  readonly manifest: SnapshotBundleManifest;
  readonly close: BrowserSessionCloseResult;
}

export interface BaselineManifest {
  readonly schemaVersion: '1.0';
  readonly toolkitVersion: string;
  readonly name: string;
  readonly version: string;
  readonly createdAt: string;
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly title: string;
  readonly sourceArtifactRunId: string;
  readonly files: SnapshotBundleManifest['files'];
  readonly domSummary: SnapshotBundleManifest['domSummary'];
  readonly htmlSummary: SnapshotBundleManifest['htmlSummary'];
  readonly fingerprintSummary: SnapshotBundleManifest['fingerprintSummary'];
  readonly warnings: readonly string[];
}

export interface BaselineRecord {
  readonly name: string;
  readonly version: string;
  readonly directory: string;
  readonly manifestPath: string;
  readonly manifest: BaselineManifest;
}

export interface BaselineSummary {
  readonly name: string;
  readonly latestVersion: string;
  readonly createdAt: string;
  readonly finalUrl: string;
  readonly title: string;
  readonly manifestPath: string;
}

export interface BaselineSaveReport {
  readonly snapshot: SnapshotBundleReport;
  readonly baseline: BaselineRecord;
}

export interface FrameHtmlPayload {
  readonly title: string;
  readonly html: string;
  readonly stats: SanitizedHtmlFrameStats;
}
