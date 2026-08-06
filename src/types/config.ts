export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type TraceMode = 'off' | 'on' | 'retain-on-failure';
export type ScreenshotMode = 'off' | 'always' | 'on-failure';
export type PluginFailureMode = 'isolate' | 'fail-fast';

export interface ViewportConfig {
  readonly width: number;
  readonly height: number;
}

export interface ViewportConfigInput {
  readonly width?: number | undefined;
  readonly height?: number | undefined;
}

export interface ToolkitConfig {
  readonly cwd: string;
  readonly artifactsDir: string;
  readonly browser: BrowserName;
  readonly headless: boolean;
  readonly timeoutMs: number;
  readonly navigationTimeoutMs: number;
  readonly viewport: ViewportConfig;
  readonly trace: TraceMode;
  readonly screenshots: ScreenshotMode;
  readonly baseUrl?: string | undefined;
  readonly userDataDir?: string | undefined;
  readonly storageStatePath?: string | undefined;
  readonly executablePath?: string | undefined;
  readonly plugins?: readonly string[] | undefined;
  readonly pluginTimeoutMs?: number | undefined;
  readonly pluginFailureMode?: PluginFailureMode | undefined;
}

export interface ToolkitConfigInput {
  readonly artifactsDir?: string | undefined;
  readonly browser?: BrowserName | undefined;
  readonly headless?: boolean | undefined;
  readonly timeoutMs?: number | undefined;
  readonly navigationTimeoutMs?: number | undefined;
  readonly viewport?: ViewportConfigInput | undefined;
  readonly trace?: TraceMode | undefined;
  readonly screenshots?: ScreenshotMode | undefined;
  readonly baseUrl?: string | undefined;
  readonly userDataDir?: string | undefined;
  readonly storageStatePath?: string | undefined;
  readonly executablePath?: string | undefined;
  readonly plugins?: readonly string[] | undefined;
  readonly pluginTimeoutMs?: number | undefined;
  readonly pluginFailureMode?: PluginFailureMode | undefined;
}

export interface ConfigSourceSummary {
  readonly configFile: string | null;
  readonly environmentVariables: readonly string[];
  readonly cliOptions: readonly string[];
}

export interface ResolvedToolkitConfig {
  readonly config: ToolkitConfig;
  readonly sources: ConfigSourceSummary;
}

export interface ResolveConfigOptions {
  readonly cwd?: string;
  readonly configPath?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly cli?: ToolkitConfigInput;
}
