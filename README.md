# Playwright Selector Toolkit

An open-source TypeScript toolkit for discovering, validating, comparing, and reporting on
resilient Playwright selectors.

> **Module 18 status:** the toolkit now includes append-only selector-health history, availability and
> recovery metrics, daily trends, retention pruning, and portable trend dashboards in addition to
> scheduled monitoring, selector discovery, validation, repair, diagnostics, and release hardening.

## Requirements

- Node.js 22.14 or newer
- npm 10 or newer for development
- npm 11.5.1 or newer in trusted-publishing workflows

## Documentation and executable integrations

Start with the [documentation index](docs/index.md) or the [getting-started guide](docs/getting-started.md).

Run the complete authenticated sample application after building:

```bash
npm run build
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:sample-app
```

The sample authenticates through a plugin, validates a selector manifest, generates locator
recommendations, applies application-specific redaction, and renders a portable HTML report.
Reusable GitHub Actions templates are under `examples/ci/`. The safe Outside Access integration
example is documented in [docs/outside-access-integration.md](docs/outside-access-integration.md).

## Compatibility, security, and publishing

```bash
npm run build
selector compatibility
selector security audit
npm run release:check
```

The release review builds two npm tarballs and requires identical SHA-256 digests, installs the
package into a clean temporary project, imports the public API, executes the installed CLI, and
generates CycloneDX and SPDX SBOMs. See [compatibility](docs/compatibility.md),
[security review](docs/security-review.md), and [publishing](docs/publishing.md).

## Scheduled selector-health monitoring

```bash
selector monitor run examples/monitoring/monitor.yaml --fail-on-unhealthy
selector monitor watch examples/monitoring/monitor.yaml
selector monitor status examples/monitoring/monitor.yaml
selector monitor history examples/monitoring/monitor.yaml --since 30d
```

Monitoring reuses selector manifests, stores incident state atomically, suppresses duplicate alerts,
escalates warning/high/critical incidents, sends recovery notices, and records privacy-bounded
history for pass-rate, availability, MTTR, MTBF, outage, and latency reporting. See
[scheduled monitoring](docs/monitoring.md) and [historical trends](docs/monitoring-history.md).

## Portable and interactive HTML reports

Combine discovery, locator, validation, comparison, and diagnostic outputs into one self-contained browser-viewable file:

```bash
selector report .selector-artifacts/my-run --title "Selector health report"
```

The report embeds eligible diagnostic screenshots, escapes untrusted text, includes responsive and print-friendly layouts, and loads no external scripts or stylesheets. See [docs/html-reports.md](docs/html-reports.md).

## Install for development

```bash
git clone https://github.com/sasysolutions1/playwright-selector-toolkit.git
cd playwright-selector-toolkit
npm install
npm run build
```

Install Chromium before browser-based modules are used or when `doctor --strict` must verify a
browser executable:

```bash
npx playwright install chromium
```

## CLI

```bash
npm run dev -- --help
npm run dev -- version
npm run dev -- config
npm run dev -- doctor
npm run dev -- compatibility
npm run dev -- security audit
npm run dev -- artifacts init --name first-run
npm run dev -- browser inspect https://example.com
npm run dev -- discover https://example.com
npm run dev -- locators https://example.com
npm run dev -- validate examples/validation/selector-manifest.yaml https://example.com
npm run dev -- snapshot https://example.com
npm run dev -- baseline save homepage https://example.com
npm run dev -- compare homepage https://example.com
npm run dev -- evidence https://example.com --element '#submit'
npm run dev -- --plugin ./examples/plugins/demo-plugin.mjs plugins inspect
npm run dev -- monitor run examples/monitoring/monitor.yaml --fail-on-unhealthy
```

After building and linking locally:

```bash
npm link
selector --help
```

### Shared options

All browser-oriented commands inherit the same configuration flags:

```text
-c, --config <path>
--cwd <path>
--artifacts-dir <path>
--browser <chromium|firefox|webkit>
--headless
--headed
--timeout <milliseconds>
--navigation-timeout <milliseconds>
--viewport <WIDTHxHEIGHT>
--trace <off|on|retain-on-failure>
--screenshots <off|always|on-failure>
--base-url <url>
--user-data-dir <path>
--executable-path <path>
--storage-state <path>
--plugin <specifier> (repeatable)
--plugin-timeout <milliseconds>
--plugin-failure-mode <isolate|fail-fast>
--json
```

Precedence is deterministic:

```text
built-in defaults < discovered config file < environment variables < CLI options
```

### `selector config`

Prints the effective configuration and where each override came from:

```bash
selector config
selector config --json
selector --config ./selector.config.yaml config
selector --browser firefox --headed config
```

### Configuration files

The toolkit walks from the current directory to the filesystem root looking for the first of:

```text
selector.config.json
selector.config.yaml
selector.config.yml
.selectorrc.json
.selectorrc.yaml
.selectorrc.yml
```

Example `selector.config.yaml`:

```yaml
artifactsDir: ./.selector-artifacts
browser: chromium
headless: true
timeoutMs: 30000
navigationTimeoutMs: 45000
viewport:
  width: 1440
  height: 900
trace: retain-on-failure
screenshots: on-failure
baseUrl: https://example.com
userDataDir: ./.browser-profile
storageStatePath: ./.auth/storage-state.json
# executablePath: /usr/bin/chromium
plugins:
  - ./plugins/application-auth.mjs
pluginTimeoutMs: 10000
pluginFailureMode: isolate
```

Paths in a config file are resolved relative to that file. Paths supplied through environment
variables or CLI options are resolved relative to `--cwd` or the current directory.

Environment variables:

```text
SELECTOR_ARTIFACTS_DIR
SELECTOR_BROWSER
SELECTOR_HEADLESS
SELECTOR_TIMEOUT_MS
SELECTOR_NAVIGATION_TIMEOUT_MS
SELECTOR_VIEWPORT_WIDTH
SELECTOR_VIEWPORT_HEIGHT
SELECTOR_TRACE
SELECTOR_SCREENSHOTS
SELECTOR_BASE_URL
SELECTOR_USER_DATA_DIR
SELECTOR_STORAGE_STATE_PATH
SELECTOR_EXECUTABLE_PATH
SELECTOR_PLUGINS
SELECTOR_PLUGIN_TIMEOUT_MS
SELECTOR_PLUGIN_FAILURE_MODE
```

See [`docs/configuration.md`](docs/configuration.md).

## Plugins

Load trusted ESM extensions for authentication, page-state detection, application-specific redaction,
and custom locator conventions:

```bash
selector --plugin ./plugins/application-auth.mjs plugins inspect
selector --plugin ./plugins/application-auth.mjs locators https://example.com
```

Configured plugins run automatically in managed browser sessions. Hook diagnostics are written to
`reports/plugins.json`. Plugin code is not sandboxed; load only trusted modules. See
[`docs/plugins.md`](docs/plugins.md).

### `selector doctor`

Checks:

- Supported Node.js version
- Current platform and architecture
- Playwright package availability
- Chromium executable availability
- Working-directory access
- Artifact-directory creation and write access

```bash
selector doctor
selector doctor --json
selector doctor --strict
selector --artifacts-dir ./diagnostics doctor
```

A missing browser is a warning in normal mode and a failure in strict mode.

### `selector artifacts init`

Creates a timestamped, collision-resistant run directory:

```bash
selector artifacts init
selector artifacts init --name login-page
selector --artifacts-dir ./output artifacts init --name ci-validation
```

Each run contains:

```text
run.json
screenshots/
snapshots/
traces/
reports/
```

Artifact paths are constrained to the current run directory to prevent path traversal. See
[`docs/artifacts.md`](docs/artifacts.md).

### `selector discover`

Crawls the main document, child frames, and open shadow roots and writes a redacted JSON element
inventory:

```bash
selector discover https://example.com
selector --headed --trace on discover https://example.com --name homepage
selector discover https://example.com --all-elements --include-hidden
selector discover https://example.com --max-elements 1000 --max-frame-depth 6
selector discover https://example.com --snapshot-file snapshots/login.json --json
```

Interactive elements are recorded by default. Hidden elements are omitted unless requested. Form
control values are never captured. Common sensitive text is redacted, and URL query strings and
fragments are removed unless `--no-redact` is explicitly supplied. See
[`docs/dom-crawler.md`](docs/dom-crawler.md).

### `selector locators`

Generates Playwright role, label, placeholder, test-ID, text, attribute, CSS, and XPath candidates
for every crawled element, then tests their live match counts before closing the page:

```bash
selector locators https://example.com
selector locators https://example.com --max-candidates 8 --no-xpath
selector locators https://example.com --no-live-test
selector locators https://example.com --candidate-file reports/login.json --json
selector locators https://example.com --minimum-score 65
```

The report records whether each candidate is unique, ambiguous, missing, or errored, plus visible
and enabled match counts. Module 6 also assigns a 0–100 stability score, high/medium/low
confidence, detailed scoring signals, and one recommended locator per element when a candidate meets
the configured threshold. See [`docs/locator-candidates.md`](docs/locator-candidates.md) and
[`docs/locator-stability.md`](docs/locator-stability.md).

### `selector validate`

Validates required and optional selectors from a JSON or YAML manifest and returns CI-safe exit
codes:

```bash
selector validate selectors/login.yaml
selector validate selectors/login.yaml https://staging.example.com
selector validate selectors/login.yaml --report-file reports/login.json --json
```

Manifests support exact or ranged counts plus `any`, `all`, and `none` assertions for visibility,
enabled state, and editability. Optional failures are reported without failing the command. See
[`docs/selector-validation.md`](docs/selector-validation.md).

### `selector repair`

Generate review-only replacements for selectors that fail validation:

```bash
selector repair selectors/login.yaml https://example.com/login
```

Optional AI ranking is disabled by default and cannot invent selectors:

```bash
OPENAI_API_KEY=... selector repair selectors/login.yaml \
  https://example.com/login --provider openai
```

The command writes a JSON evidence report and a YAML proposal. It never edits the source manifest, and every proposal requires human review and validation. See [selector repair suggestions](docs/selector-repair.md).

### `selector snapshot` and baselines

Captures sanitized HTML for each frame, a redacted DOM inventory, and semantic/structural element
fingerprints:

```bash
selector snapshot https://example.com
selector snapshot https://example.com --all-elements --max-frame-depth 6
selector baseline save login-page https://example.com/login
selector baseline list
selector baseline show login-page
```

Baseline versions are immutable and retained under `.selector-artifacts/baselines`. Input values,
passwords, scripts, inline handlers, and URL query secrets are excluded from sanitized HTML. See
[`docs/snapshots-and-baselines.md`](docs/snapshots-and-baselines.md).

### `selector compare`

Compares a saved baseline to a live page and detects added, removed, moved, changed, and
moved-and-changed elements:

```bash
selector compare login-page https://example.com/login
selector compare login-page https://example.com/login --fail-on-drift
selector compare login-page --baseline-version 2026-07-18T00-00-00-000Z-12345678
```

Reports include field-level drift and ranked replacement locators. See
[`docs/dom-comparison.md`](docs/dom-comparison.md).

### `selector evidence`

Captures a redacted diagnostic package containing screenshots, a Playwright trace, sanitized HTML,
DOM inventory, metadata, console and page errors, failed requests, and HTTP error responses:

```bash
selector evidence https://example.com/login
selector evidence https://example.com/login --element '#email' --element 'button[type="submit"]'
selector evidence https://example.com/login --fail-on-page-error --fail-on-http-error
```

The evidence is written as a JSON manifest and ZIP archive before any enabled failure policy returns
exit code 1. See [`docs/diagnostic-evidence.md`](docs/diagnostic-evidence.md).

### `selector browser inspect`

Launches a managed Playwright session, navigates to one URL, and closes it cleanly:

```bash
selector browser inspect https://example.com
selector --headed --trace on browser inspect https://example.com --name homepage
selector --user-data-dir ./.browser-profile browser inspect https://example.com
selector --storage-state ./.auth/state.json browser inspect https://example.com --json
selector --executable-path /usr/bin/chromium browser inspect about:blank
```

Without `userDataDir`, the context is ephemeral. With `userDataDir`, a persistent context is
protected by an exclusive profile lock. Storage state is loaded when present and saved during
shutdown. See [`docs/browser-sessions.md`](docs/browser-sessions.md).

## Library API

```ts
import {
  createArtifactRun,
  analyzeLocators,
  discoverDom,
  generateLocatorCandidates,
  rankLocatorCandidates,
  runSelectorValidation,
  validateManifestSelectors,
  openBrowserSession,
  registerGracefulShutdown,
  resolveToolkitConfig,
  runDoctor,
  ToolkitError,
} from 'playwright-selector-toolkit';

const resolved = await resolveToolkitConfig({ cwd: process.cwd() });
const run = await createArtifactRun(resolved.config, {
  command: 'custom-check',
  name: 'login-page',
});

console.log(run.directories.reports);

const discovery = await discoverDom(resolved.config, 'https://example.com');
console.log(discovery.snapshotPath);

const session = await openBrowserSession(resolved.config, { name: 'example' });
const unregister = registerGracefulShutdown(session);
try {
  console.log(await session.navigate('https://example.com'));
} finally {
  unregister();
  await session.close({ success: true });
}
```

## Development

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm run check
npm run pack:check
```

## Roadmap

1. Project foundation and environment doctor — **complete**
2. Shared configuration, structured errors, and artifacts — **complete**
3. Browser and persistent-session manager — **complete**
4. DOM crawler — **complete**
5. Locator candidate extraction — **complete**
6. Locator stability ranking — **complete**
7. Selector validation
8. Snapshot and DOM comparison engine
9. Screenshot and trace capture
10. HTML and JSON reports
11. CI integrations and reusable plugin API

See [`docs/roadmap.md`](docs/roadmap.md) for the full module plan.

## Security and scope

This project is intended for authorized browser automation and testing. It does not bypass
authentication, CAPTCHA, MFA, access controls, robots policies, or private content restrictions.
Users are responsible for complying with website terms and applicable law.

## License

MIT — see [`LICENSE`](LICENSE).

## Compare a baseline with a live page

```bash
selector compare login-page https://example.com/login
```

The comparison report classifies added, removed, moved, changed, and moved-and-changed elements and includes ranked replacement locator suggestions. Use `--fail-on-drift` for CI. See [DOM comparison](docs/dom-comparison.md).

## Interactive report dashboard

```bash
selector report .selector-artifacts/my-run --title "Selector health dashboard"
```

The generated single-file report supports offline search, issue-only filtering, dynamic facets, metric drill-down, sorting, collapsible sections, themes, CSV export, printing, and screenshot lightboxes. Use `--no-interactive` to generate a static no-script report.
