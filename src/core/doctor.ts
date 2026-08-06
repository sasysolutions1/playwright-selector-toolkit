import { access, constants, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { DoctorCheck, DoctorOptions, DoctorReport, DoctorStatus } from '../types/doctor.js';
import { getToolkitVersion } from './version.js';

const MINIMUM_NODE_MAJOR = 22;
const require = createRequire(import.meta.url);

interface PlaywrightManifest {
  readonly version?: string;
}

function parseNodeMajor(version: string): number | null {
  const match = /^v?(\d+)/u.exec(version.trim());
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function nodeCheck(version: string): DoctorCheck {
  const major = parseNodeMajor(version);

  if (major === null) {
    return {
      id: 'node-version',
      label: 'Node.js version',
      status: 'fail',
      message: `Could not parse Node.js version: ${version}`,
    };
  }

  if (major < MINIMUM_NODE_MAJOR) {
    return {
      id: 'node-version',
      label: 'Node.js version',
      status: 'fail',
      message: `Node.js ${MINIMUM_NODE_MAJOR}+ is required; detected ${version}`,
      details: { detectedMajor: major, requiredMajor: MINIMUM_NODE_MAJOR },
    };
  }

  return {
    id: 'node-version',
    label: 'Node.js version',
    status: 'pass',
    message: `Detected supported Node.js ${version}`,
    details: { detectedMajor: major, requiredMajor: MINIMUM_NODE_MAJOR },
  };
}

function platformCheck(platform: NodeJS.Platform, architecture: string): DoctorCheck {
  const supported = new Set<NodeJS.Platform>(['linux', 'darwin', 'win32']);

  return {
    id: 'platform',
    label: 'Operating system',
    status: supported.has(platform) ? 'pass' : 'warn',
    message: supported.has(platform)
      ? `Detected ${platform}/${architecture}`
      : `Detected untested platform ${platform}/${architecture}`,
    details: { platform, architecture },
  };
}

function readPlaywrightVersion(): string | null {
  try {
    const manifest = require('playwright/package.json') as PlaywrightManifest;
    return manifest.version ?? null;
  } catch {
    return null;
  }
}

function playwrightCheck(version: string | null): DoctorCheck {
  if (!version) {
    return {
      id: 'playwright-package',
      label: 'Playwright package',
      status: 'fail',
      message: 'Playwright is not installed',
    };
  }

  return {
    id: 'playwright-package',
    label: 'Playwright package',
    status: 'pass',
    message: `Detected Playwright ${version}`,
    details: { version },
  };
}

async function browserCheck(executablePath: string | null, strict: boolean): Promise<DoctorCheck> {
  if (!executablePath) {
    return {
      id: 'chromium-executable',
      label: 'Chromium browser',
      status: strict ? 'fail' : 'warn',
      message: 'Chromium executable path is unavailable; run npx playwright install chromium',
    };
  }

  try {
    await access(executablePath, constants.X_OK);
    return {
      id: 'chromium-executable',
      label: 'Chromium browser',
      status: 'pass',
      message: 'Chromium executable is installed and executable',
      details: { executablePath },
    };
  } catch {
    return {
      id: 'chromium-executable',
      label: 'Chromium browser',
      status: strict ? 'fail' : 'warn',
      message: 'Chromium is not installed; run npx playwright install chromium',
      details: { executablePath },
    };
  }
}

async function workingDirectoryCheck(cwd: string): Promise<DoctorCheck> {
  try {
    await access(cwd, constants.R_OK | constants.W_OK);
    return {
      id: 'working-directory',
      label: 'Working directory',
      status: 'pass',
      message: 'Working directory is readable and writable',
      details: { cwd },
    };
  } catch {
    return {
      id: 'working-directory',
      label: 'Working directory',
      status: 'fail',
      message: 'Working directory is not readable and writable',
      details: { cwd },
    };
  }
}

async function artifactDirectoryCheck(artifactsDir: string): Promise<DoctorCheck> {
  try {
    await mkdir(artifactsDir, { recursive: true });
    await access(artifactsDir, constants.R_OK | constants.W_OK);
    return {
      id: 'artifact-directory',
      label: 'Artifact directory',
      status: 'pass',
      message: 'Artifact directory is available and writable',
      details: { artifactsDir },
    };
  } catch {
    return {
      id: 'artifact-directory',
      label: 'Artifact directory',
      status: 'fail',
      message: 'Artifact directory could not be created or written',
      details: { artifactsDir },
    };
  }
}

function summarize(checks: readonly DoctorCheck[]): Record<DoctorStatus, number> {
  return checks.reduce<Record<DoctorStatus, number>>(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { pass: 0, warn: 0, fail: 0 },
  );
}

export function doctorExitCode(report: DoctorReport, strict = false): number {
  if (report.summary.fail > 0) {
    return 1;
  }

  if (strict && report.summary.warn > 0) {
    return 1;
  }

  return 0;
}

export async function runDoctor(options: DoctorOptions = {}): Promise<DoctorReport> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const artifactsDir = resolve(options.artifactsDir ?? resolve(cwd, '.selector-artifacts'));
  const strict = options.strict ?? false;
  const playwrightVersion = options.playwrightVersion ?? readPlaywrightVersion();
  const browserExecutablePath =
    options.browserExecutablePath === undefined
      ? chromium.executablePath()
      : options.browserExecutablePath;

  const checks: DoctorCheck[] = [
    nodeCheck(options.nodeVersion ?? process.version),
    platformCheck(options.platform ?? process.platform, options.architecture ?? process.arch),
    playwrightCheck(playwrightVersion),
    await browserCheck(browserExecutablePath, strict),
    await workingDirectoryCheck(cwd),
    await artifactDirectoryCheck(artifactsDir),
  ];

  return {
    toolkitVersion: getToolkitVersion(),
    checkedAt: new Date().toISOString(),
    cwd,
    artifactsDir,
    checks,
    summary: summarize(checks),
  };
}
