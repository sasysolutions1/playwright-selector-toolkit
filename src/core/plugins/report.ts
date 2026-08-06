import type { ToolkitConfig } from '../../types/config.js';
import type { PluginHostReport } from '../../types/plugins.js';
import { createPluginHost } from './runtime.js';

export async function inspectConfiguredPlugins(config: ToolkitConfig): Promise<PluginHostReport> {
  const host = await createPluginHost(config);
  await host.initialize(config, null);
  await host.teardown(config, null);
  return host.report();
}
