import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

describe('release configuration', () => {
  it('uses a Node 22/24 CI matrix and trusted npm publishing', async () => {
    const ci = await readFile('.github/workflows/ci.yml', 'utf8');
    const release = await readFile('.github/workflows/release.yml', 'utf8');
    const releaseWorkflow = parse(release) as { jobs?: { publish?: { environment?: unknown } } };
    expect(releaseWorkflow.jobs?.publish?.environment).toBe('npm');
    expect(ci).toContain('node: [22, 24]');
    expect(release).toContain('id-token: write');
    expect(release).toContain('npm@11.5.1');
    expect(release).toContain('npm publish --ignore-scripts');
    expect(release).toContain('actions/attest@v4');
  });

  it('enables CodeQL and Dependabot for npm and actions', async () => {
    const codeql = await readFile('.github/workflows/codeql.yml', 'utf8');
    const dependabot = await readFile('.github/dependabot.yml', 'utf8');
    expect(codeql).toContain('javascript-typescript');
    expect(dependabot).toContain('package-ecosystem: npm');
    expect(dependabot).toContain('package-ecosystem: github-actions');
  });
});
