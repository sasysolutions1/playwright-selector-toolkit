# Module 6 Handoff

## Scope

This archive extends Module 5 with stability scoring and recommended-locator selection.

## Validation

Run:

```bash
npm ci
npm run check
npm run build
npm run pack:check
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:locators
```

Use a Playwright-managed Chromium installation when `/usr/bin/chromium` is unavailable:

```bash
npx playwright install chromium
npm run smoke:locators
```

## Suggested commit

```bash
git add -A
git commit -m "Add locator stability ranking"
```

## Next module

Module 7 adds selector manifests and assertion-based validation with CI exit codes.
