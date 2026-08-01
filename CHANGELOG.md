# Changelog

## Unreleased

- Resolve implicit ARIA roles for select, table, heading, list, landmark, and
  typed input elements instead of only buttons, links, and text inputs.
- Add `options.frame` so a target inside one or more nested iframes can be
  snapshotted and validated through `frameLocator`.
- Honor `aria-labelledby` (and `title`) when computing the accessible name.
- Raise the default validation timeout from 1s to 5s for slower applications.
- Export `resolveSearchRoot` for callers that need the resolved search root.

## 0.1.0 - 2026-07-29

- Add DOM snapshot capture for an authorized seed element.
- Rank role, label, test-id, placeholder, stable attribute, and text locators.
- Validate uniqueness and visibility through the Playwright locator API.
- Format copyable locator expressions and return the best verified candidate.
- Add usage, safety, regression tests, and multi-version CI.
