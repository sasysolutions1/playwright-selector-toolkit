import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { ComparisonError } from '../../errors/toolkit-error.js';
import type { ToolkitConfig } from '../../types/config.js';
import type { LoadedBaselineSnapshot } from '../../types/comparison.js';
import type { DomSnapshot } from '../../types/dom.js';
import { loadBaseline } from '../baseline/store.js';

function assertInside(root: string, target: string): void {
  const relation = relative(root, target);
  if (relation === '..' || relation.startsWith(`..${sep}`)) {
    throw new ComparisonError(
      'COMPARISON_BASELINE_READ_FAILED',
      'Baseline file escapes its version directory',
      {
        details: { root, target },
      },
    );
  }
}

async function readJson<T>(path: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    throw new ComparisonError(
      'COMPARISON_BASELINE_READ_FAILED',
      `Could not read baseline snapshot: ${path}`,
      {
        cause: error,
        details: { path },
      },
    );
  }
}

export async function loadBaselineSnapshot(
  config: ToolkitConfig,
  name: string,
  version?: string,
): Promise<LoadedBaselineSnapshot> {
  const baseline = await loadBaseline(config, name, version);
  const path = resolve(baseline.directory, baseline.manifest.files.domSnapshot);
  assertInside(baseline.directory, path);
  const domSnapshot = await readJson<DomSnapshot>(path);
  if (domSnapshot.schemaVersion !== '1.0' || !Array.isArray(domSnapshot.frames)) {
    throw new ComparisonError(
      'COMPARISON_BASELINE_READ_FAILED',
      'Unsupported or invalid DOM snapshot schema',
      {
        details: {
          path,
          schemaVersion: (domSnapshot as { schemaVersion?: unknown }).schemaVersion,
        },
      },
    );
  }
  return { baseline, domSnapshot };
}
