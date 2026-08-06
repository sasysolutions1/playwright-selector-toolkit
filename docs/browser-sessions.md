# Browser and Session Management

Module 3 adds a managed Playwright lifecycle for Chromium, Firefox, and WebKit.

## Ephemeral sessions

Without `userDataDir`, the toolkit launches a browser and creates an isolated context. Cookies,
local storage, and cache are discarded when the session closes unless `storageStatePath` is set.

```yaml
browser: chromium
headless: true
timeoutMs: 30000
navigationTimeoutMs: 45000
storageStatePath: ./.auth/storage-state.json
```

When the storage-state file already exists, it is loaded into the new context. The state is saved
again during graceful shutdown. The file can contain authentication secrets and must not be
committed.

## Persistent sessions

Set `userDataDir` to launch `browserType.launchPersistentContext()`. Persistent profiles retain
cookies, local storage, cache, and browser-managed state directly in the profile directory.

```yaml
userDataDir: ./.browser-profile
storageStatePath: ./.auth/storage-state.json
```

The toolkit creates `.selector-toolkit-profile.lock` inside the profile directory. A second
process cannot use the same profile simultaneously. Same-host stale locks are reclaimed only when
the recorded PID is no longer running. Corrupt or remote-host locks fail closed.

Always use a dedicated automation profile. Do not point the toolkit at your everyday Chrome or
Edge profile.

## Traces and screenshots

Trace modes:

- `off`: do not start tracing.
- `on`: save a trace for every session.
- `retain-on-failure`: record from launch but save only when the operation fails.

Screenshot modes:

- `off`: do not capture a final screenshot.
- `always`: capture on success and failure.
- `on-failure`: capture only when an operation fails.

Traces and screenshots are written into the session's unique artifact run.

## CLI inspection

```bash
selector browser inspect https://example.com
selector --headed --trace on browser inspect https://example.com --name homepage
selector --storage-state ./.auth/state.json browser inspect https://example.com
selector --user-data-dir ./.browser-profile browser inspect https://example.com
selector browser inspect https://example.com --wait-until load --json
selector --executable-path /usr/bin/chromium browser inspect about:blank
```

The command reports the final URL, title, HTTP status when applicable, session mode, artifact
location, retained trace, screenshot, storage-state output, and shutdown warnings.

## Library API

```ts
import { openBrowserSession, registerGracefulShutdown } from 'playwright-selector-toolkit';

const session = await openBrowserSession(config, {
  command: 'custom-workflow',
  name: 'authenticated-page',
});

const unregister = registerGracefulShutdown(session);

try {
  const result = await session.navigate('https://example.com');
  console.log(result.title);
} finally {
  unregister();
  await session.close({ success: true });
}
```

`close()` is idempotent. It saves configured state, applies trace and screenshot retention rules,
closes the context and browser gracefully, and releases any persistent-profile lock.

## Custom executable

Playwright-managed browser builds are recommended. `executablePath` or `--executable-path` is
available for controlled environments that already provide a compatible browser. Custom browser
executables can behave differently from Playwright's bundled versions and should be tested in CI.

## Security

- Storage-state files and persistent profiles contain credentials.
- Keep both outside Git and restrict filesystem permissions.
- Do not share one profile across concurrent workers.
- The manager does not bypass CAPTCHA, MFA, or account restrictions.
- A trace can contain page text, network metadata, and screenshots; protect diagnostic artifacts.
