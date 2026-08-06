# Module 11 — Portable HTML reports

Module 11 adds a dependency-free renderer for combining toolkit JSON outputs and diagnostic screenshots into one portable browser-viewable report.

## Public API

- `buildHtmlReport()`
- `loadHtmlReportSources()`
- `detectHtmlReportSource()`
- `collectHtmlReportImages()`
- `renderPortableHtmlReport()`
- `resolveHtmlReportOptions()`

## CLI

```bash
selector report <inputs...>
```

## Guarantees

- Single HTML file
- No external runtime assets
- HTML escaping of source text
- Bounded tables and image embedding
- Versioned JSON report manifest
- Recursive artifact-directory discovery
