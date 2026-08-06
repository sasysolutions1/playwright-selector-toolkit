# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Version 1.0 release-candidate review and hosted dashboard integrations.

## 0.18.0 - 2026-07-18

### Added

- Append-only JSONL history for due monitoring checks.
- `selector monitor history` with ISO and relative query windows.
- Check pass rate, estimated availability, MTTR, MTBF, longest outage, and latency percentiles.
- Daily trend and incident summaries.
- `selector monitor prune-history` with atomic rewriting.
- Historical health sections in portable and interactive HTML reports.

### Security

- History records exclude raw failure messages, HTML, form values, cookies, and credentials.
- History files are created with owner-only permissions.

## 0.17.0 - 2026-07-18

### Added

- `selector monitor run`, `monitor watch`, and `monitor status`.
- Persistent per-target health and incident state with atomic writes.
- Warning, high, and critical escalation policies.
- Duplicate-alert suppression, reminder windows, and recovery notices.
- Console, webhook, SendGrid email, Twilio SMS, and Twilio voice adapters.
- Cron/systemd examples and real Chromium monitoring coverage.

### Security

- Notification manifests store environment-variable names instead of credentials.
- Monitor reports contain health summaries rather than raw HTML, cookies, or form values.

## 0.16.0 - 2026-07-18

### Added

- `selector compatibility` with Node.js 22/24 matrix and package/build metadata checks.
- `selector security audit` covering package allowlists, lifecycle hooks, npm configuration, lock integrity, policy files, and high-confidence secret patterns.
- Reproducible npm tarball generation, clean-install import, installed CLI, and public API verification.
- CycloneDX and SPDX SBOM generation.
- Node.js matrix CI, Dependabot, CodeQL, release-tag verification, GitHub artifact attestations, and npm OIDC trusted publishing.

### Security

- Public package uses an explicit file allowlist and no install lifecycle hooks.
- Release workflow avoids long-lived npm automation tokens after trusted publishing is configured.

## 0.15.0 - 2026-07-18

### Added

- `selector repair` for review-only replacement suggestions after selector validation failures.
- Deterministic matching against unique, live-tested locator candidates.
- Optional OpenAI Responses API advisor constrained to existing candidate IDs and strict structured output.
- JSON repair evidence, immutable source manifests, and YAML proposal generation.
- Repair summaries in portable HTML reports and interactive dashboards.
- Unit, CLI, documentation, and real Chromium repair coverage.

### Security

- AI output cannot introduce or execute an unverified locator.
- Repair proposals require human review and validation before use.
- Sanitized metadata only; raw HTML, input values, credentials, cookies, and browser profiles are excluded.

## 0.14.0 - 2026-07-18

### Added

- Complete documentation index, getting-started guide, command reference, troubleshooting, security, and release guidance.
- Executable authenticated sample application covering plugin login, validation, locator ranking, redaction, and HTML reports.
- Plugin-author and authenticated-workflow tutorials.
- Reusable GitHub Actions selector-health templates.
- Safe Outside Access integration example with challenge detection and placeholder selector manifest.
- Documentation-link and integration-example regression tests.

## [0.13.0] - 2026-07-18

### Added

- Trusted ESM plugin loading from configuration, environment variables, and repeatable CLI flags.
- Ordered setup/teardown lifecycle with per-plugin state and logging.
- Authentication hooks and page-state detectors integrated into managed browser navigation.
- Structured DOM redaction extensions and custom locator-candidate generators.
- Per-hook timeout, isolation/fail-fast behavior, diagnostics, and plugin reports.
- `selector plugins inspect`, complete plugin documentation, and real Chromium plugin smoke coverage.

## [0.12.0] - 2026-07-18

### Added

- Offline interactive HTML report dashboard controls.
- Search, source toggles, issue-only filtering, and dynamic facets.
- Clickable metric drill-down and sortable tables.
- Collapsible sections, theme switching, visible-row CSV export, and filtered printing.
- Screenshot lightbox and keyboard search shortcut.
- `--no-interactive` static report mode.

## [0.11.0] - 2026-07-18

### Added

- Portable single-file HTML report generation through `selector report`.
- Automatic discovery of DOM, locator, validation, comparison, and diagnostic JSON outputs.
- Embedded diagnostic screenshots with configurable byte limits.
- Responsive, print-friendly report sections and versioned report manifests.
- Public report-builder APIs and real Chromium report smoke testing.

## [0.10.0] - 2026-07-18

### Added

- Full-page, viewport, and CSS element screenshots.
- Playwright trace, page metadata, console, page-error, failed-request, and HTTP-error evidence.
- Redacted diagnostic DOM and sanitized HTML snapshots.
- Bounded event retention with dropped-entry counters.
- ZIP packaging of complete artifact runs.
- `selector evidence`, `runWithDiagnosticEvidence`, and `withFailureEvidence`.
- CI failure policies that retain evidence before returning exit code 1.
- Real Chromium evidence-bundle smoke coverage.

## [0.9.0] - 2026-07-18

### Added

- Baseline-to-live-page DOM comparison.
- Structural, semantic, and bounded fuzzy element matching.
- Added, removed, moved, changed, and moved-and-changed classifications.
- Field-level change reporting and ranked replacement locator suggestions.
- `selector compare` with configurable thresholds and `--fail-on-drift` CI behavior.
- Real Chromium comparison smoke coverage.

## [0.8.0] - 2026-07-18

### Added

- Sanitized deterministic HTML snapshots for main documents and child frames.
- Open shadow-root serialization using explicit template markers.
- Omission of form values, scripts, inline handlers, URL query data, and sensitive attributes.
- Semantic and structural SHA-256 element fingerprints with duplicate ordinals.
- `selector snapshot` with versioned JSON bundle manifests.
- Immutable versioned baseline storage with `save`, `list`, and `show` commands.
- Baseline name and path-traversal protections.
- Real Chromium smoke coverage for iframe, shadow DOM, redaction, and baseline loading.

## [0.7.0] - 2026-07-18

### Added

- JSON and YAML selector manifests with strict schema validation.
- Required and optional selectors with child-frame support.
- Exact and ranged count assertions.
- Visibility, enabled, and editable state assertions.
- Versioned JSON validation reports and human-readable CLI output.
- CI-safe exit codes for required failures and invalid manifests.
- Real Chromium smoke coverage for optional and required failure behavior.

## [0.6.0] - 2026-07-18

### Added

- Explainable 0–100 locator stability scores and confidence bands.
- Generated-identifier, copy-dependence, structural-selector, and XPath detection.
- Live uniqueness, visibility, and enabled-state scoring signals.
- Ambiguous, missing, and evaluation-error recommendation safeguards.
- Deterministic per-element ranking and recommended-locator selection.
- `--minimum-score` CLI option and report schema version 1.1.
- Ranking summaries, recommendation lists, documentation, and Chromium smoke assertions.

## [0.5.0] - 2026-07-18

### Added

- `selector locators` for candidate extraction and live uniqueness testing.
- Role, label, placeholder, test-ID, text, attribute, CSS, and XPath candidates.
- Playwright code serialization and safe JavaScript, CSS, and XPath escaping.
- Frame-aware live match, visibility, and enabled-state counts.
- Redaction-aware omission and shadow-DOM XPath safeguards.
- Versioned JSON locator reports and real Chromium smoke coverage.

## [0.4.0] - 2026-07-18

### Added

- `selector discover` for redaction-aware DOM inventory.
- Recursive child-frame and open shadow-root traversal.
- Interactive-only and all-element crawl modes.
- Visibility reasons, viewport intersection, geometry, form state, ARIA, label, and placeholder metadata.
- Sensitive-field markers and safe attribute allowlisting.
- Default email, phone, SSN, payment-card, token, secret, and URL query redaction.
- Guaranteed omission of input and textarea values.
- Global element and frame-depth limits.
- Versioned JSON DOM snapshots and text/JSON CLI reports.
- Real Chromium smoke coverage for frames, shadow roots, redaction, and value omission.

## [0.3.0] - 2026-07-18

### Added

- Managed Chromium, Firefox, and WebKit sessions.
- Ephemeral and persistent Playwright contexts.
- Exclusive persistent-profile lock files with safe stale-lock recovery.
- Storage-state loading and automatic saving.
- Separate operation and navigation timeouts.
- Trace and screenshot retention policies.
- Idempotent close and SIGINT/SIGTERM shutdown helpers.
- `selector browser inspect` with text and JSON reports.
- Structured browser and session error codes.
- Browser session documentation and tests.

## [0.2.0] - 2026-07-17

### Added

- Shared CLI options for browser and artifact commands.
- JSON and YAML configuration discovery.
- Defaults, file, environment, and CLI precedence.
- Zod-based strict configuration validation.
- `selector config` human and JSON output.
- Structured toolkit, configuration, and artifact errors.
- Timestamped artifact runs with standard subdirectories and metadata.
- Artifact path-traversal protection.
- Artifact-directory health check in `selector doctor`.
- Configuration and artifact documentation and tests.

## [0.1.0] - 2026-07-17

### Added

- TypeScript project foundation.
- `selector` and `selector-toolkit` CLI entry points.
- `version` and `doctor` commands.
- Node, Playwright, filesystem, and platform diagnostics.
- Vitest, ESLint, Prettier, Playwright configuration, and GitHub Actions CI.
- MIT license, contribution guide, architecture notes, and roadmap.
