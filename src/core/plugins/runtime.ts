import type { ToolkitConfig } from '../../types/config.js';
import type { LoadedPlugin, PluginHostLike } from '../../types/plugins.js';
import { PluginHost } from './host.js';
import { loadPlugins } from './loader.js';

export interface CreatePluginHostDependencies {
  readonly loader?: (
    specifiers: readonly string[],
    cwd: string,
  ) => Promise<readonly LoadedPlugin[]>;
}

export async function createPluginHost(
  config: ToolkitConfig,
  dependencies: CreatePluginHostDependencies = {},
): Promise<PluginHostLike> {
  const plugins = await (dependencies.loader ?? loadPlugins)(config.plugins ?? [], config.cwd);
  return new PluginHost(plugins, {
    cwd: config.cwd,
    timeoutMs: config.pluginTimeoutMs ?? 10_000,
    failureMode: config.pluginFailureMode ?? 'isolate',
  });
}
