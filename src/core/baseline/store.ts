import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { BaselineError } from '../../errors/toolkit-error.js';
import type { ToolkitConfig } from '../../types/config.js';
import type {
  BaselineManifest,
  BaselineRecord,
  BaselineSummary,
  SnapshotBundleReport,
} from '../../types/snapshot.js';

interface BaselinePointer {
  readonly schemaVersion: '1.0';
  readonly name: string;
  readonly latestVersion: string;
  readonly manifestPath: string;
  readonly updatedAt: string;
}

export function validateBaselineName(name: string): string {
  const normalized = name.trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/iu.test(normalized)) {
    throw new BaselineError(
      'BASELINE_NAME_INVALID',
      'Baseline name must start with a letter or number and contain only letters, numbers, dots, underscores, or hyphens',
      { details: { name }, exitCode: 2 },
    );
  }
  return normalized;
}

export function baselineRoot(config: ToolkitConfig): string {
  return resolve(config.artifactsDir, 'baselines');
}

function assertWithin(root: string, target: string): void {
  const relation = relative(root, target);
  if (relation === '..' || relation.startsWith(`..${sep}`)) {
    throw new BaselineError('BASELINE_NAME_INVALID', 'Baseline path escapes baseline root', {
      details: { root, target },
      exitCode: 2,
    });
  }
}

function versionSegment(report: SnapshotBundleReport): string {
  const timestamp = report.manifest.createdAt.replace(/[:.]/gu, '-');
  return `${timestamp}-${report.artifactRun.id.slice(0, 8)}`;
}

async function readJson<T>(path: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    throw new BaselineError('BASELINE_READ_FAILED', `Could not read baseline file: ${path}`, {
      cause: error,
      details: { path },
    });
  }
}

async function copyBundleFile(
  sourceRunDirectory: string,
  destinationVersionDirectory: string,
  relativePath: string,
): Promise<void> {
  const source = resolve(sourceRunDirectory, relativePath);
  const destination = resolve(destinationVersionDirectory, relativePath);
  assertWithin(sourceRunDirectory, source);
  assertWithin(destinationVersionDirectory, destination);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

export async function saveBaseline(
  config: ToolkitConfig,
  nameInput: string,
  report: SnapshotBundleReport,
): Promise<BaselineRecord> {
  const name = validateBaselineName(nameInput);
  const root = baselineRoot(config);
  const nameDirectory = resolve(root, name);
  const version = versionSegment(report);
  const directory = resolve(nameDirectory, 'versions', version);
  assertWithin(root, directory);

  try {
    await mkdir(dirname(directory), { recursive: true });
    await mkdir(directory, { recursive: false });
    const relativeFiles = [
      report.manifest.files.domSnapshot,
      report.manifest.files.htmlSnapshot,
      report.manifest.files.fingerprints,
      ...report.manifest.files.htmlFrames,
    ];
    await Promise.all(
      relativeFiles.map(async (file) =>
        copyBundleFile(report.artifactRun.directories.run, directory, file),
      ),
    );

    const manifest: BaselineManifest = {
      schemaVersion: '1.0',
      toolkitVersion: report.manifest.toolkitVersion,
      name,
      version,
      createdAt: report.manifest.createdAt,
      requestedUrl: report.manifest.requestedUrl,
      finalUrl: report.manifest.finalUrl,
      title: report.manifest.title,
      sourceArtifactRunId: report.artifactRun.id,
      files: report.manifest.files,
      domSummary: report.manifest.domSummary,
      htmlSummary: report.manifest.htmlSummary,
      fingerprintSummary: report.manifest.fingerprintSummary,
      warnings: report.manifest.warnings,
    };
    const manifestPath = resolve(directory, 'manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const pointer: BaselinePointer = {
      schemaVersion: '1.0',
      name,
      latestVersion: version,
      manifestPath: relative(nameDirectory, manifestPath),
      updatedAt: new Date().toISOString(),
    };
    await mkdir(nameDirectory, { recursive: true });
    await writeFile(
      resolve(nameDirectory, 'latest.json'),
      `${JSON.stringify(pointer, null, 2)}\n`,
      'utf8',
    );
    return { name, version, directory, manifestPath, manifest };
  } catch (error) {
    if (error instanceof BaselineError) throw error;
    throw new BaselineError('BASELINE_SAVE_FAILED', `Could not save baseline ${name}`, {
      cause: error,
      details: { name, directory },
    });
  }
}

export async function loadBaseline(
  config: ToolkitConfig,
  nameInput: string,
  version?: string,
): Promise<BaselineRecord> {
  const name = validateBaselineName(nameInput);
  const root = baselineRoot(config);
  const nameDirectory = resolve(root, name);
  let resolvedVersion = version;

  if (resolvedVersion === undefined) {
    try {
      const pointer = await readJson<BaselinePointer>(resolve(nameDirectory, 'latest.json'));
      resolvedVersion = pointer.latestVersion;
    } catch (error) {
      if (error instanceof BaselineError) {
        throw new BaselineError('BASELINE_NOT_FOUND', `Baseline not found: ${name}`, {
          cause: error,
          details: { name },
          exitCode: 2,
        });
      }
      throw error;
    }
  }

  if (!/^[a-z0-9._-]+$/iu.test(resolvedVersion)) {
    throw new BaselineError(
      'BASELINE_NAME_INVALID',
      'Baseline version contains invalid characters',
      {
        details: { name, version: resolvedVersion },
        exitCode: 2,
      },
    );
  }

  const directory = resolve(nameDirectory, 'versions', resolvedVersion);
  assertWithin(root, directory);
  const manifestPath = resolve(directory, 'manifest.json');
  try {
    const manifest = await readJson<BaselineManifest>(manifestPath);
    return { name, version: resolvedVersion, directory, manifestPath, manifest };
  } catch (error) {
    if (error instanceof BaselineError) {
      throw new BaselineError(
        'BASELINE_NOT_FOUND',
        `Baseline version not found: ${name}@${resolvedVersion}`,
        {
          cause: error,
          details: { name, version: resolvedVersion },
          exitCode: 2,
        },
      );
    }
    throw error;
  }
}

export async function listBaselines(config: ToolkitConfig): Promise<readonly BaselineSummary[]> {
  const root = baselineRoot(config);
  try {
    await mkdir(root, { recursive: true });
    const entries = await readdir(root, { withFileTypes: true });
    const summaries: BaselineSummary[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const record = await loadBaseline(config, entry.name);
        summaries.push({
          name: record.name,
          latestVersion: record.version,
          createdAt: record.manifest.createdAt,
          finalUrl: record.manifest.finalUrl,
          title: record.manifest.title,
          manifestPath: record.manifestPath,
        });
      } catch {
        // Ignore incomplete baseline directories so one damaged entry does not block listing.
      }
    }
    return summaries.sort((left, right) => left.name.localeCompare(right.name));
  } catch (error) {
    throw new BaselineError('BASELINE_READ_FAILED', `Could not list baselines in ${root}`, {
      cause: error,
      details: { root },
    });
  }
}

export function baselineDisplayPath(record: BaselineRecord): string {
  return `${record.name}@${record.version}/${basename(record.manifestPath)}`;
}
