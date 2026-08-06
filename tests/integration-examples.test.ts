import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPlugin } from '../src/core/plugins/loader.js';
import { loadSelectorManifest } from '../src/core/validation/manifest.js';

const root = process.cwd();

describe('integration examples', () => {
  it('loads the sample application plugin and manifest', async () => {
    const plugin = await loadPlugin(resolve(root, 'examples/sample-app/sample-plugin.mjs'), root);
    const manifest = await loadSelectorManifest(
      resolve(root, 'examples/sample-app/selectors.yaml'),
    );
    expect(plugin.definition.name).toBe('sample-application-workflow');
    expect(manifest.manifest.selectors).toHaveLength(4);
  });

  it('loads the Outside Access plugin without embedded credentials', async () => {
    const path = resolve(root, 'examples/outside-access/outside-access-plugin.mjs');
    const source = await readFile(path, 'utf8');
    const plugin = await loadPlugin(path, root);
    expect(plugin.definition.name).toBe('outside-access-channel-health');
    expect(source).not.toMatch(/SECURUS_PASSWORD\s*=\s*['"][^'"]+/u);
    expect(source).not.toMatch(/SECURUS_USERNAME\s*=\s*['"][^'"]+/u);
  });

  it('ships the CI and Outside Access handoff files', async () => {
    for (const path of [
      'examples/ci/selector-health.yml',
      'examples/ci/selector.config.ci.yaml',
      'examples/outside-access/health-check.sh',
      'docs/outside-access-integration.md',
    ]) {
      expect((await stat(resolve(root, path))).isFile()).toBe(true);
    }
  });
});
