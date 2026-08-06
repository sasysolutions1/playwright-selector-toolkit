# Plugin author tutorial

Plugins are trusted ESM modules. They run with the same operating-system permissions as the toolkit.
Do not load unreviewed plugins.

## 1. Create a plugin

Create `plugins/application.mjs`:

```js
export default {
  apiVersion: '1',
  name: 'application-workflow',
  version: '1.0.0',

  authentication: [
    {
      id: 'login',
      async run({ page }) {
        const login = page.locator('form[data-login]:visible');
        if ((await login.count()) === 0) return { handled: false };

        const username = process.env.APP_USERNAME;
        const password = process.env.APP_PASSWORD;
        if (!username || !password) {
          throw new Error('APP_USERNAME and APP_PASSWORD are required');
        }

        await page.getByLabel('Username').fill(username);
        await page.getByLabel('Password').fill(password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
        return { handled: true, authenticated: true };
      },
    },
  ],
};
```

## 2. Load the plugin

```bash
selector --plugin ./plugins/application.mjs plugins inspect
selector --plugin ./plugins/application.mjs discover https://example.com/dashboard
```

Or configure it:

```yaml
plugins:
  - ./plugins/application.mjs
pluginTimeoutMs: 10000
pluginFailureMode: fail-fast
```

## 3. Detect page states

```js
pageStateDetectors: [
  {
    id: 'dashboard',
    async detect({ page }) {
      return (await page.getByRole('heading', { name: 'Dashboard' }).count()) === 1
        ? { id: 'dashboard', label: 'Dashboard', confidence: 1 }
        : false;
    },
  },
],
```

Page states are included in navigation and plugin diagnostics.

## 4. Extend redaction

```js
redactors: [
  {
    id: 'customer-identifiers',
    redactText(value) {
      return value.replace(/CUSTOMER-\d+/gu, '[CUSTOMER]');
    },
  },
],
```

Redaction hooks supplement the toolkit's built-in secret, email, phone, payment-card, and token redaction.

## 5. Add locator conventions

```js
locatorCandidateGenerators: [
  {
    id: 'data-qa',
    generate(element) {
      const value = element.attributes['data-qa'];
      return value
        ? [{
            spec: { type: 'css', selector: `[data-qa="${value}"]` },
            priority: 8,
            rationale: 'Uses the application data-qa convention.',
          }]
        : [];
    },
  },
],
```

## 6. Inspect diagnostics

Each managed browser run writes `reports/plugins.json` when plugins are loaded. It records hook status,
duration, warnings, page states, and failures without recording plugin credentials.

## 7. Test the plugin

The executable example in `examples/sample-app/` demonstrates authentication, state detection,
redaction, custom candidates, validation, and HTML reporting. Run:

```bash
npm run build
npm run smoke:sample-app
```
