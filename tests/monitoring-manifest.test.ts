import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadMonitorManifest } from '../src/core/monitoring/manifest.js';

describe('monitor manifest', () => {
  it('loads YAML, applies defaults, and resolves selector manifests relative to the monitor file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'selector-monitor-manifest-'));
    const path = join(root, 'monitor.yaml');
    await writeFile(
      path,
      `schemaVersion: "1.0"\nname: Production selectors\ntargets:\n  - id: login\n    name: Login page\n    manifestPath: selectors/login.yaml\nnotifications:\n  - id: console\n    type: console\n`,
    );
    const loaded = await loadMonitorManifest(path);
    expect(loaded.manifest.pollIntervalMs).toBe(60_000);
    expect(loaded.manifest.targets[0]).toMatchObject({
      id: 'login',
      intervalMs: 300_000,
      manifestPath: join(root, 'selectors/login.yaml'),
      policy: { openAfterFailures: 2, criticalAfterFailures: 5 },
    });
    expect(loaded.manifest.notifications[0]).toMatchObject({ enabled: true, notifyRecovery: true });
  });

  it('rejects references to unknown notification adapters', async () => {
    const root = await mkdtemp(join(tmpdir(), 'selector-monitor-invalid-'));
    const path = join(root, 'monitor.json');
    await writeFile(
      path,
      JSON.stringify({
        schemaVersion: '1.0',
        name: 'Invalid',
        targets: [
          {
            id: 'login',
            name: 'Login',
            manifestPath: 'login.yaml',
            notificationAdapterIds: ['missing'],
          },
        ],
      }),
    );
    await expect(loadMonitorManifest(path)).rejects.toMatchObject({
      code: 'MONITOR_MANIFEST_INVALID',
      exitCode: 2,
    });
  });

  it('requires environment variable names instead of embedded provider credentials', async () => {
    const root = await mkdtemp(join(tmpdir(), 'selector-monitor-secrets-'));
    const path = join(root, 'monitor.yaml');
    await writeFile(
      path,
      `schemaVersion: "1.0"\nname: Invalid webhook\ntargets:\n  - id: page\n    name: Page\n    manifestPath: page.yaml\nnotifications:\n  - id: hook\n    type: webhook\n`,
    );
    await expect(loadMonitorManifest(path)).rejects.toMatchObject({
      code: 'MONITOR_MANIFEST_INVALID',
    });
  });
});
