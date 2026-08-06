import type { ArtifactRun } from './artifacts.js';
import type {
  BrowserNavigationResult,
  BrowserSessionCloseResult,
  BrowserSessionSummary,
  NavigationWaitUntil,
} from './browser.js';
import type { PluginHostLike } from './plugins.js';

export type DomElementScope = 'interactive' | 'all';
export type DomElementKind =
  | 'button'
  | 'link'
  | 'text-input'
  | 'password-input'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'textarea'
  | 'contenteditable'
  | 'form-control'
  | 'interactive'
  | 'element';

export type DomVisibilityReason =
  | 'visible'
  | 'hidden-attribute'
  | 'aria-hidden'
  | 'display-none'
  | 'visibility-hidden'
  | 'opacity-zero'
  | 'zero-area'
  | 'detached';

export type DomInteractivitySource =
  | 'native-control'
  | 'anchor-href'
  | 'interactive-role'
  | 'contenteditable'
  | 'tabindex'
  | 'inline-handler';

export interface DomCrawlOptions {
  readonly scope?: DomElementScope;
  readonly includeHidden?: boolean;
  readonly maxElements?: number;
  readonly maxFrameDepth?: number;
  readonly textLimit?: number;
  readonly redact?: boolean;
  readonly pluginHost?: PluginHostLike;
}

export interface ResolvedDomCrawlOptions {
  readonly scope: DomElementScope;
  readonly includeHidden: boolean;
  readonly maxElements: number;
  readonly maxFrameDepth: number;
  readonly textLimit: number;
  readonly redact: boolean;
}

export interface DomBoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DomVisibility {
  readonly visible: boolean;
  readonly reason: DomVisibilityReason;
  readonly inViewport: boolean;
  readonly boundingBox: DomBoundingBox | null;
}

export interface DomElementSnapshot {
  readonly id: string;
  readonly framePath: string;
  readonly shadowPath: readonly string[];
  readonly domPath: string;
  readonly tagName: string;
  readonly kind: DomElementKind;
  readonly role: string | null;
  readonly accessibleName: string | null;
  readonly text: string | null;
  readonly label: string | null;
  readonly placeholder: string | null;
  readonly attributes: Readonly<Record<string, string>>;
  readonly visibility: DomVisibility;
  readonly interactive: boolean;
  readonly interactivitySources: readonly DomInteractivitySource[];
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly required: boolean;
  readonly checked: boolean | null;
  readonly selected: boolean | null;
  readonly sensitive: boolean;
  readonly redactionsApplied: number;
}

export interface DomFrameSnapshot {
  readonly path: string;
  readonly parentPath: string | null;
  readonly depth: number;
  readonly index: number;
  readonly name: string | null;
  readonly url: string;
  readonly title: string;
  readonly language: string | null;
  readonly readyState: string;
  readonly shadowRootCount: number;
  readonly inspectedElementCount: number;
  readonly matchedElementCount: number;
  readonly truncated: boolean;
  readonly elements: readonly DomElementSnapshot[];
}

export interface DomSnapshotSummary {
  readonly frameCount: number;
  readonly failedFrameCount: number;
  readonly shadowRootCount: number;
  readonly inspectedElementCount: number;
  readonly matchedElementCount: number;
  readonly visibleElementCount: number;
  readonly hiddenElementCount: number;
  readonly interactiveElementCount: number;
  readonly sensitiveElementCount: number;
  readonly redactionCount: number;
  readonly truncated: boolean;
  readonly kinds: Readonly<Record<string, number>>;
}

export interface DomSnapshotFailure {
  readonly framePath: string;
  readonly url: string;
  readonly message: string;
}

export interface DomSnapshot {
  readonly schemaVersion: '1.0';
  readonly toolkitVersion: string;
  readonly capturedAt: string;
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly title: string;
  readonly options: ResolvedDomCrawlOptions;
  readonly summary: DomSnapshotSummary;
  readonly frames: readonly DomFrameSnapshot[];
  readonly failures: readonly DomSnapshotFailure[];
  readonly warnings: readonly string[];
}

export interface DomDiscoveryOptions extends DomCrawlOptions {
  readonly command?: string;
  readonly name?: string;
  readonly waitUntil?: NavigationWaitUntil;
  readonly snapshotFile?: string;
}

export interface DomDiscoveryReport {
  readonly navigation: BrowserNavigationResult;
  readonly session: BrowserSessionSummary;
  readonly artifactRun: ArtifactRun;
  readonly snapshotPath: string;
  readonly summary: DomSnapshotSummary;
  readonly failures: readonly DomSnapshotFailure[];
  readonly warnings: readonly string[];
  readonly close: BrowserSessionCloseResult;
}

export interface FrameDocumentPayload {
  readonly title: string;
  readonly language: string | null;
  readonly readyState: string;
  readonly shadowRootCount: number;
  readonly inspectedElementCount: number;
  readonly matchedElementCount: number;
  readonly truncated: boolean;
  readonly elements: readonly Omit<DomElementSnapshot, 'framePath'>[];
}
