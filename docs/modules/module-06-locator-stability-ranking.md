# Module 6 — Locator Stability Ranking

## Delivered

- deterministic 0–100 stability scores;
- high, medium, and low confidence bands;
- explainable positive and negative score signals;
- semantic locator preference;
- live uniqueness, visibility, and enabled-state bonuses;
- ambiguity, missing-match, and evaluation-error penalties;
- generated-ID and hash-pattern detection;
- structural CSS and XPath penalties;
- one recommended locator per eligible element;
- configurable minimum recommendation score;
- summary counts and average score;
- real Chromium smoke validation.

## Public API

- `analyzeIdentifier`
- `isStructuralSelector`
- `rankElementLocatorCandidates`
- `rankLocatorCandidates`
- `recommendedCandidate`
- `collectLocatorRecommendations`

## CLI

```bash
selector locators https://example.com --minimum-score 65
```

The JSON report schema is now `1.1`.
