# Architecture

The toolkit is divided into a reusable core library, a trusted plugin layer, and a thin CLI.

```text
CLI
 ├─ version / doctor / config
 ├─ artifacts init
 ├─ browser inspect
 ├─ discover / locators / validate
 ├─ snapshot / baseline / compare
 ├─ evidence / report
 ├─ monitor run / watch / status / history / prune-history
 └─ plugins inspect
        │
        ▼
Core library
 ├─ deterministic configuration resolver
 ├─ structured errors and artifact manager
 ├─ managed Playwright browser/session lifecycle
 ├─ trusted plugin host
 │   ├─ setup and teardown
 │   ├─ authentication hooks
 │   ├─ page-state detectors
 │   ├─ structured DOM redactors
 │   └─ custom locator generators
 ├─ redaction-aware DOM crawler
 ├─ locator extraction, live evaluation, and stability ranking
 ├─ selector manifest validation
 ├─ sanitized snapshots and versioned baselines
 ├─ DOM comparison and replacement suggestions
 ├─ diagnostic evidence bundles
 ├─ portable and interactive HTML reports
 ├─ persistent selector-health monitoring and notifications
 └─ append-only historical health aggregation
```

## Design rules

1. Library functions return typed results and do not terminate the process.
2. CLI commands translate results into text, JSON, artifacts, and stable exit codes.
3. Configuration resolution is deterministic and inspectable.
4. Unknown configuration fields fail instead of being silently ignored.
5. Browser failures produce diagnostics but never guess an unsafe action.
6. Generated selectors favor user-facing Playwright locators before raw CSS or XPath.
7. All artifacts are written to explicit user-controlled directories.
8. Artifact helpers reject paths that escape the active run.
9. Private authentication data is never embedded in selector definitions or reports.
10. Plugins are trusted Node.js code, are never silently loaded, and receive bounded hook timeouts.
11. CAPTCHA, MFA, anti-automation controls, and access restrictions are never bypassed.

## Browser session layer

The browser/session manager owns Playwright launch, context creation, persistent-profile locks,
storage-state persistence, default timeouts, trace capture, screenshot capture, and graceful
shutdown. Higher-level modules consume `BrowserSessionHandle` rather than launching browsers
directly. This concentrates browser lifecycle behavior and prevents competing persistent-profile
users.

## Plugin layer

The plugin host is initialized once per managed browser session. It loads validated ESM plugins in
configured order, runs setup hooks, invokes authentication after initial navigation, detects page
states, applies structured DOM redactors, contributes locator candidates, and tears plugins down in
reverse order. Each hook emits a duration and status diagnostic. Async hooks are timeout-bound;
failures either remain isolated or stop execution according to the resolved failure mode.

Plugins execute in the toolkit process with the same operating-system permissions. They are an
extension mechanism, not a security sandbox.

## Locator ranking layer

The stability engine consumes generated candidates and optional live evaluation results. It emits
explainable score signals, deterministic ranks, confidence bands, and at most one recommended
locator per element. Ambiguous, missing, and errored live candidates are never recommended. Plugin
candidates pass through the same serializer, evaluator, and ranking engine as built-in candidates.

## Selector validation layer

The validator loads strict JSON or YAML manifests, resolves structured locator specifications
against live frames, evaluates count and state assertions, and writes versioned JSON reports.
Required failures control the process exit code; optional failures remain visible but nonfatal.

## Snapshot and comparison layer

Sanitized per-frame HTML, DOM inventories, and semantic/structural fingerprints are stored as
immutable baseline versions. The comparison engine matches current elements by exact fingerprint and
bounded similarity, then classifies additions, removals, movement, and semantic changes while
suggesting replacement locators.

## Diagnostic and report layer

Evidence capture combines screenshots, traces, page metadata, console errors, page errors, network
failures, and sanitized snapshots into a portable ZIP. Report generation merges discovery, locator,
validation, comparison, and diagnostic artifacts into a single offline HTML dashboard. Interactive
mode filters only already-rendered escaped content and performs no network calls.

## Release and supply-chain layer

The release layer is intentionally separate from browser automation. It reviews runtime and package
compatibility, scans repository security controls, verifies the exact npm tarball through a clean
installation, generates SBOMs, and publishes only from a tag-triggered GitHub-hosted workflow using
OIDC.

## Monitoring layer

The monitoring layer composes existing selector validation runs with a persistent incident state
machine. It applies per-target intervals, consecutive-failure thresholds, severity escalation,
duplicate-alert suppression, reminders, and recovery transitions. Notification adapters receive only
structured health summaries and load credentials from environment variables. The state store is
atomic and independent from browser profiles or storage state. Each due check also produces a
privacy-bounded append-only history record. The history aggregator clips incidents to a requested
time window and calculates pass rate, estimated availability, recovery/failure intervals, latency
percentiles, daily buckets, and portable report sections.
