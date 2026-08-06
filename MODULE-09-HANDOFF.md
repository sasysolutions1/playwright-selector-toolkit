# Module 9 Handoff

## Suggested commit

```bash
git add -A
git commit -m "Add DOM baseline comparison"
```

## Validate

```bash
npm ci
npm run check
npm run build
npm run smoke:comparison
```

## New command

```bash
selector compare <baseline> [url]
```

Use `--fail-on-drift` in CI when any detected element drift should fail the job.
