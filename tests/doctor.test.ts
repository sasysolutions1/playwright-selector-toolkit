import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { doctorExitCode, runDoctor } from '../src/core/doctor.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('runDoctor', () => {
  it('passes a supported environment with an executable browser path', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'selector-toolkit-'));
    temporaryDirectories.push(cwd);

    const report = await runDoctor({
      cwd,
      nodeVersion: 'v22.16.0',
      platform: 'linux',
      architecture: 'x64',
      playwrightVersion: '1.54.1',
      browserExecutablePath: process.execPath,
    });

    expect(report.summary.fail).toBe(0);
    expect(doctorExitCode(report)).toBe(0);
  });

  it('fails when Node.js is unsupported', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'selector-toolkit-'));
    temporaryDirectories.push(cwd);

    const report = await runDoctor({
      cwd,
      nodeVersion: 'v20.0.0',
      platform: 'linux',
      architecture: 'x64',
      playwrightVersion: '1.54.1',
      browserExecutablePath: process.execPath,
    });

    expect(report.checks.find((check) => check.id === 'node-version')?.status).toBe('fail');
    expect(doctorExitCode(report)).toBe(1);
  });

  it('treats a missing browser as a warning unless strict mode is enabled', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'selector-toolkit-'));
    temporaryDirectories.push(cwd);

    const normal = await runDoctor({
      cwd,
      nodeVersion: 'v22.16.0',
      platform: 'linux',
      architecture: 'x64',
      playwrightVersion: '1.54.1',
      browserExecutablePath: null,
    });

    const strict = await runDoctor({
      cwd,
      strict: true,
      nodeVersion: 'v22.16.0',
      platform: 'linux',
      architecture: 'x64',
      playwrightVersion: '1.54.1',
      browserExecutablePath: null,
    });

    expect(doctorExitCode(normal)).toBe(0);
    expect(doctorExitCode(strict, true)).toBe(1);
  });
});
