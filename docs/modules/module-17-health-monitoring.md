# Module 17 handoff — scheduled health monitoring

Version: `0.17.0`

## Delivered

- Strict JSON/YAML monitoring manifests
- Per-target check intervals and escalation policies
- Atomic persistent monitor state
- Warning, high, and critical incidents
- Duplicate-alert suppression and reminder windows
- Recovery notices and bounded incident history
- Console, webhook, SendGrid email, Twilio SMS, and Twilio voice adapters
- `monitor run`, `monitor watch`, and `monitor status`
- Cron, systemd, and GitHub-friendly exit behavior
- Unit, CLI, state-store, notification, and real Chromium monitoring coverage

## Operational boundary

The monitor runs existing selector manifests through the ordinary validator. It does not repair
selectors automatically, bypass authentication challenges, or store provider secrets. Use Module 15
to generate review-only repair proposals after a monitored selector fails.
