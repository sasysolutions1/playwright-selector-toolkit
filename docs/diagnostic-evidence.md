# Diagnostic evidence bundles

Module 10 captures a self-contained, redaction-aware evidence package for a live Playwright page.
It is intended for selector failures, browser regressions, CI incidents, and unattended automation
where a screenshot alone is not enough to explain what happened.

## Capture evidence

```bash
selector evidence https://example.com/login
```

The command captures, by default:

- A full-page screenshot.
- A viewport screenshot.
- A Playwright trace containing screenshots, DOM snapshots, and sources.
- Sanitized HTML for the main page and child frames.
- A redacted DOM inventory.
- Page and browser metadata.
- Console messages and uncaught page errors.
- Failed network requests.
- HTTP responses with status 400 or greater.
- A JSON evidence manifest.
- A ZIP archive containing the complete artifact run.

All output is written under one timestamped artifact directory.

## Element screenshots

Repeat `--element` to capture focused screenshots in addition to the page screenshots:

```bash
selector evidence https://example.com/login \
  --element '#email' \
  --element 'button[type="submit"]'
```

Element selectors are CSS selectors in Module 10. Missing, hidden, or invalid element screenshots are
recorded as nonfatal failures in the manifest rather than aborting the rest of the bundle.

## Failure policies

Evidence capture succeeds by default even when the page logs errors. CI can promote selected events
to a command failure:

```bash
selector evidence https://example.com \
  --fail-on-page-error \
  --fail-on-request-failure \
  --fail-on-http-error
```

Exit codes:

- `0`: evidence captured and no enabled failure policy matched.
- `1`: navigation/operation failed or an enabled failure policy matched.
- `2`: invalid command or option.

The evidence archive is still created before exit code `1` is returned.

## Redaction

Redaction is enabled by default. The evidence collector:

- Removes URL query strings and fragments.
- Redacts email addresses, phone numbers, SSNs, payment-card patterns, API keys, tokens, and secrets.
- Omits input and textarea values from DOM and HTML snapshots.
- Omits scripts, inline event handlers, nonces, and known sensitive attributes from sanitized HTML.
- Limits retained event text to prevent uncontrolled artifact growth.

Disable redaction only in a controlled test environment:

```bash
selector evidence https://localhost:3000 --no-redact
```

## Output controls

```bash
selector evidence https://example.com \
  --wait-until networkidle \
  --wait-after 500 \
  --max-entries 500 \
  --max-element-screenshots 10 \
  --report-file reports/login-evidence.json \
  --archive-file reports/login-evidence.zip
```

Optional omissions:

```text
--no-full-page
--no-viewport
--no-trace
--no-console
--no-network
--no-dom-snapshot
--no-html-snapshot
--no-archive
```

## Library API

Capture an evidence bundle without a custom operation:

```ts
import { captureDiagnosticEvidence } from 'playwright-selector-toolkit';

const report = await captureDiagnosticEvidence(config, 'https://example.com', {
  elementScreenshots: [{ id: 'submit', selector: '#submit' }],
  failOnPageError: true,
});
```

Wrap a custom Playwright operation and retain evidence whether it passes or fails:

```ts
import { runWithDiagnosticEvidence } from 'playwright-selector-toolkit';

const execution = await runWithDiagnosticEvidence(
  config,
  'https://example.com/login',
  async (_session, page) => {
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByRole('button', { name: 'Sign in' }).click();
    return page.url();
  },
);
```

`withFailureEvidence` provides a throw-on-failure wrapper. Its `DiagnosticError.details` contains the
artifact directory, manifest path, and ZIP path so an unattended worker can alert an operator with
a direct reference to the evidence.

## Evidence manifest

`reports/diagnostic-evidence.json` is schema version `1.0`. It records:

- Requested and final URL.
- Navigation result.
- Page metadata.
- Event summaries and dropped-entry counts.
- Screenshot successes and failures.
- Paths to trace, DOM snapshot, sanitized HTML, and screenshots.
- Redacted failure name, message, and stack.
- Nonfatal capture warnings.

The ZIP is deterministic in scope rather than byte-for-byte reproducible: it contains every regular
file in the artifact run except the ZIP itself.
