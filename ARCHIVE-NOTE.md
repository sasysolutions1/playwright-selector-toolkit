# Archive: toolkit v0.18.0 (2026-07-18)

This branch preserves a **separate, larger build** of the selector toolkit that
predates the code on `main`, recovered from cumulative zip snapshots that were
sitting outside version control in a local Downloads folder.

## What this is

Extracted from `playwright-selector-toolkit-module-18-historical-health-trends.zip`
(2026-07-18), the last and most complete of six cumulative snapshots
(modules 13–18). Each zip contained the whole project at that module; 18 is the
superset, so it is the only one preserved here.

## How it relates to `main`

It is **not** an ancestor of `main`. It is a different, earlier, much larger
implementation. `main`'s v0.1.0 was written 2026-07-29, eleven days after this
snapshot, apparently without knowledge of it.

    THIS BRANCH (v0.18.0)          main (v0.1.0)
    TypeScript, 94 src files       plain JS, 1 file
    17,314 src lines               402 lines
    75 test files / 8,231 lines    1 test file
    50 docs, 42 examples           1 doc
    CLI (`selector` binary)        library only
    vitest / eslint / prettier     node:test
    CodeQL + dependabot + SBOM     CI only

Modules present here and absent from `main`: DOM crawler, snapshot and
fingerprinting, baseline capture and comparison, diagnostics with screenshots,
HTML and interactive reports, plugin API, selector repair, health monitoring
with historical trends, incidents and notifications, and DOM redaction.

## Status

**Archived for preservation, not adopted.** Nothing here has been reviewed,
built, or tested in this repository, and `main` remains the supported code.
Whether to adopt, port from, or abandon this build is an open decision.

Preserved because 17,000 lines of source and 8,000 lines of tests existed only
as zip files in a Downloads folder, one accidental delete from being lost.

Scanned before publication: no credentials, tokens, private keys, internal
hostnames, or infrastructure identifiers. The single private-key string in
`tests/release-security.test.ts` is a fixture marked `not-real` that exists to
assert the security scanner detects such keys.
