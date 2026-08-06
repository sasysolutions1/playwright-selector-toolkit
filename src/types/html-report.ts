import type { ArtifactRun } from './artifacts.js';
import type { DomSnapshot } from './dom.js';
import type { LocatorReport } from './locator.js';
import type { SelectorValidationReport } from './validation.js';
import type { DomComparisonReport } from './comparison.js';
import type { DiagnosticEvidenceManifest } from './diagnostics.js';
import type { SelectorRepairReport } from './repair.js';
import type { MonitorHistoryReport } from './monitoring.js';

export type HtmlReportSourceKind =
  | 'discovery'
  | 'locators'
  | 'validation'
  | 'repair'
  | 'comparison'
  | 'diagnostics'
  | 'monitoring-history';

export type HtmlReportSourceData =
  | DomSnapshot
  | LocatorReport
  | SelectorValidationReport
  | SelectorRepairReport
  | DomComparisonReport
  | DiagnosticEvidenceManifest
  | MonitorHistoryReport;

export interface HtmlReportSource {
  readonly kind: HtmlReportSourceKind;
  readonly path: string;
  readonly runRoot: string | null;
  readonly data: HtmlReportSourceData;
}

export interface HtmlReportImage {
  readonly sourcePath: string;
  readonly label: string;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly dataUri: string | null;
  readonly reasonNotEmbedded: string | null;
}

export interface HtmlReportOptions {
  readonly command?: string;
  readonly name?: string;
  readonly title?: string;
  readonly outputFile?: string;
  readonly manifestFile?: string;
  readonly embedImages?: boolean;
  readonly maxImageBytes?: number;
  readonly maxItemsPerSection?: number;
  readonly maxDirectoryDepth?: number;
  readonly interactive?: boolean;
}

export interface ResolvedHtmlReportOptions {
  readonly command: string;
  readonly name?: string;
  readonly title: string;
  readonly outputFile: string;
  readonly manifestFile: string;
  readonly embedImages: boolean;
  readonly maxImageBytes: number;
  readonly maxItemsPerSection: number;
  readonly maxDirectoryDepth: number;
  readonly interactive: boolean;
}

export interface HtmlReportSourceSummary {
  readonly kind: HtmlReportSourceKind;
  readonly path: string;
  readonly title: string;
  readonly generatedAt: string | null;
  readonly itemCount: number;
}

export interface HtmlReportManifest {
  readonly schemaVersion: '1.1';
  readonly toolkitVersion: string;
  readonly generatedAt: string;
  readonly title: string;
  readonly reportPath: string;
  readonly sourceCount: number;
  readonly sources: readonly HtmlReportSourceSummary[];
  readonly imageCount: number;
  readonly embeddedImageCount: number;
  readonly omittedImageCount: number;
  readonly interactive: boolean;
  readonly warnings: readonly string[];
}

export interface HtmlReportBuildReport {
  readonly artifactRun: ArtifactRun;
  readonly reportPath: string;
  readonly manifestPath: string;
  readonly manifest: HtmlReportManifest;
}
