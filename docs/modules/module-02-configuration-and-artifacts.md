# Module 2 — Configuration, structured errors, and artifacts

## Purpose

Module 2 creates the shared infrastructure used by every future browser command. It provides one
configuration contract, one precedence model, stable error codes, and one artifact layout.

## Implemented

- Shared CLI options for config path, working directory, artifacts, browser, headless mode,
  timeout, viewport, traces, screenshots, base URL, browser profile, and JSON output.
- Upward JSON/YAML config discovery.
- Strict Zod schema validation with unknown-field rejection.
- Environment-variable parsing and validation.
- Deterministic defaults/file/environment/CLI precedence.
- Relative-path resolution based on source layer.
- `selector config` human and JSON output.
- Structured `ToolkitError`, `ConfigError`, and `ArtifactError` classes.
- Machine-readable error reports with stable error codes and exit codes.
- Timestamped artifact runs with screenshots, snapshots, traces, and reports directories.
- `run.json` metadata.
- Artifact traversal protection.
- Doctor validation of the resolved artifact directory.

## Validation completed

```text
Formatting: passed
ESLint: passed
TypeScript strict typecheck: passed
Vitest: 6 files, 17 tests passed
Production build: passed
npm package dry run: passed
Clean-extraction npm ci: passed
Clean-extraction full check: passed
CLI config output: passed
CLI artifact initialization: passed
```

## Suggested commit

```bash
git add -A
git commit -m "Add shared configuration and artifact management"
```

## Next module

Module 3 adds a typed Playwright browser/session manager with ephemeral and persistent contexts,
storage-state support, configurable browsers, trace lifecycle management, and safe shutdown.
