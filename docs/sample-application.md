# Sample application

`examples/sample-app/` is an executable, local authenticated workflow. It demonstrates:

- a small HTTP application;
- plugin-driven authentication;
- page-state detection;
- application-specific redaction;
- custom `data-qa` locator generation;
- selector-manifest validation;
- locator recommendation generation;
- a portable HTML report.

Run:

```bash
npm run build
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:sample-app
```

When using Playwright-managed Chromium, omit `SELECTOR_EXECUTABLE_PATH` after running:

```bash
npx playwright install chromium
```

The smoke script loads the page directly into Chromium so it also runs in restricted CI environments. `server.mjs` is included for users who want to serve the same application locally. All temporary artifacts are removed when the workflow exits.
