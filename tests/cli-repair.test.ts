import { describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import type { ResolvedToolkitConfig } from '../src/types/config.js';
import type { SelectorRepairRunReport } from '../src/types/repair.js';

const resolvedConfig: ResolvedToolkitConfig = {
  config: {
    cwd: '/tmp/toolkit',
    artifactsDir: '/tmp/toolkit/artifacts',
    browser: 'chromium',
    headless: true,
    timeoutMs: 30_000,
    navigationTimeoutMs: 45_000,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshots: 'on-failure',
  },
  sources: { configFile: null, environmentVariables: [], cliOptions: [] },
};

function runReport(unresolved = 0): SelectorRepairRunReport {
  const artifactRun = {
    id: 'run',
    command: 'repair',
    createdAt: '2026-07-18T00:00:00.000Z',
    directories: {
      root: '/tmp/toolkit/artifacts',
      run: '/tmp/toolkit/artifacts/run',
      screenshots: '/tmp/toolkit/artifacts/run/screenshots',
      snapshots: '/tmp/toolkit/artifacts/run/snapshots',
      traces: '/tmp/toolkit/artifacts/run/traces',
      reports: '/tmp/toolkit/artifacts/run/reports',
    },
    metadataPath: '/tmp/toolkit/artifacts/run/run.json',
  };
  return {
    navigation: {
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com/',
      title: 'Example',
      status: 200,
      ok: true,
    },
    session: {
      id: 'run',
      browser: 'chromium',
      mode: 'ephemeral',
      headless: true,
      createdAt: '2026-07-18T00:00:00.000Z',
      currentUrl: 'https://example.com/',
      pageCount: 1,
      traceActive: true,
      userDataDir: null,
      storageStatePath: null,
      artifactRun,
    },
    artifactRun,
    manifestPath: '/tmp/selectors.yaml',
    reportPath: '/tmp/toolkit/artifacts/run/reports/selector-repair.json',
    proposalPath: '/tmp/toolkit/artifacts/run/reports/selector-repair-proposal.yaml',
    report: {
      schemaVersion: '1.0',
      toolkitVersion: '0.15.0',
      generatedAt: '2026-07-18T00:00:00.000Z',
      manifestPath: '/tmp/selectors.yaml',
      manifestName: 'Login',
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com/',
      title: 'Example',
      provider: 'none',
      model: null,
      summary: {
        manifestSelectorCount: 1,
        failedSelectorCount: 1,
        requiredFailureCount: 1,
        optionalFailureCount: 0,
        selectorsWithSuggestions: unresolved === 0 ? 1 : 0,
        selectorsWithRecommendation: unresolved === 0 ? 1 : 0,
        unresolvedRequiredCount: unresolved,
        unresolvedOptionalCount: 0,
        aiAssistedCount: 0,
        approvalRequired: true,
      },
      validationSummary: {
        total: 1,
        required: 1,
        optional: 0,
        passed: 0,
        failed: 1,
        errors: 0,
        requiredFailures: 1,
        optionalFailures: 0,
        success: false,
      },
      repairs: [],
      proposalPath: 'reports/selector-repair-proposal.yaml',
      approvalRequired: true,
      warnings: [],
    },
    close: {
      closedAt: '2026-07-18T00:00:01.000Z',
      tracePath: null,
      screenshotPath: null,
      storageStatePath: null,
      warnings: [],
    },
  };
}

describe('repair CLI command', () => {
  it('maps deterministic repair options and prints a human report', async () => {
    let output = '';
    const repairer = vi.fn(async () => runReport());
    const setExitCode = vi.fn();
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      selectorRepairer: repairer,
      writeOut: (value) => {
        output += value;
      },
      setExitCode,
    });
    await program.parseAsync([
      'node',
      'selector',
      'repair',
      'selectors.yaml',
      'https://example.com',
      '--max-suggestions',
      '4',
      '--minimum-score',
      '62',
      '--include-optional',
    ]);
    expect(repairer).toHaveBeenCalledWith(
      resolvedConfig.config,
      'selectors.yaml',
      expect.objectContaining({
        url: 'https://example.com',
        provider: 'none',
        maxSuggestions: 4,
        minimumScore: 62,
        includeOptional: true,
      }),
    );
    expect(output).toContain('Selector repair suggestions generated');
    expect(setExitCode).toHaveBeenCalledWith(0);
  });

  it('passes OpenAI environment configuration without displaying the key', async () => {
    const repairer = vi.fn(async () => runReport());
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      selectorRepairer: repairer,
      env: { OPENAI_API_KEY: 'secret-key', SELECTOR_AI_MODEL: 'model-x' },
      writeOut: () => undefined,
    });
    await program.parseAsync([
      'node',
      'selector',
      'repair',
      'selectors.yaml',
      '--provider',
      'openai',
    ]);
    expect(repairer).toHaveBeenCalledWith(
      resolvedConfig.config,
      'selectors.yaml',
      expect.objectContaining({
        provider: 'openai',
        model: 'model-x',
        apiKey: 'secret-key',
      }),
    );
  });

  it('returns exit code one only when requested and required selectors remain unresolved', async () => {
    const setExitCode = vi.fn();
    const program = createProgram({
      configResolver: async () => resolvedConfig,
      selectorRepairer: async () => runReport(1),
      writeOut: () => undefined,
      setExitCode,
    });
    await program.parseAsync([
      'node',
      'selector',
      'repair',
      'selectors.yaml',
      '--fail-on-unresolved',
    ]);
    expect(setExitCode).toHaveBeenCalledWith(1);
  });
});
