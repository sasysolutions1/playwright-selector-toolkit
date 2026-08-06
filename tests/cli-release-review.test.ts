import { describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import type { ResolvedToolkitConfig } from '../src/types/config.js';
import type { CompatibilityReport, SecurityReviewReport } from '../src/types/release.js';

const resolved: ResolvedToolkitConfig = {
  config: {
    cwd: '/tmp/toolkit',
    artifactsDir: '/tmp/toolkit/artifacts',
    browser: 'chromium',
    headless: true,
    timeoutMs: 30000,
    navigationTimeoutMs: 45000,
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    screenshots: 'off',
  },
  sources: { configFile: null, environmentVariables: [], cliOptions: [] },
};

const compatibility: CompatibilityReport = {
  schemaVersion: '1.0',
  generatedAt: '2026-07-18T00:00:00.000Z',
  toolkitVersion: '0.16.0',
  cwd: '/tmp/toolkit',
  packagePath: '/tmp/toolkit/package.json',
  runtime: { node: 'v22.14.0', npm: '11.5.1', platform: 'linux', architecture: 'x64' },
  supportedNodeMajors: [22, 24],
  minimumNodeVersion: '22.14.0',
  checks: [],
  summary: { pass: 10, warn: 0, fail: 0 },
};

const security: SecurityReviewReport = {
  schemaVersion: '1.0',
  generatedAt: '2026-07-18T00:00:00.000Z',
  toolkitVersion: '0.16.0',
  cwd: '/tmp/toolkit',
  packagePath: '/tmp/toolkit/package.json',
  checks: [],
  findings: [],
  summary: { pass: 8, warn: 0, fail: 0 },
};

describe('release review CLI', () => {
  it('emits compatibility JSON and exit code', async () => {
    let output = '';
    const setExitCode = vi.fn();
    const program = createProgram({
      configResolver: async () => resolved,
      compatibilityReviewer: async () => compatibility,
      writeOut: (value) => {
        output += value;
      },
      setExitCode,
    });
    await program.parseAsync(['node', 'selector', '--json', 'compatibility']);
    expect(JSON.parse(output)).toMatchObject({ minimumNodeVersion: '22.14.0' });
    expect(setExitCode).toHaveBeenCalledWith(0);
  });

  it('runs the security audit command', async () => {
    let output = '';
    const setExitCode = vi.fn();
    const program = createProgram({
      configResolver: async () => resolved,
      securityReviewer: async () => security,
      writeOut: (value) => {
        output += value;
      },
      setExitCode,
    });
    await program.parseAsync(['node', 'selector', 'security', 'audit']);
    expect(output).toContain('Security review complete');
    expect(setExitCode).toHaveBeenCalledWith(0);
  });
});
