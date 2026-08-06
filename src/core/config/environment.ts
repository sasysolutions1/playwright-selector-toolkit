import { ConfigError } from '../../errors/toolkit-error.js';
import type { ToolkitConfigInput, ViewportConfigInput } from '../../types/config.js';

type MutableConfigInput = { -readonly [Key in keyof ToolkitConfigInput]: ToolkitConfigInput[Key] };
type MutableViewportInput = {
  -readonly [Key in keyof ViewportConfigInput]: ViewportConfigInput[Key];
};

export interface EnvironmentConfigResult {
  readonly config: ToolkitConfigInput;
  readonly variables: readonly string[];
}

function parseBoolean(name: string, value: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new ConfigError('CONFIG_INVALID', `${name} must be a boolean value`, {
    details: { variable: name, value },
  });
}

function parseInteger(name: string, value: string): number {
  const result = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(result)) {
    throw new ConfigError('CONFIG_INVALID', `${name} must be an integer`, {
      details: { variable: name, value },
    });
  }

  return result;
}

export function readEnvironmentConfig(env: NodeJS.ProcessEnv): EnvironmentConfigResult {
  const config: MutableConfigInput = {};
  const variables: string[] = [];

  const read = (name: string): string | undefined => {
    const value = env[name];
    if (value !== undefined && value.trim() !== '') {
      variables.push(name);
      return value.trim();
    }
    return undefined;
  };

  const artifactsDir = read('SELECTOR_ARTIFACTS_DIR');
  const browser = read('SELECTOR_BROWSER');
  const headless = read('SELECTOR_HEADLESS');
  const timeoutMs = read('SELECTOR_TIMEOUT_MS');
  const navigationTimeoutMs = read('SELECTOR_NAVIGATION_TIMEOUT_MS');
  const viewportWidth = read('SELECTOR_VIEWPORT_WIDTH');
  const viewportHeight = read('SELECTOR_VIEWPORT_HEIGHT');
  const trace = read('SELECTOR_TRACE');
  const screenshots = read('SELECTOR_SCREENSHOTS');
  const baseUrl = read('SELECTOR_BASE_URL');
  const userDataDir = read('SELECTOR_USER_DATA_DIR');
  const storageStatePath = read('SELECTOR_STORAGE_STATE_PATH');
  const executablePath = read('SELECTOR_EXECUTABLE_PATH');
  const plugins = read('SELECTOR_PLUGINS');
  const pluginTimeoutMs = read('SELECTOR_PLUGIN_TIMEOUT_MS');
  const pluginFailureMode = read('SELECTOR_PLUGIN_FAILURE_MODE');

  if (artifactsDir !== undefined) config.artifactsDir = artifactsDir;
  if (browser !== undefined) config.browser = browser as ToolkitConfigInput['browser'];
  if (headless !== undefined) config.headless = parseBoolean('SELECTOR_HEADLESS', headless);
  if (timeoutMs !== undefined) config.timeoutMs = parseInteger('SELECTOR_TIMEOUT_MS', timeoutMs);
  if (navigationTimeoutMs !== undefined)
    config.navigationTimeoutMs = parseInteger(
      'SELECTOR_NAVIGATION_TIMEOUT_MS',
      navigationTimeoutMs,
    );
  if (trace !== undefined) config.trace = trace as ToolkitConfigInput['trace'];
  if (screenshots !== undefined)
    config.screenshots = screenshots as ToolkitConfigInput['screenshots'];
  if (baseUrl !== undefined) config.baseUrl = baseUrl;
  if (userDataDir !== undefined) config.userDataDir = userDataDir;
  if (storageStatePath !== undefined) config.storageStatePath = storageStatePath;
  if (executablePath !== undefined) config.executablePath = executablePath;
  if (plugins !== undefined) {
    config.plugins = plugins
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (pluginTimeoutMs !== undefined) {
    config.pluginTimeoutMs = parseInteger('SELECTOR_PLUGIN_TIMEOUT_MS', pluginTimeoutMs);
  }
  if (pluginFailureMode !== undefined) {
    config.pluginFailureMode = pluginFailureMode as ToolkitConfigInput['pluginFailureMode'];
  }

  if (viewportWidth !== undefined || viewportHeight !== undefined) {
    const viewport: MutableViewportInput = {};
    if (viewportWidth !== undefined) {
      viewport.width = parseInteger('SELECTOR_VIEWPORT_WIDTH', viewportWidth);
    }
    if (viewportHeight !== undefined) {
      viewport.height = parseInteger('SELECTOR_VIEWPORT_HEIGHT', viewportHeight);
    }
    config.viewport = viewport;
  }

  return { config, variables };
}
