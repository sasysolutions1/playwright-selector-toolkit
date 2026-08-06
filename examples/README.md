# Examples

## Configuration

Copy either example into a project root and run `selector config`:

- `selector.config.json`
- `selector.config.yaml`

## DOM discovery fixture

`dom/discovery-fixture.html` contains:

- visible and hidden controls;
- an open shadow root;
- a child iframe;
- sensitive text and input values;
- a URL with query data.

After building, run the real-browser smoke test:

```bash
npm run build
npm run smoke:dom
```

When using a system browser instead of a Playwright-managed browser:

```bash
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:dom
```

## Locator candidate fixture

`locators/locator-fixture.html` contains unique and duplicate text, labels, test IDs, an open shadow
root, and a child frame. The smoke test also verifies stability ranking and recommendation output. Run:

```bash
npm run build
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:locators
```

## Selector validation

`validation/selector-manifest.yaml` demonstrates required and optional selectors, exact and ranged
count checks, state assertions, and a named child frame. Run the Chromium smoke test after building:

```bash
npm run build
npm run smoke:validation
```

## Snapshot and baseline fixture

`snapshots/snapshot-fixture.html` contains form values, script content, URL query data, an open
shadow root, and a child iframe. The smoke test proves that sanitized HTML omits secrets and that a
versioned baseline can be saved:

```bash
npm run build
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:snapshot
```

## DOM comparison

```bash
npm run build
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:comparison
```

The comparison fixture captures two live DOM states in Chromium and verifies added, removed, moved, changed, and replacement-locator behavior.

## Portable report

Run `npm run smoke:report` after building to generate and open-test a self-contained report.

- `report/dashboard-smoke.mjs` validates offline report filters, sorting, collapsing, theme controls, and issue-only behavior in Chromium.

## Plugin example

`plugins/demo-plugin.mjs` demonstrates authentication, a page-state detector, account-identifier
redaction, and a custom `data-qa` locator generator. Run after building:

```bash
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:plugins
```

## Authenticated sample application

`sample-app/` is a complete local workflow with a login screen, plugin authentication, page-state
detection, selector validation, locator recommendations, redaction, and HTML reporting.

```bash
npm run build
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:sample-app
```

## CI templates

`ci/` contains a GitHub Actions workflow, CI configuration, and example selector manifest.

## Outside Access integration

`outside-access/` contains a safe integration plugin, configuration, selector template, and health
check wrapper. It intentionally contains no live Securus selectors or credentials.

## Scheduled health monitoring

`monitoring/monitor.yaml` demonstrates per-target intervals, warning/high/critical escalation,
SendGrid email, Twilio SMS and voice environment-variable configuration, duplicate suppression, and
recovery notices. The smoke workflow uses real Chromium validation and exercises the complete
healthy → warning → high → critical → suppressed → recovered lifecycle.

```bash
npm run build
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:monitoring
```
