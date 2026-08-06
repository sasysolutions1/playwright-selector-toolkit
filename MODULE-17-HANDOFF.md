# Module 17 handoff

## Version

`0.17.0`

## Scope

Scheduled selector-health monitoring with persistent incident state, warning/high/critical escalation,
duplicate-alert suppression, reminder windows, recovery notices, console/webhook/SendGrid/Twilio
notification adapters, and cron or continuous watch operation.

## Validation

```bash
npm ci
npm run check
npm run build
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:monitoring
```

## Suggested commit

```bash
git add -A
git commit -m "Add scheduled selector health monitoring"
```
