import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runSecurityReview,
  scanRepositorySecrets,
  securityReviewExitCode,
} from '../src/core/release/security.js';

async function secureFixture(): Promise<string> {
  const cwd = await mkdtemp(resolve(tmpdir(), 'selector-security-'));
  await writeFile(
    resolve(cwd, 'package.json'),
    JSON.stringify({
      name: 'playwright-selector-toolkit',
      private: false,
      files: ['dist', 'README.md', 'LICENSE', 'CHANGELOG.md', 'SECURITY.md'],
      publishConfig: { access: 'public' },
      scripts: { prepare: 'npm run build' },
      repository: { url: 'git+https://github.com/sasysolutions1/playwright-selector-toolkit.git' },
    }),
  );
  await writeFile(
    resolve(cwd, 'package-lock.json'),
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': {},
        'node_modules/x': { resolved: 'https://example.test/x.tgz', integrity: 'sha512-test' },
      },
    }),
  );
  await writeFile(resolve(cwd, '.npmrc'), 'engine-strict=true\n');
  await writeFile(resolve(cwd, 'LICENSE'), 'MIT License\n');
  await writeFile(resolve(cwd, 'SECURITY.md'), 'Report security issues privately.\n');
  await Promise.all([
    writeFile(resolve(cwd, 'README.md'), '# Test\n'),
    writeFile(resolve(cwd, 'CHANGELOG.md'), '# Changes\n'),
  ]);
  await mkdir(resolve(cwd, 'src'));
  await writeFile(resolve(cwd, 'src/index.ts'), "export const value = 'safe';\n");
  return cwd;
}

describe('security review', () => {
  it('passes a safe publish configuration', async () => {
    const cwd = await secureFixture();
    const report = await runSecurityReview({ cwd });
    expect(report.findings).toEqual([]);
    expect(report.summary.fail).toBe(0);
    expect(securityReviewExitCode(report, true)).toBe(0);
  });

  it('detects high-confidence secrets and unsafe install hooks', async () => {
    const cwd = await secureFixture();
    const packagePath = resolve(cwd, 'package.json');
    const manifest = JSON.parse(await readFile(packagePath, 'utf8')) as {
      scripts: Record<string, string>;
    };
    manifest.scripts.postinstall = 'node setup.js';
    await writeFile(packagePath, JSON.stringify(manifest));
    await writeFile(resolve(cwd, 'src/key.txt'), '-----BEGIN PRIVATE KEY-----\nnot-real\n');

    const findings = await scanRepositorySecrets(cwd);
    expect(findings.some((item) => item.rule === 'private-key')).toBe(true);
    const report = await runSecurityReview({ cwd });
    expect(report.summary.fail).toBeGreaterThan(0);
    expect(securityReviewExitCode(report)).toBe(1);
  });
});
