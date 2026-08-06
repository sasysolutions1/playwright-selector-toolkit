import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ValidationError } from '../../errors/toolkit-error.js';
import type { LoadedSelectorManifest } from '../../types/validation.js';
import { selectorManifestSchema } from './schema.js';

function describeIssues(
  issues: readonly { readonly path: PropertyKey[]; readonly message: string }[],
): string {
  return issues
    .map(
      (issue) => `${issue.path.length === 0 ? '(root)' : issue.path.join('.')}: ${issue.message}`,
    )
    .join('; ');
}

export async function loadSelectorManifest(path: string): Promise<LoadedSelectorManifest> {
  const sourcePath = resolve(path);
  let source: string;
  try {
    source = await readFile(sourcePath, 'utf8');
  } catch (error) {
    throw new ValidationError(
      'VALIDATION_MANIFEST_READ_FAILED',
      `Could not read selector manifest: ${sourcePath}`,
      {
        cause: error,
        details: { path: sourcePath },
        exitCode: 2,
      },
    );
  }

  let raw: unknown;
  try {
    const extension = extname(sourcePath).toLowerCase();
    raw = extension === '.json' ? JSON.parse(source) : parseYaml(source);
  } catch (error) {
    throw new ValidationError(
      'VALIDATION_MANIFEST_PARSE_FAILED',
      `Could not parse selector manifest: ${sourcePath}`,
      {
        cause: error,
        details: { path: sourcePath },
        exitCode: 2,
      },
    );
  }

  const parsed = selectorManifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      'VALIDATION_MANIFEST_INVALID',
      `Selector manifest is invalid: ${describeIssues(parsed.error.issues)}`,
      {
        details: { path: sourcePath, issues: parsed.error.issues },
        exitCode: 2,
      },
    );
  }

  return { sourcePath, manifest: parsed.data };
}
