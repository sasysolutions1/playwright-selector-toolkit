# DOM crawler and interactive-element inventory

Module 4 adds a redaction-aware DOM crawler that runs inside managed Playwright sessions.
It inventories interactive elements by default and writes a versioned JSON snapshot under the
current artifact run.

## Quick start

```bash
selector discover https://example.com
selector --headed --trace on discover https://example.com --name homepage
selector discover https://example.com --all-elements --include-hidden
selector discover https://example.com --max-elements 1000 --max-frame-depth 6
selector discover https://example.com --snapshot-file snapshots/login.json --json
```

A URL may be omitted when `baseUrl` is configured:

```bash
selector --base-url https://example.com discover
```

## Default behavior

The default crawl is intentionally conservative:

- records interactive elements only;
- omits hidden elements;
- traverses the main document, child iframes, and open shadow roots;
- records no form-control values;
- redacts common email, phone, SSN, payment-card, token, and secret patterns;
- removes URL query strings and fragments from captured `href` and `src` attributes;
- stops after 5,000 recorded elements or eight child-frame levels;
- stores at most 240 characters for each text field.

## Discovery options

```text
--all-elements                 Record every eligible DOM element
--include-hidden               Include elements classified as hidden
--max-elements <count>         Global recorded-element limit (default 5000)
--max-frame-depth <count>      Child-frame depth limit (default 8)
--text-limit <count>           Maximum characters per text field (default 240)
--no-redact                    Disable text and URL redaction
--snapshot-file <path>         JSON path relative to the artifact run
--wait-until <state>           load, domcontentloaded, networkidle, or commit
--name <name>                  Human-readable artifact-run name
```

`--no-redact` should only be used with test data or an explicitly approved diagnostic workflow.
Input and textarea values are never captured, even when redaction is disabled.

## What is recorded

Each element record contains:

- frame path and open-shadow-root path;
- redacted structural DOM path;
- tag, coarse element kind, role, and accessible-name approximation;
- visible text, associated label, and placeholder when present;
- a safe attribute allowlist, including ARIA attributes and common test IDs;
- visibility reason, viewport intersection, and bounding box;
- interactivity sources, such as native control, role, tabindex, or inline handler;
- disabled, readonly, required, checked, and selected state;
- a sensitive-field marker and redaction count.

The crawler does not inspect JavaScript closure state, browser password stores, network request
bodies, closed shadow roots, private browser data, or values typed into controls.

## Visibility classification

An element can be classified as hidden for one of these reasons:

```text
hidden-attribute
aria-hidden
display-none
visibility-hidden
opacity-zero
zero-area
detached
```

Off-screen elements can remain `visible: true` while `inViewport` is false. This distinction is
important for virtualized pages and pages requiring scrolling.

## Frames and shadow DOM

Every Playwright child frame is crawled independently. Cross-origin frames are supported when
Playwright can evaluate in the frame. A child-frame failure is recorded without discarding
successful frames. A main-document failure stops discovery with `DOM_CRAWL_FAILED`.

Open shadow roots are traversed recursively and recorded in `shadowPath`. Closed shadow roots are
not accessible through standard browser APIs and are intentionally not bypassed.

## Snapshot schema

The snapshot is written to `snapshots/dom-snapshot.json` by default and begins with:

```json
{
  "schemaVersion": "1.0",
  "toolkitVersion": "0.4.0",
  "capturedAt": "2026-07-18T00:00:00.000Z",
  "requestedUrl": "https://example.com",
  "finalUrl": "https://example.com/",
  "options": {},
  "summary": {},
  "frames": [],
  "failures": [],
  "warnings": []
}
```

The schema is designed to become the input for Module 5 locator candidate extraction and later
baseline comparison modules.

## Library use

```ts
import {
  crawlDomSnapshot,
  discoverDom,
  openBrowserSession,
  resolveToolkitConfig,
} from 'playwright-selector-toolkit';

const resolved = await resolveToolkitConfig({ cwd: process.cwd() });

const report = await discoverDom(resolved.config, 'https://example.com', {
  scope: 'interactive',
  maxElements: 1000,
  redact: true,
});
console.log(report.snapshotPath);

const session = await openBrowserSession(resolved.config, { command: 'custom-crawl' });
try {
  await session.page.setContent('<button id="save">Save</button>');
  const snapshot = await crawlDomSnapshot(session.page, 'about:blank#fixture');
  console.log(snapshot.summary);
} finally {
  await session.close({ success: true });
}
```

## Security notes

DOM snapshots can still reveal page structure, account names, facility names, or other contextual
information even after pattern redaction. Treat artifact directories as sensitive operational data,
restrict filesystem permissions, and apply retention limits appropriate to the site being tested.
