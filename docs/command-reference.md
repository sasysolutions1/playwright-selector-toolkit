# Command reference

The executable is available as `selector` and `selector-toolkit`.

## Global options

| Option                         | Purpose                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `--config <path>`              | Use a specific JSON or YAML configuration file.                 |
| `--cwd <path>`                 | Resolve relative CLI and environment paths from this directory. |
| `--artifacts-dir <path>`       | Select the artifact root.                                       |
| `--browser <name>`             | Use `chromium`, `firefox`, or `webkit`.                         |
| `--headless` / `--headed`      | Select browser display mode.                                    |
| `--timeout <ms>`               | Set Playwright action timeout.                                  |
| `--navigation-timeout <ms>`    | Set page-navigation timeout.                                    |
| `--viewport <WxH>`             | Set the browser viewport.                                       |
| `--trace <mode>`               | `off`, `on`, or `retain-on-failure`.                            |
| `--screenshots <mode>`         | `off`, `always`, or `on-failure`.                               |
| `--user-data-dir <path>`       | Use a persistent browser profile.                               |
| `--storage-state <path>`       | Load and save Playwright storage state.                         |
| `--executable-path <path>`     | Use a controlled browser executable.                            |
| `--plugin <specifier>`         | Load a trusted plugin. Repeatable.                              |
| `--plugin-timeout <ms>`        | Limit each asynchronous plugin hook.                            |
| `--plugin-failure-mode <mode>` | `isolate` or `fail-fast`.                                       |
| `--json`                       | Emit machine-readable output.                                   |

## Project and diagnostics

```bash
selector version
selector config
selector doctor --strict
selector artifacts init --name nightly
selector plugins inspect
```

## Browser inspection

```bash
selector browser inspect https://example.com
```

## Discovery and locators

```bash
selector discover https://example.com
selector locators https://example.com --minimum-score 65
```

## Validation

```bash
selector validate selectors/login.yaml https://example.com/login
```

Exit codes:

- `0`: all required selectors passed
- `1`: a required selector failed or errored
- `2`: invalid input, manifest, or configuration

## Selector repair

```bash
selector repair selectors/login.yaml https://example.com/login
selector repair selectors/login.yaml https://example.com/login --fail-on-unresolved
```

Deterministic repair is the default. Optional OpenAI assistance may rank only locator candidates that the toolkit already generated, live-tested, and allowlisted:

```bash
OPENAI_API_KEY='...' selector repair selectors/login.yaml \
  https://example.com/login --provider openai
```

The command never edits the source manifest. It writes a JSON evidence report and a review-only YAML proposal. Exit codes:

- `0`: the proposal was generated, including proposals with unresolved selectors
- `1`: `--fail-on-unresolved` was supplied and required selectors remain unresolved
- `2`: invalid arguments, manifest, provider configuration, or output paths

See [Selector repair suggestions](selector-repair.md).

## Snapshots and baselines

```bash
selector snapshot https://example.com
selector baseline save homepage https://example.com
selector baseline list
selector baseline show homepage
```

## Comparison

```bash
selector compare homepage https://example.com
selector compare homepage https://example.com --fail-on-drift
selector compare homepage https://example.com --baseline-version <version>
```

## Scheduled monitoring

```bash
selector monitor run monitor.yaml --fail-on-unhealthy
selector monitor watch monitor.yaml
selector monitor status monitor.yaml
selector monitor history monitor.yaml --since 30d
selector monitor prune-history monitor.yaml --before 90d
```

`monitor run` and `monitor watch` append historical health records unless `--no-history` is used.
`monitor history` accepts ISO timestamps or relative durations such as `7d`, and repeatable
`--target` filters. Use `--force` to bypass target intervals and `--no-notify` for maintenance. Persistent state prevents
duplicate notifications between cron runs. See [scheduled monitoring](monitoring.md).

## Diagnostic evidence

```bash
selector evidence https://example.com --element '#submit'
```

## Reports

```bash
selector report .selector-artifacts/nightly --title "Nightly selector health"
```

Use `selector <command> --help` for command-specific flags.

## `selector compatibility`

Reviews the current Node.js/npm runtime, tested release line, package exports, CLI mappings, and build outputs.

```bash
selector compatibility
selector --json compatibility
selector compatibility --strict
```

## `selector security audit`

Reviews publish metadata, install hooks, `.npmrc`, lock integrity, repository policy files, and high-confidence secret patterns.

```bash
selector security audit
selector --json security audit
selector security audit --strict
```
