# Module 9 — DOM Comparison

Module 9 adds baseline-to-live-page drift detection.

## Delivered

- Structural, semantic, and fuzzy element matching
- Added, removed, moved, changed, and moved-and-changed classification
- Field-level change reporting
- Ranked replacement locator suggestions
- Configurable similarity and locator-score thresholds
- Optional unchanged-element output
- `--fail-on-drift` CI behavior
- JSON and human-readable reports
- Real Chromium smoke coverage

## Boundaries

The fuzzy matcher is deterministic and intentionally conservative. Replacement locators are generated from the captured DOM and are not live uniqueness-tested in this module. Module 10 will add richer screenshot and trace evidence; Module 11 will add standalone HTML reports.
