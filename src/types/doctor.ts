export type DoctorStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheck {
  readonly id: string;
  readonly label: string;
  readonly status: DoctorStatus;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface DoctorReport {
  readonly toolkitVersion: string;
  readonly checkedAt: string;
  readonly cwd: string;
  readonly artifactsDir: string;
  readonly checks: readonly DoctorCheck[];
  readonly summary: Readonly<Record<DoctorStatus, number>>;
}

export interface DoctorOptions {
  readonly cwd?: string;
  readonly artifactsDir?: string;
  readonly strict?: boolean;
  readonly nodeVersion?: string;
  readonly platform?: NodeJS.Platform;
  readonly architecture?: string;
  readonly playwrightVersion?: string | null;
  readonly browserExecutablePath?: string | null;
}
