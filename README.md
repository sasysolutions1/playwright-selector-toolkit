# playwright-selector-toolkit
a toolkit for dom selector discovery 

Playwright Selector Toolkit discovers maintainable locator candidates for an
element you are already authorized to inspect, validates each candidate for
uniqueness and visibility, and returns the strongest locator that actually
works. It prefers user-facing accessibility contracts over generated CSS paths
and refuses to hide ambiguity behind `nth()` fallbacks.

## Where the toolkit lives

**`main` is the source of truth.** It holds the complete toolkit — selector
engine, automated tests, usage example, safety documentation, CI workflow,
changelog, and release checklist. Clone `main` and use it.

There is no separate implementation branch. Earlier revisions of this README
directed readers to `agent/initial-tested-toolkit-20260729` and described `main`
as a placeholder; that was accurate only before
[pull request #1](https://github.com/sasysolutions1/playwright-selector-toolkit/pull/1)
merged on 2026-08-01, and the sentence was carried onto `main` by the merge
itself. It has been wrong ever since. `main` is strictly ahead of every other
branch in the repository.

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

## Targets inside an iframe

Payment fields, embedded editors, and third-party widgets usually live in an
iframe, where a plain page-level locator cannot reach them. Pass `frame` with
the iframe selector, or an array of selectors to traverse nested frames. The
same root is used for both snapshot capture and validation:

```js
const report = await discoverAndValidate(page, "input[name=cardnumber]", {
  frame: 'iframe[title="Secure card input"]',
});

const nested = await discoverAndValidate(page, "button[type=submit]", {
  frame: ["#outer-frame", "#inner-frame"],
});
```

## Accessible name and role resolution

Implicit ARIA roles are resolved for common elements rather than assumed, so
the strongest role-based candidate is still produced for a `select`
(`combobox`, or `listbox` when multiple or sized), a table, a heading, a list,
a landmark, and typed inputs such as `number` (`spinbutton`) or `search`
(`searchbox`). An explicit `role` attribute always wins.

The accessible name follows `aria-labelledby`, then `aria-label`, then an
associated label, then `alt`, then `title`, then the element's text.

## API

- `captureTargetSnapshot(page, selector, options)`
- `discoverSelectorCandidates(snapshot, options)`
- `validateSelectorCandidates(page, candidates, options)`
- `chooseBestCandidate(results)`
- `discoverAndValidate(page, selector, options)`
- `locatorFromCandidate(root, candidate)`
- `formatPlaywrightLocator(candidate)`
- `isLikelyGeneratedIdentifier(value)`
- `resolveSearchRoot(page, options)`

`options.timeout` defaults to 5000ms for the visibility check.

See [docs/safety.md](docs/safety.md) for the authorized-use and fail-closed
boundary.

## Release status

Version `0.1.0` is the first tested release. The source contains no
credentials, target-site data, browser profiles, or recorded sessions.

Verified on `main` 2026-08-06: `npm test` — **11 passing, 0 failing**, covering
candidate ranking, generated-identifier rejection, locator construction,
uniqueness/visibility validation, ambiguity refusal, frame-root resolution
(single and nested), and `aria-labelledby` name computation. CI runs the suite
on every push.

Remaining work: the `v0.1.0` tag and GitHub Release publication are still open.
This repository is a library — there is no deployed instance and no runtime
state, so no provenance stamp or backup applies to it.

See [CHANGELOG.md](CHANGELOG.md) for the release history.
