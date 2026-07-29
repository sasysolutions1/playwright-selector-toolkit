# playwright-selector-toolkit
a toolkit for dom selector discovery 

Playwright Selector Toolkit discovers maintainable locator candidates for an
element you are already authorized to inspect, validates each candidate for
uniqueness and visibility, and returns the strongest locator that actually
works. It prefers user-facing accessibility contracts over generated CSS paths
and refuses to hide ambiguity behind `nth()` fallbacks.

## What it does

- Captures a compact DOM snapshot from a known seed selector.
- Ranks role/name, label, configured test id, placeholder, stable id/name, and
  exact-text candidates.
- Rejects UUID-like, framework-generated, and long numeric identifiers.
- Validates every candidate through Playwright for one visible match.
- Returns a copyable Playwright locator expression and an evidence report.
- Uses no runtime dependency beyond the Playwright instance supplied by the
  caller.

## Install from a checkout

```bash
npm install
npm test
```

Applications using the toolkit supply their own compatible Playwright version:

```bash
npm install @playwright/test
```

## Usage

```js
import { test, expect } from "@playwright/test";
import {
  discoverAndValidate,
} from "@sasysolutions1/playwright-selector-toolkit";

test("find a stable save control", async ({ page }) => {
  await page.goto("https://example.test/settings");

  // The seed selector is only the starting point for a page you may test.
  const report = await discoverAndValidate(
    page,
    "form.settings button[type=submit]",
  );

  expect(report.best).not.toBeNull();
  console.log(report.best.locator);
});
```

Run the complete example against an authorized target:

```bash
TARGET_URL=https://example.test \
TARGET_SELECTOR='button[type=submit]' \
node examples/discover-and-validate.mjs
```

Example result:

```json
{
  "kind": "role",
  "value": "button",
  "options": {
    "name": "Save changes",
    "exact": true
  },
  "locator": "page.getByRole(\"button\", {\"name\":\"Save changes\",\"exact\":true})",
  "count": 1,
  "unique": true,
  "visible": true,
  "valid": true
}
```

## Ranking policy

The default order is:

1. Accessible role plus exact accessible name.
2. Associated form label.
3. Explicit test id or test hook.
4. Placeholder.
5. Stable-looking id.
6. Stable-looking form name.
7. Exact visible text.

Validation is authoritative. A high-scoring candidate that matches zero,
matches more than one element, or is hidden is not selected.

Set `testIdAttribute` when the Playwright project has configured a different
test-id contract:

```js
const candidates = discoverSelectorCandidates(snapshot, {
  testIdAttribute: "data-qa",
});
```

## API

- `captureTargetSnapshot(page, selector)`
- `discoverSelectorCandidates(snapshot, options)`
- `validateSelectorCandidates(page, candidates, options)`
- `chooseBestCandidate(results)`
- `discoverAndValidate(page, selector, options)`
- `locatorFromCandidate(page, candidate)`
- `formatPlaywrightLocator(candidate)`
- `isLikelyGeneratedIdentifier(value)`

See [docs/safety.md](docs/safety.md) for the authorized-use and fail-closed
boundary.

## Release status

Version `0.1.0` is the first tested release candidate. The source contains no
credentials, target-site data, browser profiles, or recorded sessions. A
reviewed merge and `v0.1.0` tag are required before publishing the GitHub
release.

## 2026-07-28 23:39 MDT / 2026-07-29 05:39 UTC - Initial tested toolkit release candidate

### Outcome and reason

The previously documentation-only repository now contains a working,
dependency-light selector discovery and validation library. The update was
made so the public project has current examples, repeatable tests, and a
reviewable release path instead of an unsupported one-line description.

### Scope and user-visible impact

- Added the `0.1.0` public API, usage example, safety boundary, changelog,
  release checklist, and multi-version CI.
- Locator ranking favors accessible and explicit automation contracts and
  never silently chooses positional or long DOM-path selectors.
- Candidate validation reports uniqueness and visibility and returns `null`
  when no candidate is safe to use.

### Validation, source, backup, and remaining work

- Syntax checks and all unit tests passed locally without browser credentials
  or target-site data.
- The repository is the source of truth; there is no live service, production
  database, environment file, or Droplet deployment to back up.
- The GitHub review branch contains no credentials, personal data, session
  state, target-site content, or trade-secret implementation detail.

Review/merge, the `v0.1.0` tag, and GitHub Release publication remain required.
Real-project acceptance should use only an explicitly authorized test target.

## 2026-07-29 00:04 MDT / 2026-07-29 06:04 UTC - verified source archive

The exact tested candidate commit `aef65eacf885` was exported as a sanitized
ZIP archive. Local ZIP integrity and SHA-256 verification passed, and Google
Drive readback confirmed the 11,270-byte file in the existing unshared ASL
Site Backups folder.

The archive contains tracked source and documentation only. It excludes
credentials, browser profiles, session state, recorded traffic and target-site
data. GitHub remains the reviewed source of truth and Drive is the additional
source-archive backup. Review, merge, the `v0.1.0` tag, GitHub Release and
authorized-project acceptance remain open.
