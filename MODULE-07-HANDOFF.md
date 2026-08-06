# Module 7 Handoff — Selector Validation

Version: `0.7.0`

## Delivered

- `selector validate <manifest> [url]`
- JSON and YAML selector manifests
- Structured role, label, placeholder, text, test-ID, CSS, attribute, and XPath locators
- Required and optional selector behavior
- Exact and ranged count assertions
- `any`, `all`, and `none` visibility, enabled, and editable assertions
- Main-frame and named child-frame validation
- JSON artifact reports
- Exit code `0` for required success, `1` for required failure, and `2` for invalid input
- Real Chromium smoke test

## Validation

```bash
npm ci
npm run check
npm run build
npm run pack:check
npm run smoke:validation
```

## Suggested commit

```bash
git add -A
git commit -m "Add selector manifest validation"
```
