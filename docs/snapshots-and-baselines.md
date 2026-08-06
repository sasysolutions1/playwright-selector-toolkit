# Sanitized Snapshots and Baselines

Module 8 captures a reusable page state without storing form values, password values, executable
scripts, inline event handlers, or URL query secrets.

## Snapshot bundle

```bash
selector snapshot https://example.com/login
```

A snapshot run writes:

```text
snapshots/dom-snapshot.json
snapshots/html-snapshot.json
snapshots/element-fingerprints.json
snapshots/html/001-main.html
snapshots/html/002-main-frame-0-child.html
reports/snapshot-bundle.json
```

The bundle contains three complementary representations:

1. **DOM inventory** — the redacted element metadata introduced in Module 4.
2. **Sanitized HTML** — deterministic HTML per Playwright frame, including open shadow roots.
3. **Element fingerprints** — semantic and structural SHA-256 hashes for later matching.

## Sanitization rules

Sanitized HTML excludes or transforms:

- `input` and `textarea` values
- password values
- `srcdoc`, `nonce`, integrity, and known secret attributes
- attributes beginning with `on`, such as `onclick`
- script and `noscript` elements
- style elements unless `--include-styles` is supplied
- HTML comments
- query strings and fragments from URL-bearing attributes
- common email, phone, SSN, payment-card, token, and secret patterns

Open shadow roots are serialized as:

```html
<template data-selector-toolkit-shadow-root="open">...</template>
```

Closed shadow roots cannot be inspected by ordinary page JavaScript and are therefore not included.

## Snapshot options

```bash
selector snapshot https://example.com \
  --all-elements \
  --include-hidden \
  --max-elements 1000 \
  --max-frame-depth 6 \
  --max-frame-characters 2000000 \
  --html-directory snapshots/html \
  --json
```

`--no-redact` should only be used in a controlled environment. Form values remain omitted even when
redaction is disabled.

## Element fingerprints

Each recorded element receives two hashes in `element-fingerprints.json`:

- **Semantic hash** — tag, role, accessible name, label, placeholder, stable attributes, and
  interactivity metadata. It intentionally excludes the DOM path and volatile classes.
- **Structural hash** — frame path, shadow path, DOM path, tag, and stable attributes.

Semantically identical elements share a semantic hash and receive deterministic ordinals. This lets
Module 9 distinguish repeated controls while still detecting moved elements.

## Saving a baseline

```bash
selector baseline save login-page https://example.com/login
```

Baselines are stored under:

```text
.selector-artifacts/baselines/login-page/
  latest.json
  versions/
    2026-07-18T00-00-00-000Z-12345678/
      manifest.json
      snapshots/
```

Saving the same name again creates a new immutable version and updates `latest.json`; older versions
are retained.

## Listing and inspecting baselines

```bash
selector baseline list
selector baseline list --json
selector baseline show login-page
selector baseline show login-page --version 2026-07-18T00-00-00-000Z-12345678
```

Baseline names must begin with a letter or number and may contain only letters, numbers, dots,
underscores, and hyphens. Baseline and artifact paths are constrained to their configured roots.

## Library API

```ts
import {
  captureSnapshotBundle,
  captureBaseline,
  createElementFingerprintIndex,
  listBaselines,
  loadBaseline,
  saveBaseline,
} from 'playwright-selector-toolkit';
```

## Security considerations

Sanitization is defense in depth, not authorization. Snapshot directories should still be treated as
sensitive application diagnostics and protected with ordinary filesystem access controls. Review a
new application's first capture before enabling scheduled snapshots.
