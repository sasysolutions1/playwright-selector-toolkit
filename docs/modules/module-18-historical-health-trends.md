# Module 18 handoff — historical health trends

Version: `0.18.0`

## Delivered

- append-only JSONL history for every due monitor check;
- automatic recording in `monitor run` and `monitor watch`;
- `--history-file` and `--no-history` controls;
- `selector monitor history` aggregation;
- ISO and relative time windows;
- target filtering;
- pass rate and estimated availability;
- incident duration, MTTR, MTBF, and longest outage;
- average, p50, and p95 check durations;
- daily trend buckets;
- atomic retention pruning;
- portable HTML trend sections and dashboard facets;
- public TypeScript history APIs;
- unit, CLI, report, and real Chromium smoke coverage.

## Commit suggestion

```bash
git add -A
git commit -m "Add historical selector health trends"
```

## Next module

Module 19 should focus on the version 1.0 release candidate: API review, documentation freeze,
migration notes, and end-to-end installation validation.
