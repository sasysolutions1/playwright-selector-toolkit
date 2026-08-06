import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  compatibilityExitCode,
  parseVersion,
  runCompatibilityReview,
} from '../src/core/release/compatibility.js';

async function fixture(): Promise<string> {
  const cwd = await mkdtemp(resolve(tmpdir(), 'selector-compatibility-'));
  await writeFile(
    resolve(cwd, 'package.json'),
    JSON.stringify({
      name: 'playwright-selector-toolkit',
      version: '0.16.0',
      type: 'module',
      engines: { node: '>=22.14.0' },
      exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
      bin: {
        selector: './dist/cli/index.js',
        'selector-toolkit': './dist/cli/index.js',
      },
      dependencies: { playwright: '^1.54.1' },
      files: ['dist'],
    }),
  );
  await mkdir(resolve(cwd, 'dist/cli'), { recursive: true });
  await Promise.all([
    writeFile(resolve(cwd, 'dist/index.js'), 'export {};\n'),
    writeFile(resolve(cwd, 'dist/index.d.ts'), 'export {};\n'),
    writeFile(resolve(cwd, 'dist/cli/index.js'), '#!/usr/bin/env node\n'),
  ]);
  return cwd;
}

describe('compatibility review', () => {
  it('parses and compares versions', () => {
    expect(parseVersion('v22.14.0')).toEqual({ major: 22, minor: 14, patch: 0 });
    expect(compareVersions(parseVersion('22.14.1')!, parseVersion('22.14.0')!)).toBeGreaterThan(0);
    expect(parseVersion('invalid')).toBeNull();
  });

  it('passes a supported Node and complete build', async () => {
    const cwd = await fixture();
    const report = await runCompatibilityReview({
      cwd,
      nodeVersion: 'v22.14.0',
      npmVersion: '11.5.1',
      platform: 'linux',
      architecture: 'x64',
    });
    expect(report.summary.fail).toBe(0);
    expect(report.summary.warn).toBe(0);
    expect(compatibilityExitCode(report, true)).toBe(0);
  });

  it('warns for an untested release line and fails below the minimum', async () => {
    const cwd = await fixture();
    const current = await runCompatibilityReview({
      cwd,
      nodeVersion: 'v26.0.0',
      npmVersion: '11.5.1',
    });
    expect(current.checks.find((item) => item.id === 'runtime.node.matrix')?.status).toBe('warn');
    expect(compatibilityExitCode(current, true)).toBe(1);

    const old = await runCompatibilityReview({
      cwd,
      nodeVersion: 'v22.13.9',
      npmVersion: '11.5.1',
    });
    expect(old.summary.fail).toBeGreaterThan(0);
    expect(compatibilityExitCode(old)).toBe(1);
  });
});
