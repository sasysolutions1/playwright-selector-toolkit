import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSelectorManifest } from '../src/core/validation/manifest.js';

async function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'selector-manifest-'));
}

describe('selector manifest loading', () => {
  it('loads JSON manifests', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, 'selectors.json');
    await writeFile(
      path,
      JSON.stringify({
        schemaVersion: '1.0',
        name: 'Login',
        selectors: [{ id: 'email', locator: { type: 'label', value: 'Email' } }],
      }),
    );
    const loaded = await loadSelectorManifest(path);
    expect(loaded.manifest.name).toBe('Login');
    expect(loaded.manifest.selectors[0]?.locator).toEqual({
      type: 'label',
      value: 'Email',
      exact: true,
    });
  });

  it('loads YAML manifests', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, 'selectors.yaml');
    await writeFile(
      path,
      'schemaVersion: "1.0"\nselectors:\n  - id: send\n    locator:\n      type: test-id\n      value: send\n',
    );
    const loaded = await loadSelectorManifest(path);
    expect(loaded.manifest.selectors[0]?.locator).toEqual({
      type: 'test-id',
      attribute: 'data-testid',
      value: 'send',
    });
  });

  it('returns structured parse failures', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, 'bad.json');
    await writeFile(path, '{');
    await expect(loadSelectorManifest(path)).rejects.toMatchObject({
      code: 'VALIDATION_MANIFEST_PARSE_FAILED',
      exitCode: 2,
    });
  });

  it('returns structured schema failures', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, 'bad.yaml');
    await writeFile(path, 'schemaVersion: "1.0"\nselectors: []\n');
    await expect(loadSelectorManifest(path)).rejects.toMatchObject({
      code: 'VALIDATION_MANIFEST_INVALID',
      exitCode: 2,
    });
  });
});
