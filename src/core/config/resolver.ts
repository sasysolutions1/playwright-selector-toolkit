import { access } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { ConfigError } from '../../errors/toolkit-error.js';
import type {
  ResolveConfigOptions,
  ResolvedToolkitConfig,
  ToolkitConfig,
  ToolkitConfigInput,
  ViewportConfigInput,
} from '../../types/config.js';

type MutableConfigInput = { -readonly [Key in keyof ToolkitConfigInput]: ToolkitConfigInput[Key] };
type MutableViewportInput = {
  -readonly [Key in keyof ViewportConfigInput]: ViewportConfigInput[Key];
};
import { findConfigFile, readConfigFile, resolveExplicitConfigPath } from './discovery.js';
import { readEnvironmentConfig } from './environment.js';
import { parseConfigInput } from './schema.js';

export const DEFAULT_TOOLKIT_CONFIG = {
  artifactsDir: '.selector-artifacts',
  browser: 'chromium',
  headless: true,
  timeoutMs: 30_000,
  navigationTimeoutMs: 45_000,
  viewport: { width: 1440, height: 900 },
  trace: 'retain-on-failure',
  screenshots: 'on-failure',
  plugins: [],
  pluginTimeoutMs: 10_000,
  pluginFailureMode: 'isolate',
} as const satisfies Required<
  Pick<
    ToolkitConfigInput,
    | 'artifactsDir'
    | 'browser'
    | 'headless'
    | 'timeoutMs'
    | 'navigationTimeoutMs'
    | 'viewport'
    | 'trace'
    | 'screenshots'
    | 'plugins'
    | 'pluginTimeoutMs'
    | 'pluginFailureMode'
  >
>;

function resolveLayerPaths(input: ToolkitConfigInput, baseDirectory: string): ToolkitConfigInput {
  const result: MutableConfigInput = { ...input };

  if (input.artifactsDir !== undefined) {
    result.artifactsDir = isAbsolute(input.artifactsDir)
      ? input.artifactsDir
      : resolve(baseDirectory, input.artifactsDir);
  }

  if (input.userDataDir !== undefined) {
    result.userDataDir = isAbsolute(input.userDataDir)
      ? input.userDataDir
      : resolve(baseDirectory, input.userDataDir);
  }

  if (input.executablePath !== undefined) {
    result.executablePath = isAbsolute(input.executablePath)
      ? input.executablePath
      : resolve(baseDirectory, input.executablePath);
  }

  if (input.storageStatePath !== undefined) {
    result.storageStatePath = isAbsolute(input.storageStatePath)
      ? input.storageStatePath
      : resolve(baseDirectory, input.storageStatePath);
  }

  if (input.plugins !== undefined) {
    result.plugins = input.plugins.map((specifier) => {
      if (specifier.startsWith('file:') || (!specifier.startsWith('.') && !isAbsolute(specifier))) {
        return specifier;
      }
      return isAbsolute(specifier) ? specifier : resolve(baseDirectory, specifier);
    });
  }

  return result;
}

function mergeLayers(layers: readonly ToolkitConfigInput[]): ToolkitConfigInput {
  const merged: MutableConfigInput = {};
  let viewport: MutableViewportInput = {};

  for (const layer of layers) {
    if (layer.artifactsDir !== undefined) merged.artifactsDir = layer.artifactsDir;
    if (layer.browser !== undefined) merged.browser = layer.browser;
    if (layer.headless !== undefined) merged.headless = layer.headless;
    if (layer.timeoutMs !== undefined) merged.timeoutMs = layer.timeoutMs;
    if (layer.navigationTimeoutMs !== undefined)
      merged.navigationTimeoutMs = layer.navigationTimeoutMs;
    if (layer.trace !== undefined) merged.trace = layer.trace;
    if (layer.screenshots !== undefined) merged.screenshots = layer.screenshots;
    if (layer.baseUrl !== undefined) merged.baseUrl = layer.baseUrl;
    if (layer.userDataDir !== undefined) merged.userDataDir = layer.userDataDir;
    if (layer.storageStatePath !== undefined) merged.storageStatePath = layer.storageStatePath;
    if (layer.executablePath !== undefined) merged.executablePath = layer.executablePath;
    if (layer.plugins !== undefined) merged.plugins = layer.plugins;
    if (layer.pluginTimeoutMs !== undefined) merged.pluginTimeoutMs = layer.pluginTimeoutMs;
    if (layer.pluginFailureMode !== undefined) merged.pluginFailureMode = layer.pluginFailureMode;
    if (layer.viewport !== undefined) viewport = { ...viewport, ...layer.viewport };
  }

  if (Object.keys(viewport).length > 0) {
    merged.viewport = viewport;
  }

  return merged;
}

function cliSourceNames(input: ToolkitConfigInput): string[] {
  return Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
}

export async function resolveToolkitConfig(
  options: ResolveConfigOptions = {},
): Promise<ResolvedToolkitConfig> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const explicitPath =
    options.configPath === undefined ? null : resolveExplicitConfigPath(cwd, options.configPath);
  if (explicitPath !== null) {
    try {
      await access(explicitPath);
    } catch (error) {
      throw new ConfigError(
        'CONFIG_NOT_FOUND',
        `Configuration file was not found: ${explicitPath}`,
        {
          cause: error,
          details: { path: explicitPath },
        },
      );
    }
  }

  const configFile = explicitPath ?? (await findConfigFile(cwd));

  let fileConfig: ToolkitConfigInput = {};
  if (configFile !== null) {
    fileConfig = resolveLayerPaths(await readConfigFile(configFile), dirname(configFile));
  }

  const environment = readEnvironmentConfig(options.env ?? process.env);
  const environmentConfig = resolveLayerPaths(environment.config, cwd);

  let cliConfig: ToolkitConfigInput;
  try {
    cliConfig = parseConfigInput(options.cli ?? {});
  } catch (error) {
    const issues =
      error instanceof Error && 'issues' in error
        ? (error as { readonly issues: unknown }).issues
        : undefined;
    throw new ConfigError('CONFIG_INVALID', 'CLI configuration is invalid', {
      cause: error,
      details: issues === undefined ? {} : { issues },
    });
  }
  cliConfig = resolveLayerPaths(cliConfig, cwd);

  const defaults = resolveLayerPaths(DEFAULT_TOOLKIT_CONFIG, cwd);
  const merged = mergeLayers([defaults, fileConfig, environmentConfig, cliConfig]);

  let validated: ToolkitConfigInput;
  try {
    validated = parseConfigInput(merged);
  } catch (error) {
    const issues =
      error instanceof Error && 'issues' in error
        ? (error as { readonly issues: unknown }).issues
        : undefined;
    throw new ConfigError('CONFIG_INVALID', 'Resolved configuration is invalid', {
      cause: error,
      details: issues === undefined ? {} : { issues },
    });
  }

  const viewport = validated.viewport;
  if (
    validated.artifactsDir === undefined ||
    validated.browser === undefined ||
    validated.headless === undefined ||
    validated.timeoutMs === undefined ||
    validated.navigationTimeoutMs === undefined ||
    viewport?.width === undefined ||
    viewport.height === undefined ||
    validated.trace === undefined ||
    validated.screenshots === undefined ||
    validated.plugins === undefined ||
    validated.pluginTimeoutMs === undefined ||
    validated.pluginFailureMode === undefined
  ) {
    throw new ConfigError('CONFIG_INVALID', 'Resolved configuration is incomplete');
  }

  const config: ToolkitConfig = {
    cwd,
    artifactsDir: validated.artifactsDir,
    browser: validated.browser,
    headless: validated.headless,
    timeoutMs: validated.timeoutMs,
    navigationTimeoutMs: validated.navigationTimeoutMs,
    viewport: { width: viewport.width, height: viewport.height },
    trace: validated.trace,
    screenshots: validated.screenshots,
    plugins: validated.plugins,
    pluginTimeoutMs: validated.pluginTimeoutMs,
    pluginFailureMode: validated.pluginFailureMode,
    ...(validated.baseUrl === undefined ? {} : { baseUrl: validated.baseUrl }),
    ...(validated.userDataDir === undefined ? {} : { userDataDir: validated.userDataDir }),
    ...(validated.storageStatePath === undefined
      ? {}
      : { storageStatePath: validated.storageStatePath }),
    ...(validated.executablePath === undefined ? {} : { executablePath: validated.executablePath }),
  };

  return {
    config,
    sources: {
      configFile,
      environmentVariables: environment.variables,
      cliOptions: cliSourceNames(options.cli ?? {}),
    },
  };
}
