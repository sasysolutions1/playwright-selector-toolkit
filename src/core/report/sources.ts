import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { ReportError } from '../../errors/toolkit-error.js';
import type {
  HtmlReportSource,
  HtmlReportSourceData,
  HtmlReportSourceKind,
} from '../../types/html-report.js';

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function detectHtmlReportSource(value: unknown): HtmlReportSourceKind | null {
  const data = record(value);
  if (data === null) return null;
  const summary = record(data.summary);
  if (Array.isArray(data.frames) && summary !== null && 'frameCount' in summary) return 'discovery';
  if (Array.isArray(data.elements) && Array.isArray(data.recommendations) && summary !== null) {
    return 'locators';
  }
  if (Array.isArray(data.results) && typeof data.manifestName === 'string' && summary !== null) {
    return 'validation';
  }
  if (Array.isArray(data.repairs) && data.approvalRequired === true && summary !== null) {
    return 'repair';
  }
  if (
    Array.isArray(data.differences) &&
    record(data.baseline) !== null &&
    record(data.current) !== null
  ) {
    return 'comparison';
  }
  if (
    record(data.recorder) !== null &&
    record(data.screenshots) !== null &&
    record(data.files) !== null
  ) {
    return 'diagnostics';
  }
  if (
    typeof data.monitorName === 'string' &&
    Array.isArray(data.targets) &&
    Array.isArray(data.daily) &&
    Array.isArray(data.incidents) &&
    summary !== null &&
    record(data.window) !== null
  ) {
    return 'monitoring-history';
  }
  return null;
}

async function findRunRoot(path: string): Promise<string | null> {
  let current = dirname(path);
  for (let depth = 0; depth < 6; depth += 1) {
    try {
      const info = await stat(join(current, 'run.json'));
      if (info.isFile()) return current;
    } catch {
      // Keep walking upward.
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

async function readSource(path: string): Promise<HtmlReportSource | null> {
  if (extname(path).toLowerCase() !== '.json') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    return null;
  }
  const kind = detectHtmlReportSource(parsed);
  if (kind === null) return null;
  return {
    kind,
    path,
    runRoot: await findRunRoot(path),
    data: parsed as HtmlReportSourceData,
  };
}

async function collectPaths(path: string, depth: number): Promise<string[]> {
  let info;
  try {
    info = await stat(path);
  } catch (error) {
    throw new ReportError('REPORT_SOURCE_READ_FAILED', `Report input does not exist: ${path}`, {
      cause: error,
      details: { path },
      exitCode: 2,
    });
  }
  if (info.isFile()) return [path];
  if (!info.isDirectory()) return [];
  if (depth < 0) return [];
  const entries = await readdir(path, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const child = join(path, entry.name);
    if (entry.isFile()) paths.push(child);
    else if (entry.isDirectory()) paths.push(...(await collectPaths(child, depth - 1)));
  }
  return paths;
}

export async function loadHtmlReportSources(
  inputs: readonly string[],
  cwd: string,
  maxDirectoryDepth = 6,
): Promise<readonly HtmlReportSource[]> {
  if (inputs.length === 0) {
    throw new ReportError('REPORT_SOURCE_REQUIRED', 'At least one report input is required', {
      exitCode: 2,
    });
  }
  const candidates: string[] = [];
  for (const input of inputs) {
    candidates.push(...(await collectPaths(resolve(cwd, input), maxDirectoryDepth)));
  }
  const sources: HtmlReportSource[] = [];
  const seen = new Set<string>();
  for (const path of candidates.sort()) {
    const source = await readSource(path);
    if (source === null || seen.has(path)) continue;
    seen.add(path);
    sources.push(source);
  }
  if (sources.length === 0) {
    throw new ReportError(
      'REPORT_SOURCE_UNSUPPORTED',
      `No supported toolkit JSON reports were found in: ${inputs.map((item) => basename(item)).join(', ')}`,
      { details: { inputs }, exitCode: 2 },
    );
  }
  const order: Record<HtmlReportSourceKind, number> = {
    discovery: 0,
    locators: 1,
    validation: 2,
    repair: 3,
    comparison: 4,
    diagnostics: 5,
    'monitoring-history': 6,
  };
  return sources.sort(
    (left, right) => order[left.kind] - order[right.kind] || left.path.localeCompare(right.path),
  );
}
