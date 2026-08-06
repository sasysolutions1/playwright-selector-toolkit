# Plugin API

Module 13 adds a typed, ordered, failure-isolated extension API. Plugins are ordinary trusted ESM
modules loaded into the selector-toolkit Node.js process. A plugin can provide authentication hooks,
page-state detectors, structured DOM redactors, and custom locator-candidate generators.

> Plugins execute with the same operating-system permissions as the CLI. Load only code you trust.
> The toolkit does not sandbox plugin JavaScript.

## Configure plugins

Configuration-file paths are resolved relative to the configuration file. Package names are imported
through normal Node.js ESM resolution.

```yaml
plugins:
  - ./plugins/application-auth.mjs
  - '@company/selector-conventions'
pluginTimeoutMs: 10000
pluginFailureMode: isolate
```

Equivalent environment variables:

```text
SELECTOR_PLUGINS=./plugins/application-auth.mjs,@company/selector-conventions
SELECTOR_PLUGIN_TIMEOUT_MS=10000
SELECTOR_PLUGIN_FAILURE_MODE=isolate
```

Equivalent CLI flags:

```bash
selector \
  --plugin ./plugins/application-auth.mjs \
  --plugin @company/selector-conventions \
  --plugin-timeout 10000 \
  --plugin-failure-mode isolate \
  plugins inspect
```

`isolate` records hook failures and continues with remaining plugins. `fail-fast` throws a structured
plugin error immediately. Authentication, setup, teardown, and page-state hooks use the configured
timeout. Synchronous redactors and locator generators are isolated but cannot be interrupted while
executing, so they should remain deterministic and fast.

## Plugin definition

```js
export default {
  apiVersion: '1',
  name: 'application-workflow',
  version: '1.0.0',
  description: 'Application-specific selector conventions.',
  order: 10,

  authentication: [
    {
      id: 'login',
      order: 10,
      async run({ page, state, logger, signal }) {
        if (signal.aborted) return;
        const login = page.locator('#login-form:visible');
        if ((await login.count()) === 0) return { handled: false };
        await page.getByLabel('Username').fill(process.env.APP_USER ?? '');
        await page.getByLabel('Password').fill(process.env.APP_PASSWORD ?? '');
        await page.getByRole('button', { name: 'Sign in' }).click();
        state.set('authenticatedAt', new Date().toISOString());
        logger.info('Authentication completed');
        return { handled: true, authenticated: true };
      },
    },
  ],

  pageStateDetectors: [
    {
      id: 'dashboard',
      async detect({ page }) {
        return (await page.locator('[data-page="dashboard"]:visible').count()) === 1
          ? { id: 'dashboard', label: 'Dashboard', confidence: 1 }
          : false;
      },
    },
  ],

  redactors: [
    {
      id: 'account-identifiers',
      redactText(value) {
        return value.replace(/ACCOUNT-\d+/gu, '[PLUGIN_ACCOUNT]');
      },
      sanitizeUrl(value) {
        return value.replace(/tenant=[^&]+/gu, 'tenant=[PLUGIN]');
      },
    },
  ],

  locatorCandidateGenerators: [
    {
      id: 'data-qa',
      generate(element) {
        const value = element.attributes['data-qa'];
        return value === undefined
          ? []
          : [
              {
                spec: { type: 'css', selector: `[data-qa="${value}"]` },
                priority: 8,
                rationale: 'Uses the application data-qa convention.',
              },
            ];
      },
    },
  ],
};
```

TypeScript plugins can import `definePlugin` and the exported plugin types from the package.

```ts
import { definePlugin, type SelectorToolkitPlugin } from 'playwright-selector-toolkit';

const plugin: SelectorToolkitPlugin = definePlugin({
  apiVersion: '1',
  name: 'typed-example',
});

export default plugin;
```

## Hook lifecycle

For each browser session:

1. Plugin modules are loaded in configured order.
2. `setup` runs once per plugin.
3. Browser navigation completes.
4. Authentication hooks run in plugin order and hook order.
5. Page-state detectors run after authentication.
6. DOM redactors process captured structured DOM fields and safe attributes.
7. Locator generators add candidates before live evaluation and stability ranking.
8. `teardown` runs in reverse plugin order.
9. `reports/plugins.json` is written into the artifact run.

The plugin report contains plugin metadata, page-state matches, hook status, duration, timeout/failure
information, and warnings. It never records form values automatically.

## Authentication hooks

Authentication hooks receive the live Playwright `Page`, resolved toolkit config, artifact run,
per-plugin state map, logger, requested URL, and an abort signal. They should:

- Check whether authentication is actually needed.
- Use resilient Playwright locators.
- Avoid logging credentials or tokens.
- Return quickly when the page is already authenticated.
- Observe the abort signal for long-running custom work.

The toolkit does not bypass CAPTCHA, MFA, anti-automation controls, or access restrictions.

## Page-state detectors

Detectors return `false`/`null` when they do not match or a state record when they do:

```js
{ id: 'account-locked', label: 'Account locked', confidence: 0.98 }
```

Confidence is normalized to `0..1`. Matches are included in browser navigation results and the
plugin diagnostic report.

## Redaction plugins

Redactors extend the built-in redaction layer for structured DOM inventory fields and allowed
attribute values. A redactor receives the field name, element ID, and frame path. It does not receive
input values because the crawler omits them before plugins run.

Redactors should return replacement text and must never add secrets back into a snapshot. Sanitized
HTML uses the toolkit's built-in serializer; custom plugin redaction currently applies to structured
DOM snapshots and locator inputs.

## Locator generators

Custom generators return normal locator specifications, so plugin candidates use the existing
serializer, live evaluator, stability ranking, reports, and DOM-comparison replacement logic.
Supported specification types are role, label, placeholder, text, test ID, attribute, CSS, and XPath.

Each generated candidate records `sourcePlugin` and `sourceHook`. A zero-adjustment
`plugin-generated` scoring signal appears in stability reports so the origin remains explainable.

## Inspect plugins

```bash
selector plugins inspect
selector plugins inspect --json
```

The command imports and validates configured plugins, runs setup and teardown, and prints metadata and
hook counts without opening a browser.

## Example

See [`examples/plugins/demo-plugin.mjs`](../examples/plugins/demo-plugin.mjs) and the real Chromium
smoke test in [`examples/plugins/smoke.mjs`](../examples/plugins/smoke.mjs).
