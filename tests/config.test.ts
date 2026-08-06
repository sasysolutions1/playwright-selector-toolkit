import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findConfigFile } from '../src/core/config/discovery.js';
import { resolveToolkitConfig } from '../src/core/config/resolver.js';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'selector-config-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('configuration discovery and resolution', () => {
  it('discovers a configuration file by walking up parent directories', async () => {
    const root = await temporaryDirectory();
    const nested = join(root, 'packages', 'example');
    await mkdir(nested, { recursive: true });
    const configPath = join(root, 'selector.config.json');
    await writeFile(configPath, '{}\n', 'utf8');

    await expect(findConfigFile(nested)).resolves.toBe(configPath);
  });

  it('merges defaults, file, environment, and CLI settings in precedence order', async () => {
    const root = await temporaryDirectory();
    const nested = join(root, 'project', 'nested');
    await mkdir(nested, { recursive: true });
    await writeFile(
      join(root, 'selector.config.json'),
      JSON.stringify({
        artifactsDir: './file-artifacts',
        browser: 'firefox',
        timeoutMs: 10_000,
        viewport: { width: 1200 },
      }),
      'utf8',
    );

    const resolved = await resolveToolkitConfig({
      cwd: nested,
      env: {
        SELECTOR_BROWSER: 'webkit',
        SELECTOR_TIMEOUT_MS: '15000',
        SELECTOR_VIEWPORT_HEIGHT: '777',
      },
      cli: {
        browser: 'chromium',
        headless: false,
        timeoutMs: 20_000,
      },
    });

    expect(resolved.config).toMatchObject({
      browser: 'chromium',
      headless: false,
      timeoutMs: 20_000,
      viewport: { width: 1200, height: 777 },
      artifactsDir: resolve(root, 'file-artifacts'),
    });
    expect(resolved.sources.configFile).toBe(join(root, 'selector.config.json'));
    expect(resolved.sources.environmentVariables).toContain('SELECTOR_BROWSER');
    expect(resolved.sources.cliOptions).toContain('browser');
  });

  it('parses YAML configuration files', async () => {
    const root = await temporaryDirectory();
    await writeFile(
      join(root, '.selectorrc.yaml'),
      ['browser: firefox', 'headless: false', 'viewport:', '  width: 1024', '  height: 768'].join(
        '\n',
      ),
      'utf8',
    );

    const resolved = await resolveToolkitConfig({ cwd: root, env: {} });
    expect(resolved.config.browser).toBe('firefox');
    expect(resolved.config.headless).toBe(false);
    expect(resolved.config.viewport).toEqual({ width: 1024, height: 768 });
  });

  it('raises a structured error for invalid environment configuration', async () => {
    const root = await temporaryDirectory();

    await expect(
      resolveToolkitConfig({ cwd: root, env: { SELECTOR_HEADLESS: 'sometimes' } }),
    ).rejects.toMatchObject({ code: 'CONFIG_INVALID' });
  });

  it('resolves navigation timeout and storage-state paths from environment variables', async () => {
    const root = await temporaryDirectory();
    const resolved = await resolveToolkitConfig({
      cwd: root,
      env: {
        SELECTOR_NAVIGATION_TIMEOUT_MS: '55000',
        SELECTOR_STORAGE_STATE_PATH: './auth/state.json',
        SELECTOR_EXECUTABLE_PATH: './bin/chromium',
      },
    });

    expect(resolved.config.navigationTimeoutMs).toBe(55_000);
    expect(resolved.config.storageStatePath).toBe(resolve(root, 'auth/state.json'));
    expect(resolved.config.executablePath).toBe(resolve(root, 'bin/chromium'));
  });

  it('raises CONFIG_NOT_FOUND for a missing explicit configuration file', async () => {
    const root = await temporaryDirectory();

    await expect(
      resolveToolkitConfig({ cwd: root, configPath: 'missing.json', env: {} }),
    ).rejects.toMatchObject({ code: 'CONFIG_NOT_FOUND' });
  });

  it('resolves local plugin paths relative to the configuration file', async () => {
    const root = await temporaryDirectory();
    const nested = join(root, 'packages', 'app');
    await mkdir(nested, { recursive: true });
    await writeFile(
      join(root, 'selector.config.json'),
      JSON.stringify({
        plugins: ['./plugins/auth.mjs', '@scope/shared-plugin'],
        pluginTimeoutMs: 2500,
        pluginFailureMode: 'fail-fast',
      }),
      'utf8',
    );

    const resolved = await resolveToolkitConfig({ cwd: nested, env: {} });
    expect(resolved.config.plugins).toEqual([
      resolve(root, 'plugins/auth.mjs'),
      '@scope/shared-plugin',
    ]);
    expect(resolved.config.pluginTimeoutMs).toBe(2500);
    expect(resolved.config.pluginFailureMode).toBe('fail-fast');
  });

  it('loads plugin settings from environment variables', async () => {
    const root = await temporaryDirectory();
    const resolved = await resolveToolkitConfig({
      cwd: root,
      env: {
        SELECTOR_PLUGINS: './one.mjs,@scope/two',
        SELECTOR_PLUGIN_TIMEOUT_MS: '3000',
        SELECTOR_PLUGIN_FAILURE_MODE: 'isolate',
      },
    });

    expect(resolved.config.plugins).toEqual([resolve(root, 'one.mjs'), '@scope/two']);
    expect(resolved.config.pluginTimeoutMs).toBe(3000);
    expect(resolved.sources.environmentVariables).toContain('SELECTOR_PLUGINS');
  });
});
