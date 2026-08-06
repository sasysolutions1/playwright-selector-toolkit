# Portable HTML reports

Module 11 turns existing toolkit JSON outputs into one self-contained HTML file that can be opened locally, attached to an issue, stored as a CI artifact, or emailed without a web server.

## Supported inputs

The report builder recognizes:

- DOM discovery snapshots
- Locator candidate and stability reports
- Selector validation reports
- Selector repair reports and review-only recommendations
- DOM comparison reports
- Diagnostic evidence manifests and screenshots

Pass individual JSON files, artifact-run directories, or both:

```bash
selector report .selector-artifacts/2026-07-18-discover-run
selector report discovery.json locators.json validation.json
```

## Command options

```bash
selector report <inputs...> \
  --title "Login selector health" \
  --output reports/login-health.html \
  --max-items 100 \
  --max-image-bytes 5000000
```

Screenshots are embedded as data URIs by default. Disable image embedding when file size matters more than portability:

```bash
selector report artifacts/run --no-embed-images
```

## Security model

The HTML renderer escapes all report text and does not load external scripts, stylesheets, fonts, or images. It assumes that source reports were generated with the toolkit's normal redaction enabled. Input values, passwords, tokens, and query strings should never be reintroduced into source JSON before report generation.

## CI use

Generate the HTML after validation or comparison and upload the report directory as a workflow artifact. The command returns nonzero only for invalid arguments, missing inputs, or unsupported source sets; validation and drift policies remain controlled by the commands that created the source JSON.

## Interactive dashboard

Module 12 enables offline search, source filters, issue-only mode, dynamic facets, clickable metric drill-down, table sorting, section collapsing, CSV export, theme switching, and filtered printing by default.

```bash
selector report artifacts/run --title "Selector dashboard"
```

Disable the inline dashboard script when required:

```bash
selector report artifacts/run --no-interactive
```

See [Interactive offline reports](interactive-reports.md).
