# Artifact directories

Browser automation creates screenshots, DOM snapshots, traces, and reports. Module 2 provides a
single standardized manager so later modules do not invent incompatible layouts.

## Create a run

```bash
selector artifacts init --name login-page
```

Example layout:

```text
.selector-artifacts/
└── 2026-07-17T12-34-56-000Z-artifacts-init-12345678-login-page/
    ├── run.json
    ├── reports/
    ├── screenshots/
    ├── snapshots/
    └── traces/
```

The run name includes:

- An ISO timestamp safe for filenames
- The command name
- An eight-character identifier prefix
- An optional sanitized human name

## Library usage

```ts
import { createArtifactRun, writeJsonArtifact } from 'playwright-selector-toolkit';

const run = await createArtifactRun(config, {
  command: 'validate',
  name: 'checkout',
});

await writeJsonArtifact(run, 'reports/summary.json', {
  passed: 10,
  failed: 1,
});
```

`resolveArtifactPath` and `writeJsonArtifact` reject attempts to escape the run directory through
`../` paths.

## Metadata

`run.json` records:

- Run ID
- Command
- Optional name
- Creation timestamp
- Browser
- Headless setting
- Timeout
- Viewport

Later modules will append command-specific details to reports rather than modifying this base
metadata contract.
