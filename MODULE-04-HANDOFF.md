# Module 4 Handoff — DOM Crawler and Interactive-Element Inventory

Version: `0.4.0`

## What changed

- Added `selector discover`.
- Added a versioned, redaction-aware DOM snapshot schema.
- Added recursive Playwright frame traversal and open shadow-root traversal.
- Added visibility, viewport, geometry, state, accessibility, and interactivity metadata.
- Added default protection against sensitive text and URL query leakage.
- Added hard global element and frame-depth limits.
- Added safe partial results for child-frame failures and fatal handling for main-frame failures.
- Added library APIs, examples, documentation, and browser smoke coverage.

## Validation target

```text
Formatting
ESLint
Strict TypeScript
44+ unit tests
Production build
npm package dry run
Real Chromium DOM crawl
Child iframe discovery
Open shadow-root discovery
Sensitive-text redaction
Input-value omission
URL query stripping
Clean ZIP extraction
```

## Suggested commit

```bash
git add -A
git commit -m "Add redaction-aware DOM discovery"
git push
```

## Next module

Module 5 generates Playwright locator candidates from each element snapshot, including role, label,
placeholder, text, test ID, stable attributes, CSS, and XPath fallbacks with uniqueness checks.
