# Locator Stability Ranking

Module 6 ranks every generated locator after optional live evaluation. The ranking is designed to
make the toolkit's recommendation explainable rather than opaque.

## Output fields

Every candidate receives a `stability` object:

```json
{
  "score": 100,
  "confidence": "high",
  "rank": 1,
  "recommended": true,
  "eligible": true,
  "generatedIdentifier": false,
  "structural": false,
  "signals": [
    {
      "code": "strategy-base",
      "label": "test-id strategy base score",
      "adjustment": 76
    },
    {
      "code": "unique-match",
      "label": "Live evaluation found exactly one match",
      "adjustment": 18
    }
  ]
}
```

Each element also receives `recommendedCandidateId`. At most one candidate is recommended for an
element.

## Scoring principles

The score is clamped to `0–100`.

Positive signals include:

- explicit test hooks;
- associated labels;
- roles with accessible names;
- human-authored IDs;
- exactly one live match;
- a visible and enabled unique match.

Negative signals include:

- generated, UUID-shaped, numeric, hash-like, or framework-style identifiers;
- copy-dependent text and placeholders;
- structural CSS and XPath;
- ambiguous, missing, or errored live matches;
- hidden targets;
- nested frames and shadow-root crossings;
- generator warnings.

A candidate with a live status of `multiple`, `none`, or `error` is never eligible for
recommendation. Untested candidates can be recommended, but their confidence is capped at
`medium`.

## Confidence bands

- `high`: score 75–100
- `medium`: score 50–74
- `low`: score 0–49

The recommendation threshold defaults to `50` and can be changed:

```bash
selector locators https://example.com --minimum-score 65
```

Library usage:

```ts
import { rankLocatorCandidates, recommendedCandidate } from 'playwright-selector-toolkit';

const ranked = rankLocatorCandidates(elements, {
  minimumRecommendedScore: 65,
});

for (const element of ranked) {
  console.log(recommendedCandidate(element)?.playwright ?? 'No recommendation');
}
```

## Deterministic ordering

Ties are resolved using:

1. stability score;
2. semantic strategy preference;
3. original generator priority;
4. candidate ID.

This makes repeated analysis of the same DOM deterministic.

## Generated identifier detection

The toolkit detects common unstable shapes, including:

- UUIDs;
- React `useId` values;
- long numeric IDs;
- long hexadecimal values;
- framework prefixes with numeric suffixes;
- hash-like suffixes.

The detection is heuristic. The full reason is included in the candidate's scoring signals so a
reviewer can override the recommendation when application-specific knowledge is stronger.
