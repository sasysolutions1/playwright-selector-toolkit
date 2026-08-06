import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createArtifactRun,
  writeJsonArtifact,
  writeTextArtifact,
} from '../src/core/artifacts/manager.js';
import { createDiagnosticArchive } from '../src/core/diagnostics/archive.js';
import type { ToolkitConfig } from '../src/types/config.js';

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('createDiagnosticArchive', () => {
  it('packages the run without recursively including the archive', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'selector-diagnostic-archive-'));
    temporaryDirectories.push(cwd);
    const config: ToolkitConfig = {
      cwd,
      artifactsDir: join(cwd, 'artifacts'),
      browser: 'chromium',
      headless: true,
      timeoutMs: 30_000,
      navigationTimeoutMs: 45_000,
      viewport: { width: 1200, height: 800 },
      trace: 'off',
      screenshots: 'off',
    };
    const run = await createArtifactRun(config, { command: 'evidence' });
    await writeJsonArtifact(run, 'reports/events.json', { errors: 1 });
    await writeTextArtifact(run, 'snapshots/page.html', '<html></html>');

    const path = await createDiagnosticArchive(run);
    const bytes = await readFile(path);
    expect(bytes.subarray(0, 2).toString('ascii')).toBe('PK');
    expect(bytes.length).toBeGreaterThan(100);
  });
});
