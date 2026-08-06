import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createArtifactRun,
  resolveArtifactPath,
  writeJsonArtifact,
} from '../src/core/artifacts/manager.js';
import { ArtifactError } from '../src/errors/toolkit-error.js';
import type { ToolkitConfig } from '../src/types/config.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function config(): Promise<ToolkitConfig> {
  const cwd = await mkdtemp(join(tmpdir(), 'selector-artifacts-'));
  temporaryDirectories.push(cwd);
  return {
    cwd,
    artifactsDir: join(cwd, 'artifacts'),
    browser: 'chromium',
    headless: true,
    timeoutMs: 30_000,
    navigationTimeoutMs: 45_000,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshots: 'on-failure',
  };
}

describe('artifact manager', () => {
  it('creates a structured run directory and metadata file', async () => {
    const toolkitConfig = await config();
    const run = await createArtifactRun(toolkitConfig, {
      command: 'discover',
      name: 'Login Page',
      id: '12345678-1234-1234-1234-123456789abc',
      now: new Date('2026-07-17T12:34:56.000Z'),
    });

    await Promise.all([
      access(run.directories.screenshots),
      access(run.directories.snapshots),
      access(run.directories.traces),
      access(run.directories.reports),
    ]);

    const metadata = JSON.parse(await readFile(run.metadataPath, 'utf8')) as {
      command: string;
      name: string;
    };
    expect(metadata).toMatchObject({ command: 'discover', name: 'Login Page' });
    expect(run.directories.run).toContain('discover-12345678-login-page');
  });

  it('writes JSON only inside the current run directory', async () => {
    const toolkitConfig = await config();
    const run = await createArtifactRun(toolkitConfig, {
      command: 'validate',
      id: 'abcdefgh-1234-1234-1234-123456789abc',
      now: new Date('2026-07-17T00:00:00.000Z'),
    });

    const output = await writeJsonArtifact(run, 'reports/result.json', { pass: true });
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual({ pass: true });

    expect(() => resolveArtifactPath(run, '../../outside.json')).toThrowError(ArtifactError);
  });
});
