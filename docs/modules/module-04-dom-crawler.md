# Module 4 — DOM crawler

Version: `0.4.0`

## Delivered

- `selector discover` command with text and JSON reports.
- Main-document and recursive child-frame traversal.
- Open shadow-root traversal.
- Interactive-only and all-element scopes.
- Hidden-element filtering and visibility reasons.
- Bounding boxes and viewport intersection.
- Accessible-name approximation, labels, placeholders, ARIA metadata, and test IDs.
- Native, role, contenteditable, tabindex, and inline-handler interactivity classification.
- Sensitive-field classification.
- Default text and URL redaction.
- Guaranteed omission of input and textarea values.
- Global element and frame-depth limits.
- Versioned JSON DOM snapshots.
- Child-frame failure isolation and fatal main-frame errors.
- Real Chromium fixture exercising frames, open shadow roots, hidden controls, and redaction.

## Boundaries

- Closed shadow roots cannot be inspected.
- Event listeners registered through `addEventListener` are not enumerated by standard DOM APIs.
- The accessible name is a deterministic approximation, not a replacement for the browser's full
  accessibility tree.
- Locator generation and uniqueness analysis begin in Module 5.
