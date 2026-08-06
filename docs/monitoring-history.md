# Historical selector-health trends

Module 18 records each due selector-health check in an append-only JSONL history file and aggregates
those records into bounded, portable trend reports. The history contains health metadata only. It does
not store raw HTML, messages, credentials, cookies, storage state, or form-field values.

## Automatic history recording

`monitor run` and `monitor watch` append one record for each target that was actually checked:

```bash
selector monitor run monitor.yaml
selector monitor watch monitor.yaml
```

The default path is:

```text
.selector-artifacts/monitoring/<monitor-name>/history.jsonl
```

Override it when required:

```bash
selector monitor run monitor.yaml --history-file /var/lib/selector/history.jsonl
```

Disable recording for a maintenance cycle:

```bash
selector monitor run monitor.yaml --no-history
```

Skipped targets, internal retries, and notification attempts do not create check records. A record
contains the target ID, timestamp, duration, healthy/unhealthy state, incident event, severity,
incident ID, error code, fingerprint, and selector-validation counts.

## Build a trend report

The default report window is the preceding 30 days:

```bash
selector monitor history monitor.yaml
```

Use relative durations or ISO timestamps:

```bash
selector monitor history monitor.yaml --since 7d
selector monitor history monitor.yaml \
  --since 2026-07-01T00:00:00Z \
  --until 2026-08-01T00:00:00Z
```

Limit the report to one or more targets:

```bash
selector monitor history monitor.yaml \
  --target login \
  --target checkout
```

The command writes a versioned JSON report under the active artifact run. It reports:

- check pass rate;
- estimated time-based availability;
- incident count and open-incident count;
- mean time to recovery (MTTR);
- mean time between failures (MTBF) per target;
- longest outage;
- average, p50, and p95 check duration;
- daily healthy/unhealthy counts;
- incident opening, resolution, duration, and peak severity.

## Metric interpretation

**Check pass rate** is healthy checks divided by all checks in the selected window. It is not the same
as service uptime.

**Estimated availability** subtracts incident duration from the selected time window. For multiple
targets, overall availability uses total target-time. Incident intervals are clipped to the query
window, so an incident that began before `--since` contributes only the part inside the report.

MTTR includes resolved incidents only. Open incidents contribute to availability and longest-outage
calculations through the report's `--until` boundary but do not contribute to MTTR.

History can only describe checks that were recorded. If the monitor process was not running, the
absence of records is not treated as either healthy or unhealthy time.

## Portable report dashboard

Generate the JSON history report, then render it with the standard report command:

```bash
selector monitor history monitor.yaml --since 30d
selector report .selector-artifacts --title "30-day selector health"
```

The portable HTML report adds a **Selector health trends** section containing overall metrics,
per-target summaries, daily trends, and incident history. Interactive reports can filter by healthy
or unhealthy days, open or resolved incidents, and incident severity.

## Retention and pruning

Remove old records without touching current incident state:

```bash
selector monitor prune-history monitor.yaml --before 90d
```

Or use an exact timestamp:

```bash
selector monitor prune-history monitor.yaml \
  --before 2026-01-01T00:00:00Z
```

Pruning rewrites the history file atomically. Back up the file before a large retention change.

## Operational guidance

- Store history on persistent storage, not inside an ephemeral container layer.
- Permit only the service account to read the file; the toolkit creates it with mode `0600`.
- Back up state and history together so incident state and long-term trends remain consistent.
- Run pruning during low activity and avoid running multiple prune processes concurrently.
- Use the external watchdog described in the Outside Access manual for total host failures. A local
  monitor cannot record checks while the host itself is offline.
