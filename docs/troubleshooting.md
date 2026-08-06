# Troubleshooting

## Browser executable not found

```bash
npx playwright install chromium
selector doctor --strict
```

For a controlled system browser:

```bash
selector --executable-path /usr/bin/chromium doctor --strict
```

## Persistent profile is locked

Only one process may use a persistent profile. Stop the existing process and retry. The toolkit removes
a stale lock only when it can verify that the owning local process is no longer running.

## Authentication plugin did not run

```bash
selector --plugin ./plugins/application.mjs plugins inspect --json
```

Then inspect `reports/plugins.json` in the artifact run.

## Required selector failed

1. Open the validation report.
2. Capture evidence with `selector evidence`.
3. Run `selector locators` for replacement candidates.
4. Compare against the approved baseline.
5. Update the manifest only after reviewing the page state and target identity.

## Report has no screenshots

Screenshots are embedded only when they are referenced by a diagnostic evidence manifest and remain
below `--max-image-bytes`. Use `--no-embed-images` to intentionally omit them.

## Child frame selector fails

Use the frame path from discovery output. Named frame paths depend on the iframe title, name, URL, or
stable position. Re-run discovery after a page redesign.

## Shadow DOM selector fails

Playwright CSS and semantic locators pierce open shadow roots. XPath does not. Closed shadow roots
cannot be inspected by page JavaScript.

## CI exits with code 1

A required selector or drift assertion failed. This is expected behavior. Upload `.selector-artifacts`
and review the JSON, HTML report, screenshots, and trace.
