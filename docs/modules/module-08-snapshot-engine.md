# Module 8 — Snapshot Engine

## Delivered

- Redacted deterministic HTML serialization for every Playwright frame
- Open shadow-root representation
- Input-value, script, inline-handler, and URL-query omission
- Semantic and structural SHA-256 element fingerprints
- Versioned JSON schemas for snapshot bundles and fingerprint indexes
- `selector snapshot`
- Versioned reusable baseline storage
- `selector baseline save`, `list`, and `show`
- Path-traversal protection for baseline names and copied artifacts
- Real Chromium coverage for iframe and shadow-DOM sanitization

## Validation target

Module 8 is complete when a clean installation can capture the fixture, prove secrets are absent,
save a baseline, and load its latest immutable version.

## Deferred to Module 9

- Comparing two fingerprint indexes
- Added, removed, moved, and changed element classification
- Locator replacement suggestions
