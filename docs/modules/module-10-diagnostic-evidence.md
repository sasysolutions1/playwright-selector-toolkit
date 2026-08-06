# Module 10: diagnostic evidence bundles

Module 10 adds failure-oriented evidence collection and packaging.

## Delivered

- Full-page, viewport, and CSS element screenshots.
- Playwright trace retention.
- Browser and page metadata.
- Console, page-error, failed-request, and HTTP-error recording.
- Sanitized DOM and HTML snapshots.
- Bounded event retention and dropped-entry counters.
- Default sensitive-data and URL-query redaction.
- ZIP packaging of the entire artifact run.
- `selector evidence` and reusable library wrappers.
- CI failure policies that preserve the archive before returning exit code 1.
- Real Chromium smoke coverage.

## Commit suggestion

```bash
git add -A
git commit -m "Add diagnostic evidence bundles"
```
