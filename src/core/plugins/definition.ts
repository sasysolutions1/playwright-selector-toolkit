import type { SelectorToolkitPlugin } from '../../types/plugins.js';
import { PluginError } from '../../errors/toolkit-error.js';

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,79}$/iu;
const HOOK_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/iu;

function assertHookIds(
  pluginName: string,
  category: string,
  hooks: readonly { readonly id: string }[] | undefined,
): void {
  if (hooks === undefined) return;
  const seen = new Set<string>();
  for (const hook of hooks) {
    if (!HOOK_ID_PATTERN.test(hook.id)) {
      throw new PluginError('PLUGIN_INVALID', `Invalid ${category} hook id: ${hook.id}`, {
        details: { plugin: pluginName, hookId: hook.id, category },
      });
    }
    if (seen.has(hook.id)) {
      throw new PluginError('PLUGIN_INVALID', `Duplicate ${category} hook id: ${hook.id}`, {
        details: { plugin: pluginName, hookId: hook.id, category },
      });
    }
    seen.add(hook.id);
  }
}

export function validatePluginDefinition(value: unknown): SelectorToolkitPlugin {
  if (typeof value !== 'object' || value === null) {
    throw new PluginError('PLUGIN_INVALID', 'Plugin export must be an object');
  }
  const plugin = value as Partial<SelectorToolkitPlugin>;
  if (plugin.apiVersion !== '1') {
    throw new PluginError('PLUGIN_API_UNSUPPORTED', 'Plugin apiVersion must be "1"', {
      details: { apiVersion: plugin.apiVersion ?? null },
    });
  }
  if (typeof plugin.name !== 'string' || !NAME_PATTERN.test(plugin.name)) {
    throw new PluginError(
      'PLUGIN_INVALID',
      'Plugin name must be a stable 2-80 character identifier',
      {
        details: { name: plugin.name ?? null },
      },
    );
  }
  if (plugin.version !== undefined && typeof plugin.version !== 'string') {
    throw new PluginError('PLUGIN_INVALID', `Plugin ${plugin.name} version must be a string`);
  }
  if (plugin.order !== undefined && !Number.isSafeInteger(plugin.order)) {
    throw new PluginError('PLUGIN_INVALID', `Plugin ${plugin.name} order must be an integer`);
  }
  if (plugin.setup !== undefined && typeof plugin.setup !== 'function') {
    throw new PluginError('PLUGIN_INVALID', `Plugin ${plugin.name} setup must be a function`);
  }
  if (plugin.teardown !== undefined && typeof plugin.teardown !== 'function') {
    throw new PluginError('PLUGIN_INVALID', `Plugin ${plugin.name} teardown must be a function`);
  }
  const collections = [
    ['authentication', plugin.authentication],
    ['pageStateDetectors', plugin.pageStateDetectors],
    ['redactors', plugin.redactors],
    ['locatorCandidateGenerators', plugin.locatorCandidateGenerators],
  ] as const;
  for (const [field, hooks] of collections) {
    if (hooks !== undefined && !Array.isArray(hooks)) {
      throw new PluginError('PLUGIN_INVALID', `Plugin ${plugin.name} ${field} must be an array`);
    }
  }
  assertHookIds(plugin.name, 'authentication', plugin.authentication);
  assertHookIds(plugin.name, 'page-state', plugin.pageStateDetectors);
  assertHookIds(plugin.name, 'redactor', plugin.redactors);
  assertHookIds(plugin.name, 'locator-generator', plugin.locatorCandidateGenerators);
  return plugin as SelectorToolkitPlugin;
}

export function definePlugin(plugin: SelectorToolkitPlugin): SelectorToolkitPlugin {
  return validatePluginDefinition(plugin);
}
