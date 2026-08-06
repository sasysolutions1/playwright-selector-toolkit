# Module 12 handoff

## Suggested commit

```bash
git add -A
git commit -m "Add interactive offline report dashboards"
```

## Validate

```bash
npm ci
npm run check
npm run build
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:dashboard
```

## Primary files

- `src/core/report/render.ts`
- `src/core/report/options.ts`
- `src/core/report/runner.ts`
- `src/types/html-report.ts`
- `examples/report/dashboard-smoke.mjs`
- `docs/interactive-reports.md`
