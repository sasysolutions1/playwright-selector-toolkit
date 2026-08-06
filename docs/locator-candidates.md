# Locator candidate generation and live uniqueness testing

Module 5 turns each DOM snapshot element into a set of Playwright locator candidates and can test
those candidates against the live page before the browser session closes.

## CLI

```bash
selector locators https://example.com
selector locators https://example.com --max-candidates 8
selector locators https://example.com --no-xpath
selector locators https://example.com --no-live-test
selector locators https://example.com --candidate-file reports/login-candidates.json
```

The command writes both the DOM snapshot and a locator report to the same artifact run.

## Candidate strategies

The generator emits, when supported by captured metadata:

- `getByRole()` with an exact accessible name;
- `getByLabel()`;
- `getByPlaceholder()`;
- `getByTestId()` and custom `data-*` test hooks;
- exact `getByText()`;
- stable tag-and-attribute CSS selectors;
- id and structural CSS selectors;
- XPath id and structural fallbacks outside shadow DOM.

Candidates containing redaction markers are omitted because the redacted value cannot match the
live page. XPath candidates are omitted for elements inside shadow DOM because XPath does not pierce
shadow roots.

## Live evaluation

Each candidate records:

```json
{
  "status": "unique",
  "count": 1,
  "visibleCount": 1,
  "enabledCount": 1,
  "durationMs": 2.14,
  "error": null
}
```

Statuses are `not-tested`, `unique`, `multiple`, `none`, or `error`. Module 5 reports factual match
counts only. Module 6 will add stability scoring and final confidence ranking.

## Frames and shadow DOM

Every candidate stores its `framePath`. Main-frame code is serialized with a `page` root, while
child-frame code is serialized with a `frame` root. Consumers must resolve the recorded frame before
using child-frame candidates. Playwright semantic and CSS locators can pierce open shadow roots;
XPath fallbacks are intentionally excluded there.

## Security

Locator reports may expose page structure and user-visible labels even when input values are never
captured. Keep reports in protected artifact storage. Redaction remains enabled by default.

## Stability ranking

Module 6 ranks evaluated candidates, assigns confidence bands, and selects at most one recommended locator per element. Use `--minimum-score` to raise or lower the default recommendation threshold of 50. See [`locator-stability.md`](locator-stability.md).
