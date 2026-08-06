# Scheduled selector-health monitoring

Module 17 adds persistent selector-health monitoring around existing selector manifests. The monitor
runs normal `selector validate` checks, records consecutive failures and recoveries, opens incidents,
suppresses duplicate alerts, escalates severity, and sends one recovery notice when service is
restored.

## Commands

Run one cron-friendly cycle:

```bash
selector monitor run examples/monitoring/monitor.yaml --fail-on-unhealthy
```

Run continuously:

```bash
selector monitor watch examples/monitoring/monitor.yaml
```

Inspect persistent state:

```bash
selector monitor status examples/monitoring/monitor.yaml
```

Aggregate historical trends:

```bash
selector monitor history examples/monitoring/monitor.yaml --since 30d
```

Use `--force` to check every target even when its configured interval has not elapsed. Use
`--no-notify` during maintenance or dry runs; it updates incident state without contacting external
providers.

## Manifest

```yaml
schemaVersion: '1.0'
name: Production selector health
pollIntervalMs: 60000

targets:
  - id: login
    name: Login page
    manifestPath: ./selectors/login.yaml
    url: https://example.com/login
    intervalMs: 300000
    notificationAdapterIds: [email, sms, voice]
    policy:
      openAfterFailures: 2
      recoverAfterSuccesses: 1
      highAfterFailures: 3
      criticalAfterFailures: 5
      reminderIntervalMs: 21600000

notifications:
  - id: email
    type: sendgrid-email
    apiKeyEnv: SENDGRID_API_KEY
    fromEnv: SELECTOR_ALERT_EMAIL_FROM
    toEnv: SELECTOR_ALERT_EMAIL_TO
    severities: [warning, high, critical]
    notifyRecovery: true
```

Selector manifest paths are resolved relative to the monitoring manifest. Notification secrets are
never stored in YAML. The manifest contains only environment-variable names.

## Incident lifecycle

1. A single transient failure is stored but does not necessarily open an incident.
2. `openAfterFailures` opens a warning incident.
3. `highAfterFailures` and `criticalAfterFailures` escalate the same incident.
4. Repeated checks at the same severity are suppressed until `reminderIntervalMs` elapses.
5. `recoverAfterSuccesses` closes the incident and sends one recovery notice.
6. Resolved incidents are retained in a bounded recent-history list.

Persistent state is written atomically under:

```text
.selector-artifacts/monitoring/<monitor-name>/state.json
```

Use `--state-file` to select another path. State files contain health metadata and incident IDs, not
browser credentials, form values, cookies, or storage state.

## Notification adapters

### Console

Useful for development, systemd, Docker logs, or another supervisor:

```yaml
- id: console
  type: console
```

### Generic webhook

```yaml
- id: webhook
  type: webhook
  urlEnv: SELECTOR_ALERT_WEBHOOK_URL
```

The adapter sends a JSON notification with a 15-second timeout.

### SendGrid email

```yaml
- id: email
  type: sendgrid-email
  apiKeyEnv: SENDGRID_API_KEY
  fromEnv: SELECTOR_ALERT_EMAIL_FROM
  toEnv: SELECTOR_ALERT_EMAIL_TO
```

### Twilio SMS

```yaml
- id: sms
  type: twilio-sms
  accountSidEnv: TWILIO_ACCOUNT_SID
  authTokenEnv: TWILIO_AUTH_TOKEN
  fromEnv: TWILIO_ALERT_FROM
  toEnv: TWILIO_ALERT_TO
  severities: [high, critical]
```

### Twilio voice

```yaml
- id: voice
  type: twilio-voice
  accountSidEnv: TWILIO_ACCOUNT_SID
  authTokenEnv: TWILIO_AUTH_TOKEN
  fromEnv: TWILIO_ALERT_FROM
  toEnv: TWILIO_ALERT_TO
  severities: [critical]
  notifyRecovery: false
```

The voice adapter places a short text-to-speech call. It does not create or bypass authentication
challenges.

## Exit behavior

`monitor run` normally exits `0` after persisting the cycle, even when an incident is open. Add
`--fail-on-unhealthy` for cron or CI:

- `0`: healthy, or failure policy not requested
- `1`: an unhealthy target or open incident exists
- `2`: invalid manifest or CLI input

## Cron example

```cron
*/5 * * * * cd /opt/selector-toolkit && \
  /usr/bin/node dist/cli/index.js monitor run ./monitor.yaml \
  --fail-on-unhealthy >> /var/log/selector-monitor.log 2>&1
```

The persistent state prevents a cron run from sending the same notification every five minutes.

## systemd example

```ini
[Unit]
Description=Playwright Selector Health Monitor
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/selector-toolkit
EnvironmentFile=/etc/selector-toolkit/monitor.env
ExecStart=/usr/bin/node dist/cli/index.js monitor watch /etc/selector-toolkit/monitor.yaml
Restart=always
RestartSec=15
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

## Security guidance

- Put provider credentials only in a secret manager or protected environment file.
- Do not place passwords, cookies, storage-state content, or phone numbers directly in the monitor
  manifest.
- Alert text contains selector-health summaries and incident IDs, not raw HTML or form values.
- Limit webhook destinations to trusted HTTPS endpoints.
- Use a separate external watchdog if the entire host must be monitored; a process cannot report its
  own total host failure.

## Historical records

Each due target check is appended to an owner-readable JSONL history file by default. Use
`--history-file` to override the path or `--no-history` for an intentional maintenance cycle. See
[historical selector-health trends](monitoring-history.md) for availability, MTTR, MTBF, daily trend,
portable report, and retention-pruning guidance.
