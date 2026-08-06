import { access, readFile } from 'node:fs/promises';
import { dirname, extname, join, parse, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ConfigError } from '../../errors/toolkit-error.js';
import type { ToolkitConfigInput } from '../../types/config.js';
import { parseConfigInput } from './schema.js';

export const CONFIG_FILENAMES = [
  'selector.config.json',
  'selector.config.yaml',
  'selector.config.yml',
  '.selectorrc.json',
  '.selectorrc.yaml',
  '.selectorrc.yml',
] as const;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function findConfigFile(startDirectory: string): Promise<string | null> {
  let current = resolve(startDirectory);

  while (true) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = join(current, filename);
      if (await exists(candidate)) {
        return candidate;
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function parseConfigText(path: string, text: string): unknown {
  const extension = extname(path).toLowerCase();

  try {
    if (extension === '.yaml' || extension === '.yml') {
      return parseYaml(text);
    }

    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ConfigError('CONFIG_PARSE_FAILED', `Could not parse configuration file: ${path}`, {
      cause: error,
      details: { path },
    });
  }
}

export async function readConfigFile(path: string): Promise<ToolkitConfigInput> {
  let text: string;

  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw new ConfigError('CONFIG_READ_FAILED', `Could not read configuration file: ${path}`, {
      cause: error,
      details: { path },
    });
  }

  try {
    return parseConfigInput(parseConfigText(path, text));
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }

    const issues =
      error instanceof Error && 'issues' in error
        ? (error as { readonly issues: unknown }).issues
        : undefined;

    throw new ConfigError('CONFIG_INVALID', `Configuration file is invalid: ${path}`, {
      cause: error,
      details: issues === undefined ? { path } : { path, issues },
    });
  }
}

export function resolveExplicitConfigPath(cwd: string, configPath: string): string {
  const path = resolve(cwd, configPath);

  if (!CONFIG_FILENAMES.includes(parse(path).base as (typeof CONFIG_FILENAMES)[number])) {
    return path;
  }

  return path;
}
