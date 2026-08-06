import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadPlugin, loadPlugins, resolvePluginSpecifier } from '../src/core/plugins/loader.js';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'selector-plugin-loader-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('plugin loader', () => {
  it('loads a local ESM default export', async () => {
    const cwd = await temporaryDirectory();
    await writeFile(
      join(cwd, 'plugin.mjs'),
      `export default { apiVersion: '1', name: 'local-plugin', version: '1.2.3' };\n`,
      'utf8',
    );

    const loaded = await loadPlugin('./plugin.mjs', cwd);
    expect(loaded.definition).toMatchObject({ name: 'local-plugin', version: '1.2.3' });
    expect(loaded.specifier).toMatch(/^file:/u);
  });

  it('rejects missing exports and duplicate plugin names', async () => {
    const cwd = await temporaryDirectory();
    await writeFile(join(cwd, 'empty.mjs'), 'export const value = 1;\n', 'utf8');
    await expect(loadPlugin('./empty.mjs', cwd)).rejects.toMatchObject({
      code: 'PLUGIN_EXPORT_MISSING',
    });

    await writeFile(
      join(cwd, 'one.mjs'),
      `export default { apiVersion: '1', name: 'duplicate-plugin' };\n`,
      'utf8',
    );
    await writeFile(
      join(cwd, 'two.mjs'),
      `export default { apiVersion: '1', name: 'duplicate-plugin' };\n`,
      'utf8',
    );
    await expect(loadPlugins(['./one.mjs', './two.mjs'], cwd)).rejects.toMatchObject({
      code: 'PLUGIN_DUPLICATE',
    });
  });

  it('preserves package specifiers and resolves local paths', () => {
    expect(resolvePluginSpecifier('@scope/plugin', '/tmp/project')).toBe('@scope/plugin');
    expect(resolvePluginSpecifier('./plugin.mjs', '/tmp/project')).toContain(
      '/tmp/project/plugin.mjs',
    );
  });
});
