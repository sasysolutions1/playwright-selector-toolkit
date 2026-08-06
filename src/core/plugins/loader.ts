import { access } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PluginError } from '../../errors/toolkit-error.js';
import type { LoadedPlugin } from '../../types/plugins.js';
import { validatePluginDefinition } from './definition.js';

interface PluginModuleShape {
  readonly default?: unknown;
  readonly plugin?: unknown;
}

export function resolvePluginSpecifier(specifier: string, cwd: string): string {
  const trimmed = specifier.trim();
  if (trimmed === '') {
    throw new PluginError('PLUGIN_SPECIFIER_INVALID', 'Plugin specifier cannot be empty');
  }
  if (trimmed.startsWith('file:')) return trimmed;
  if (isAbsolute(trimmed)) return pathToFileURL(trimmed).href;
  if (trimmed.startsWith('.')) return pathToFileURL(resolve(cwd, trimmed)).href;
  return trimmed;
}

async function assertLocalPluginExists(resolvedSpecifier: string): Promise<void> {
  if (!resolvedSpecifier.startsWith('file:')) return;
  try {
    await access(new URL(resolvedSpecifier));
  } catch (error) {
    throw new PluginError('PLUGIN_NOT_FOUND', `Plugin file was not found: ${resolvedSpecifier}`, {
      cause: error,
      details: { specifier: resolvedSpecifier },
    });
  }
}

function pluginExport(module: PluginModuleShape): unknown {
  return module.default ?? module.plugin;
}

export async function loadPlugin(specifier: string, cwd: string): Promise<LoadedPlugin> {
  const resolvedSpecifier = resolvePluginSpecifier(specifier, cwd);
  await assertLocalPluginExists(resolvedSpecifier);
  let imported: PluginModuleShape;
  try {
    imported = (await import(resolvedSpecifier)) as PluginModuleShape;
  } catch (error) {
    throw new PluginError('PLUGIN_LOAD_FAILED', `Could not import plugin: ${specifier}`, {
      cause: error,
      details: { specifier, resolvedSpecifier },
    });
  }
  const exported = pluginExport(imported);
  if (exported === undefined) {
    throw new PluginError(
      'PLUGIN_EXPORT_MISSING',
      `Plugin ${specifier} must export default or named export "plugin"`,
      { details: { specifier, resolvedSpecifier } },
    );
  }
  return {
    definition: validatePluginDefinition(exported),
    specifier: resolvedSpecifier,
  };
}

export async function loadPlugins(
  specifiers: readonly string[],
  cwd: string,
): Promise<readonly LoadedPlugin[]> {
  const loaded: LoadedPlugin[] = [];
  const names = new Set<string>();
  for (const specifier of specifiers) {
    const plugin = await loadPlugin(specifier, cwd);
    if (names.has(plugin.definition.name)) {
      throw new PluginError(
        'PLUGIN_DUPLICATE',
        `Duplicate plugin name: ${plugin.definition.name}`,
        {
          details: { plugin: plugin.definition.name },
        },
      );
    }
    names.add(plugin.definition.name);
    loaded.push(plugin);
  }
  return loaded.sort(
    (left, right) =>
      (left.definition.order ?? 0) - (right.definition.order ?? 0) ||
      left.definition.name.localeCompare(right.definition.name),
  );
}
