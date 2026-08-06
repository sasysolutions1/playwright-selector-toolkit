# Module 3 Handoff — Browser and Session Manager

Version: `0.3.0`

## What changed

- Added managed Chromium, Firefox, and WebKit launch.
- Added ephemeral contexts and persistent profiles.
- Added exclusive profile lock files with same-host stale-lock recovery.
- Added optional custom browser executable paths.
- Added storage-state loading and automatic saving.
- Added separate action and navigation timeouts.
- Added trace and screenshot retention policies.
- Added screenshot retry for transient capture failures.
- Added idempotent close and graceful SIGINT/SIGTERM handling.
- Added `selector browser inspect` and JSON output.
- Added public browser/session APIs for Module 4 and later modules.

## Validation

```text
Formatting: passed
ESLint: passed
Strict TypeScript: passed
Unit tests: 30 passed
Build: passed
npm package dry run: passed
Real Chromium launch: passed with system Chromium
Trace creation: passed
Screenshot creation with retry: passed
Persistent profile: passed
Storage-state save and reload: passed
Profile lock release: passed
```

The environment could not download Playwright's managed Chromium because its CDN was unavailable,
so the real-browser smoke test used `/usr/bin/chromium` through the new custom executable option.
CI installs Playwright Chromium and runs the browser smoke script.

## Suggested commit

```bash
git add -A
git commit -m "Add managed Playwright browser sessions"
git push
```

## Next module

Module 4 implements the DOM crawler: page, frame, open shadow-root, visibility, geometry,
accessibility, and redaction-aware element inventory.
