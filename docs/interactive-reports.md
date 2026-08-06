# Interactive offline reports

Module 12 adds an optional, dependency-free dashboard layer to the portable HTML report. All controls are embedded in the generated file and continue to work from `file://` URLs without a web server.

## Dashboard controls

Interactive reports include:

- full-report text search;
- source-type visibility controls;
- issue-only mode;
- dynamic facets derived from report rows;
- clickable metric cards that drill into status, confidence, change, visibility, and event categories;
- sortable table columns;
- per-section collapse and expand controls;
- expand-all and collapse-all actions;
- automatic visible-row and visible-section counts;
- light, dark, and system themes;
- CSV export of the currently visible rows;
- print of the current filtered view;
- screenshot lightbox viewing;
- `/` to focus search and `Escape` to clear it.

## Generate an interactive report

Interactive controls are enabled by default:

```bash
selector report artifacts/run --title "Selector health dashboard"
```

## Generate a static report

Use `--no-interactive` when inline JavaScript is not permitted by the destination:

```bash
selector report artifacts/run --no-interactive
```

The static mode retains the same report data, tables, screenshots, dark-mode CSS, and print layout, but omits the controls and inline script.

## Filtering semantics

- Source checkboxes control whole report families.
- Search is case-insensitive and applies to rendered rows and screenshot labels.
- Facets are ORed within one facet group and ANDed across different groups.
- Issue-only mode includes failed validations, DOM drift, diagnostic failures, hidden or sensitive discovery elements, and non-high-confidence locator recommendations.
- Click a filterable metric card once to isolate that metric; click it again to clear the metric filter.

## Security and portability

The dashboard script is a fixed toolkit asset. Report data is rendered into escaped HTML attributes and cells; untrusted source content is never interpolated into the script. No external JavaScript, stylesheet, font, image, analytics endpoint, or network call is required.
