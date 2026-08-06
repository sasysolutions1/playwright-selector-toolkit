# DOM Comparison

Module 9 compares a saved baseline with a newly captured page and reports element drift.

## Command

```bash
selector compare login-page https://example.com/login
```

When the URL is omitted, the toolkit reuses the URL stored in the baseline:

```bash
selector compare login-page
```

Use a specific baseline version:

```bash
selector compare login-page --version 2026-07-18T00-00-00-000Z-12345678
```

Fail CI when drift is detected:

```bash
selector compare login-page --fail-on-drift
```

## Matching order

1. Exact structural fingerprint match.
2. Exact semantic fingerprint and duplicate ordinal match.
3. Greedy one-to-one similarity match above the configured threshold.

Similarity uses the element tag, kind, role, accessible name, label, placeholder, text, stable attributes, frame, and shadow-root location. It never uses form values.

## Difference categories

- `unchanged`
- `added`
- `removed`
- `moved`
- `changed`
- `moved-and-changed`

The default JSON report excludes unchanged elements but still counts them in the summary. Add `--include-unchanged` when a complete mapping is needed.

## Replacement locators

Changed, moved, and added elements receive ranked Playwright locator suggestions generated from the current DOM snapshot. These suggestions are not live uniqueness-tested during comparison, so they should be validated before production use.

```bash
selector compare login-page \
  --max-replacements 5 \
  --minimum-score 60
```

## Similarity threshold

The default similarity threshold is `0.62`.

```bash
selector compare login-page --similarity-threshold 0.7
```

Higher values reduce false matches but can turn renamed elements into separate removed and added entries. Lower values are more tolerant but should be reviewed carefully.

## Output

The comparison is written to:

```text
reports/dom-comparison.json
```

The report contains baseline/current metadata, a summary, element differences, changed fields, match methods, similarity scores, and replacement locator suggestions.
