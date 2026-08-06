# Module 10 handoff

## Validate

```bash
npm ci
npm run check
npm run build
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:evidence
npm run pack:check
```

## Suggested commit

```bash
git add -A
git commit -m "Add diagnostic evidence bundles"
```

## Main command

```bash
selector evidence https://example.com \
  --element '#submit' \
  --fail-on-page-error \
  --fail-on-request-failure \
  --fail-on-http-error
```

The command writes a redacted JSON manifest and a ZIP containing screenshots, trace, sanitized page
snapshots, metadata, and captured browser events.
