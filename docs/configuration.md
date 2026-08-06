# Configuration

## Resolution order

Configuration is merged from four layers, with later layers taking precedence:

1. Built-in defaults
2. The nearest discovered JSON or YAML configuration file
3. `SELECTOR_*` environment variables
4. Shared CLI flags

The resolved configuration is available through both the CLI and library API:

```bash
selector config
selector config --json
```

```ts
import { resolveToolkitConfig } from 'playwright-selector-toolkit';

const resolved = await resolveToolkitConfig({ cwd: process.cwd() });
```

## Defaults

| Setting               | Default               |
| --------------------- | --------------------- |
| `artifactsDir`        | `.selector-artifacts` |
| `browser`             | `chromium`            |
| `headless`            | `true`                |
| `timeoutMs`           | `30000`               |
| `navigationTimeoutMs` | `45000`               |
| `viewport.width`      | `1440`                |
| `viewport.height`     | `900`                 |
| `trace`               | `retain-on-failure`   |
| `screenshots`         | `on-failure`          |

## Supported files

The discovery process walks upward from `cwd` and selects the first supported file in each
folder using this order:

```text
selector.config.json
selector.config.yaml
selector.config.yml
.selectorrc.json
.selectorrc.yaml
.selectorrc.yml
```

Pass `--config` to disable discovery and require a specific file:

```bash
selector --config ./automation/selector.config.yaml config
```

A missing explicit file produces a structured `CONFIG_NOT_FOUND` error.

## Schema

```yaml
artifactsDir: string
browser: chromium | firefox | webkit
headless: boolean
timeoutMs: integer from 100 through 300000
navigationTimeoutMs: integer from 100 through 600000
viewport:
  width: integer from 320 through 10000
  height: integer from 240 through 10000
trace: off | on | retain-on-failure
screenshots: off | always | on-failure
baseUrl: absolute URL
userDataDir: string
storageStatePath: string
executablePath: string
```

Unknown fields are rejected instead of silently ignored.

## Relative paths

- Config-file paths are relative to the directory containing the config file.
- Environment and CLI paths are relative to `cwd`.
- `cwd` defaults to `process.cwd()` and can be replaced with `--cwd`.

## Environment variables

Boolean values accept `true`, `false`, `1`, `0`, `yes`, `no`, `on`, and `off`.

```bash
export SELECTOR_BROWSER=firefox
export SELECTOR_HEADLESS=false
export SELECTOR_TIMEOUT_MS=45000
export SELECTOR_VIEWPORT_WIDTH=1600
export SELECTOR_VIEWPORT_HEIGHT=1000
selector config
```

## Structured errors

Configuration failures use stable codes:

| Code                  | Meaning                                    |
| --------------------- | ------------------------------------------ |
| `CONFIG_NOT_FOUND`    | Explicit configuration file is missing     |
| `CONFIG_READ_FAILED`  | File cannot be read                        |
| `CONFIG_PARSE_FAILED` | JSON or YAML syntax is invalid             |
| `CONFIG_INVALID`      | Parsed or merged values violate the schema |

When `--json` is present, CLI failures are emitted as machine-readable JSON.

## Browser session fields

```yaml
navigationTimeoutMs: 45000
userDataDir: ./.browser-profile
storageStatePath: ./.auth/storage-state.json
# executablePath: /usr/bin/chromium
```

`userDataDir` enables a persistent profile. `storageStatePath` is loaded if it exists and is saved
on graceful shutdown. Both paths are resolved using the same file/environment/CLI rules as the
artifact directory.

Environment additions:

```text
SELECTOR_NAVIGATION_TIMEOUT_MS
SELECTOR_STORAGE_STATE_PATH
SELECTOR_EXECUTABLE_PATH
```
