# Module 3 — Browser and Session Manager

Version: `0.3.0`

## Delivered

- Chromium, Firefox, and WebKit runtime selection
- Optional custom browser executable path
- Ephemeral browser contexts
- Persistent browser contexts with exclusive profile locks
- Same-host stale-lock recovery
- Storage-state loading and automatic saving
- Separate action and navigation timeouts
- Base URL and viewport configuration
- Trace lifecycle for `off`, `on`, and `retain-on-failure`
- Screenshot lifecycle for `off`, `always`, and `on-failure`
- Idempotent graceful shutdown
- SIGINT and SIGTERM shutdown registration
- `selector browser inspect`
- Human and JSON inspection reports
- Structured browser error codes

## Validation

- Unit tests cover profile locking, runtime launch options, storage state, trace retention,
  screenshot retention, navigation, idempotent close, graceful shutdown, configuration, and CLI.
- The release is additionally validated with a real headless Chromium smoke test.

## Out of scope

- DOM inventory and frame traversal begin in Module 4.
- Locator extraction and ranking are not included.
- Authentication bypass is never included.
