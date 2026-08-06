import type { ArtifactRun } from '../../types/artifacts.js';
import type { ToolkitConfig } from '../../types/config.js';
import type { DomElementSnapshot } from '../../types/dom.js';
import type { ResolvedLocatorGenerationOptions } from '../../types/locator.js';
import type {
  LoadedPlugin,
  PluginAuthenticationContext,
  PluginAuthenticationResult,
  PluginBaseContext,
  PluginDiagnosticEvent,
  PluginGeneratedLocatorCandidate,
  PluginHookKind,
  PluginHostLike,
  PluginHostReport,
  PluginLocatorContext,
  PluginMetadata,
  PluginPageStateMatch,
  PluginRedactionContext,
  PluginRuntimeOptions,
  SelectorToolkitPlugin,
} from '../../types/plugins.js';
import type { Page } from 'playwright';
import { PluginError } from '../../errors/toolkit-error.js';

interface HookDescriptor<Hook> {
  readonly plugin: LoadedPlugin;
  readonly hook: Hook;
  readonly order: number;
}

interface HostDependencies {
  readonly now?: () => Date;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown plugin error';
  }
}

function sortHooks<Hook extends { readonly id: string; readonly order?: number }>(
  plugins: readonly LoadedPlugin[],
  select: (plugin: SelectorToolkitPlugin) => readonly Hook[] | undefined,
): readonly HookDescriptor<Hook>[] {
  return plugins
    .flatMap((plugin) =>
      (select(plugin.definition) ?? []).map((hook) => ({
        plugin,
        hook,
        order: hook.order ?? 0,
      })),
    )
    .sort(
      (left, right) =>
        (left.plugin.definition.order ?? 0) - (right.plugin.definition.order ?? 0) ||
        left.order - right.order ||
        left.plugin.definition.name.localeCompare(right.plugin.definition.name) ||
        left.hook.id.localeCompare(right.hook.id),
    );
}

function pluginMetadata(plugin: LoadedPlugin): PluginMetadata {
  const definition = plugin.definition;
  return {
    name: definition.name,
    version: definition.version ?? null,
    description: definition.description ?? null,
    order: definition.order ?? 0,
    specifier: plugin.specifier,
    hooks: {
      setup: definition.setup === undefined ? 0 : 1,
      teardown: definition.teardown === undefined ? 0 : 1,
      authentication: definition.authentication?.length ?? 0,
      'page-state': definition.pageStateDetectors?.length ?? 0,
      'redact-text':
        definition.redactors?.filter((hook) => hook.redactText !== undefined).length ?? 0,
      'sanitize-url':
        definition.redactors?.filter((hook) => hook.sanitizeUrl !== undefined).length ?? 0,
      'locator-candidate': definition.locatorCandidateGenerators?.length ?? 0,
    },
  };
}

function createLogger(plugin: string, warnings: string[]): PluginBaseContext['logger'] {
  const record = (
    level: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): void => {
    if (level === 'warn') {
      warnings.push(
        `[${plugin}] ${message}${details === undefined ? '' : ` ${JSON.stringify(details)}`}`,
      );
    }
  };
  return {
    debug: (message, details) => record('debug', message, details),
    info: (message, details) => record('info', message, details),
    warn: (message, details) => record('warn', message, details),
  };
}

export class PluginHost implements PluginHostLike {
  readonly #plugins: readonly LoadedPlugin[];
  readonly #options: PluginRuntimeOptions;
  readonly #diagnostics: PluginDiagnosticEvent[] = [];
  readonly #warnings: string[] = [];
  readonly #pageStates: PluginPageStateMatch[] = [];
  readonly #states = new Map<string, Map<string, unknown>>();
  readonly #now: () => Date;
  #initialized = false;

  constructor(
    plugins: readonly LoadedPlugin[],
    options: PluginRuntimeOptions,
    dependencies: HostDependencies = {},
  ) {
    this.#plugins = [...plugins];
    this.#options = options;
    this.#now = dependencies.now ?? (() => new Date());
    for (const plugin of plugins) this.#states.set(plugin.definition.name, new Map());
  }

  get size(): number {
    return this.#plugins.length;
  }

  async initialize(config: ToolkitConfig, artifactRun: ArtifactRun | null = null): Promise<void> {
    if (this.#initialized) return;
    for (const plugin of this.#plugins) {
      if (plugin.definition.setup === undefined) continue;
      await this.#runAsyncHook(
        plugin,
        'setup',
        'setup',
        (context) => plugin.definition.setup?.(context),
        config,
        artifactRun,
      );
    }
    this.#initialized = true;
  }

  async teardown(config: ToolkitConfig, artifactRun: ArtifactRun | null = null): Promise<void> {
    if (!this.#initialized) return;
    for (const plugin of [...this.#plugins].reverse()) {
      if (plugin.definition.teardown === undefined) continue;
      await this.#runAsyncHook(
        plugin,
        'teardown',
        'teardown',
        (context) => plugin.definition.teardown?.(context),
        config,
        artifactRun,
      );
    }
    this.#initialized = false;
  }

  async runAuthentication(
    page: Page,
    requestedUrl: string,
    config: ToolkitConfig,
    artifactRun: ArtifactRun | null = null,
  ): Promise<readonly PluginAuthenticationResult[]> {
    const results: PluginAuthenticationResult[] = [];
    for (const descriptor of sortHooks(this.#plugins, (plugin) => plugin.authentication)) {
      const result = await this.#runAsyncHook(
        descriptor.plugin,
        'authentication',
        descriptor.hook.id,
        async (base) => {
          const context: PluginAuthenticationContext = { ...base, page, requestedUrl };
          return descriptor.hook.run(context);
        },
        config,
        artifactRun,
      );
      if (result !== undefined) results.push(result);
    }
    return results;
  }

  async detectPageStates(
    page: Page,
    requestedUrl: string,
    config: ToolkitConfig,
    artifactRun: ArtifactRun | null = null,
  ): Promise<readonly PluginPageStateMatch[]> {
    const matches: PluginPageStateMatch[] = [];
    for (const descriptor of sortHooks(this.#plugins, (plugin) => plugin.pageStateDetectors)) {
      const result = await this.#runAsyncHook(
        descriptor.plugin,
        'page-state',
        descriptor.hook.id,
        async (base) => descriptor.hook.detect({ ...base, page, requestedUrl }),
        config,
        artifactRun,
      );
      if (result !== undefined && result !== false && result !== null) {
        const normalized = {
          ...result,
          confidence: Math.max(0, Math.min(1, result.confidence)),
        };
        matches.push(normalized);
        this.#pageStates.push(normalized);
      }
    }
    return matches;
  }

  redactText(value: string, context: Omit<PluginRedactionContext, 'pluginName'>): string {
    let current = value;
    for (const descriptor of sortHooks(this.#plugins, (plugin) => plugin.redactors)) {
      if (descriptor.hook.redactText === undefined) continue;
      current = this.#runSyncHook(
        descriptor.plugin,
        'redact-text',
        descriptor.hook.id,
        () =>
          descriptor.hook.redactText?.(current, {
            ...context,
            pluginName: descriptor.plugin.definition.name,
          }) ?? current,
        current,
      );
    }
    return current;
  }

  sanitizeUrl(value: string, context: Omit<PluginRedactionContext, 'pluginName'>): string {
    let current = value;
    for (const descriptor of sortHooks(this.#plugins, (plugin) => plugin.redactors)) {
      if (descriptor.hook.sanitizeUrl === undefined) continue;
      current = this.#runSyncHook(
        descriptor.plugin,
        'sanitize-url',
        descriptor.hook.id,
        () =>
          descriptor.hook.sanitizeUrl?.(current, {
            ...context,
            pluginName: descriptor.plugin.definition.name,
          }) ?? current,
        current,
      );
    }
    return current;
  }

  generateLocatorCandidates(
    element: DomElementSnapshot,
    options: ResolvedLocatorGenerationOptions,
  ): readonly PluginGeneratedLocatorCandidate[] {
    const candidates: PluginGeneratedLocatorCandidate[] = [];
    for (const descriptor of sortHooks(
      this.#plugins,
      (plugin) => plugin.locatorCandidateGenerators,
    )) {
      const generated = this.#runSyncHook(
        descriptor.plugin,
        'locator-candidate',
        descriptor.hook.id,
        () => {
          const context: PluginLocatorContext = {
            pluginName: descriptor.plugin.definition.name,
            options,
          };
          return descriptor.hook.generate(element, context);
        },
        [],
      );
      for (const candidate of generated) {
        candidates.push({
          ...candidate,
          pluginName: descriptor.plugin.definition.name,
          generatorId: descriptor.hook.id,
        });
      }
    }
    return candidates;
  }

  report(): PluginHostReport {
    return {
      schemaVersion: '1.0',
      loadedAt: this.#now().toISOString(),
      plugins: this.#plugins.map(pluginMetadata),
      pageStates: [...this.#pageStates],
      diagnostics: [...this.#diagnostics],
      warnings: [...this.#warnings],
    };
  }

  #baseContext(
    plugin: LoadedPlugin,
    config: ToolkitConfig,
    artifactRun: ArtifactRun | null,
    signal: AbortSignal,
  ): PluginBaseContext {
    return {
      pluginName: plugin.definition.name,
      config,
      artifactRun,
      state: this.#states.get(plugin.definition.name) ?? new Map<string, unknown>(),
      logger: createLogger(plugin.definition.name, this.#warnings),
      signal,
    };
  }

  async #runAsyncHook<Value>(
    plugin: LoadedPlugin,
    hookKind: PluginHookKind,
    hookId: string,
    callback: (context: PluginBaseContext) => Value | Promise<Value>,
    config: ToolkitConfig,
    artifactRun: ArtifactRun | null,
  ): Promise<Value | undefined> {
    const started = this.#now();
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(
            new PluginError(
              'PLUGIN_HOOK_TIMEOUT',
              `Plugin hook timed out: ${plugin.definition.name}/${hookId}`,
              {
                details: {
                  plugin: plugin.definition.name,
                  hookId,
                  hookKind,
                  timeoutMs: this.#options.timeoutMs,
                },
              },
            ),
          );
        }, this.#options.timeoutMs);
      });
      const result = await Promise.race([
        Promise.resolve(
          callback(this.#baseContext(plugin, config, artifactRun, controller.signal)),
        ),
        timeout,
      ]);
      this.#record(plugin, hookKind, hookId, 'passed', started, null);
      return result;
    } catch (error) {
      const status =
        error instanceof PluginError && error.code === 'PLUGIN_HOOK_TIMEOUT'
          ? 'timed-out'
          : 'failed';
      const message = describeError(error);
      this.#record(plugin, hookKind, hookId, status, started, message);
      if (this.#options.failureMode === 'fail-fast') {
        if (error instanceof PluginError) throw error;
        throw new PluginError(
          'PLUGIN_HOOK_FAILED',
          `Plugin hook failed: ${plugin.definition.name}/${hookId}`,
          {
            cause: error,
            details: { plugin: plugin.definition.name, hookId, hookKind },
          },
        );
      }
      this.#warnings.push(`[${plugin.definition.name}/${hookId}] ${message}`);
      return undefined;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  #runSyncHook<Value>(
    plugin: LoadedPlugin,
    hookKind: PluginHookKind,
    hookId: string,
    callback: () => Value,
    fallback: Value,
  ): Value {
    const started = this.#now();
    try {
      const result = callback();
      this.#record(plugin, hookKind, hookId, 'passed', started, null);
      return result;
    } catch (error) {
      const message = describeError(error);
      this.#record(plugin, hookKind, hookId, 'failed', started, message);
      if (this.#options.failureMode === 'fail-fast') {
        throw new PluginError(
          'PLUGIN_HOOK_FAILED',
          `Plugin hook failed: ${plugin.definition.name}/${hookId}`,
          {
            cause: error,
            details: { plugin: plugin.definition.name, hookId, hookKind },
          },
        );
      }
      this.#warnings.push(`[${plugin.definition.name}/${hookId}] ${message}`);
      return fallback;
    }
  }

  #record(
    plugin: LoadedPlugin,
    hookKind: PluginHookKind,
    hookId: string,
    status: PluginDiagnosticEvent['status'],
    started: Date,
    message: string | null,
  ): void {
    this.#diagnostics.push({
      plugin: plugin.definition.name,
      pluginVersion: plugin.definition.version ?? null,
      hookKind,
      hookId,
      status,
      startedAt: started.toISOString(),
      durationMs: Math.max(0, this.#now().getTime() - started.getTime()),
      message,
    });
  }
}
