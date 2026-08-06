# Module Roadmap

## Module 1 — Project foundation — complete

- TypeScript, ESLint, Prettier, Vitest, and Playwright configuration
- CLI executable
- Version and doctor commands
- CI and open-source project files

## Module 2 — CLI configuration and artifacts — complete

- Shared global flags
- Configuration-file discovery and schema
- Environment and CLI precedence
- Structured error handling
- Standard artifact directory layout

## Module 3 — Browser/session manager — complete

- Chromium, Firefox, and WebKit launch options
- Persistent and ephemeral profiles
- Exclusive persistent-profile locking
- Storage-state loading and saving
- Configured viewport, action and navigation timeouts
- Trace and screenshot retention
- Safe, idempotent shutdown and signal handling
- Browser inspection command

## Module 4 — DOM crawler — complete

- Interactive-element inventory
- Frame and shadow-root traversal
- Visibility and bounding-box metadata
- Redaction hooks

## Module 5 — Locator extraction — complete

- Role, label, placeholder, text, test ID, attribute, CSS, and XPath candidates
- Live uniqueness, visibility, and enabled-state testing
- Playwright code serialization

## Module 6 — Locator ranking — complete

- Explainable stability heuristics
- Confidence scores and score signals
- Generated-identifier and structural-selector detection
- Duplicate, ambiguity, missing, and evaluation-error penalties
- Recommended locator selection and configurable threshold

## Module 7 — Selector validator — complete

- Required and optional selectors
- Count, visibility, enabled, and editable assertions
- Versioned JSON reports
- Nonzero CI exit codes

## Module 8 — Snapshot engine — complete

- Sanitized HTML snapshots per frame
- Semantic and structural element fingerprints
- Versioned reusable baseline storage

## Module 9 — DOM comparison — complete

- Added, removed, moved, changed, and moved-and-changed elements
- Structural, semantic, and fuzzy matching
- Candidate replacement locator suggestions
- CI drift exit behavior

## Module 10 (complete) — Screenshots and traces

- Full-page and element screenshots
- Playwright trace capture
- Failure bundles

## Module 11 — Reports — complete

- JSON schema
- Standalone HTML report
- Machine-readable CI summaries

## Module 12 — Interactive report dashboard — complete

- Offline search and filtering
- Dynamic facets and metric drill-down
- Sortable tables and collapsible sections
- Theme, print, CSV export, and screenshot lightbox controls
- Static no-script report mode

## Module 13 — Plugin API — complete

- Authentication hooks and per-plugin state
- Page-state detectors
- Structured DOM redaction plugins
- Custom locator-candidate generators
- Ordered lifecycle, diagnostics, timeouts, and failure isolation

## Module 14 — Documentation and integration examples — complete

- Complete documentation index and command reference
- Executable authenticated sample application
- CI templates and plugin-author tutorial
- Outside Access integration example

## Module 15 — Review-only selector repair — complete

- Deterministic matching against live-tested locator candidates
- Optional structured AI ranking limited to allowlisted candidate IDs
- Immutable source manifests and review-only YAML proposals
- Portable HTML report support and CI unresolved-selector policy

## Module 16 — Release hardening — complete

- Node.js 22/24 compatibility review
- Repository security review and secret scanning
- Reproducible npm tarball and clean-install verification
- CycloneDX and SPDX SBOM generation
- Dependabot and CodeQL workflows
- OIDC npm trusted publishing and GitHub attestations

## Module 17 — Scheduled health monitoring — complete

- Cron-friendly and continuous workflow orchestration
- Persistent incident state and bounded history
- Duplicate-alert suppression, severity escalation, and recovery notices
- Console, webhook, SendGrid, Twilio SMS, and Twilio voice adapters

## Module 18 — Historical health trends — complete

- Append-only time-series health records
- Availability, MTTR, MTBF, outage, and latency summaries
- Daily trends and incident history
- Retention pruning
- Trend sections in portable and interactive reports

## Module 19 — Version 1.0 release candidate

- Public API and CLI compatibility review
- Migration and upgrade notes
- Documentation freeze and installation matrix
- End-to-end release-candidate validation
