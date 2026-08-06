export type ReviewStatus = 'pass' | 'warn' | 'fail';

export interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

export interface ReviewCheck {
  readonly id: string;
  readonly label: string;
  readonly status: ReviewStatus;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ReviewSummary {
  readonly pass: number;
  readonly warn: number;
  readonly fail: number;
}

export interface CompatibilityRuntime {
  readonly node: string;
  readonly npm: string | null;
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
}

export interface CompatibilityReport {
  readonly schemaVersion: '1.0';
  readonly generatedAt: string;
  readonly toolkitVersion: string;
  readonly cwd: string;
  readonly packagePath: string;
  readonly runtime: CompatibilityRuntime;
  readonly supportedNodeMajors: readonly number[];
  readonly minimumNodeVersion: string;
  readonly checks: readonly ReviewCheck[];
  readonly summary: ReviewSummary;
}

export interface CompatibilityReviewOptions {
  readonly cwd?: string;
  readonly packagePath?: string;
  readonly nodeVersion?: string;
  readonly npmVersion?: string | null;
  readonly platform?: NodeJS.Platform;
  readonly architecture?: string;
}

export interface SecurityFinding {
  readonly path: string;
  readonly line: number | null;
  readonly rule: string;
  readonly message: string;
}

export interface SecurityReviewReport {
  readonly schemaVersion: '1.0';
  readonly generatedAt: string;
  readonly toolkitVersion: string;
  readonly cwd: string;
  readonly packagePath: string;
  readonly checks: readonly ReviewCheck[];
  readonly findings: readonly SecurityFinding[];
  readonly summary: ReviewSummary;
}

export interface SecurityReviewOptions {
  readonly cwd?: string;
  readonly packagePath?: string;
  readonly scanPaths?: readonly string[];
}

export interface PackageVerificationReport {
  readonly schemaVersion: '1.0';
  readonly generatedAt: string;
  readonly packageName: string;
  readonly packageVersion: string;
  readonly tarballPath: string;
  readonly tarballSha256: string;
  readonly fileCount: number;
  readonly files: readonly string[];
  readonly importVerified: boolean;
  readonly cliVerified: boolean;
  readonly reproducible: boolean;
}
