# Module 8 Handoff — Snapshot Engine

## Commit scope

This archive extends Module 7 with sanitized HTML snapshots, element fingerprints, and reusable
versioned baselines.

Suggested commit:

```bash
git add -A
git commit -m "Add sanitized snapshots and baseline storage"
```

## Validation

```bash
npm ci
npm run check
npm run build
npm run pack:check
npm run smoke:snapshot
```

When Chromium is installed outside Playwright's cache:

```bash
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:snapshot
```

## Main files

```text
src/core/snapshot/frame-html-script.ts
src/core/snapshot/html.ts
src/core/snapshot/fingerprint.ts
src/core/snapshot/bundle.ts
src/core/baseline/store.ts
src/core/baseline/capture.ts
src/types/snapshot.ts
docs/snapshots-and-baselines.md
examples/snapshots/
```

## Security behavior

- Form control values are never serialized.
- Script contents and inline event handlers are omitted.
- URL query strings and fragments are stripped under default redaction.
- Common sensitive text patterns are redacted.
- Baseline versions are immutable and stored under a validated name.

## Next module

Module 9 compares a current snapshot with a saved baseline and identifies added, removed, moved, and
changed elements.
