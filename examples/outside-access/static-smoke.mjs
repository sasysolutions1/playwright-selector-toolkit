import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadPlugin, loadSelectorManifest, readConfigFile } from '../../dist/index.js';

const plugin = await loadPlugin(
  resolve('examples/outside-access/outside-access-plugin.mjs'),
  process.cwd(),
);
assert.equal(plugin.definition.name, 'outside-access-channel-health');
assert.ok((plugin.definition.authentication?.length ?? 0) >= 1);
assert.ok((plugin.definition.pageStateDetectors?.length ?? 0) >= 3);
assert.ok((plugin.definition.redactors?.length ?? 0) >= 1);
assert.ok((plugin.definition.locatorCandidateGenerators?.length ?? 0) >= 1);

const config = await readConfigFile(resolve('examples/outside-access/selector.config.yaml'));
assert.ok(Array.isArray(config.plugins));
const manifest = await loadSelectorManifest(
  resolve('examples/outside-access/selectors.template.yaml'),
);
assert.equal(manifest.manifest.selectors.length, 4);
console.log(JSON.stringify({ ok: true, plugin: plugin.definition.name, selectors: 4 }, null, 2));
