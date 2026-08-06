# Authenticated workflows

The toolkit supports authentication through persistent profiles, storage state, and trusted plugins.

## Recommended order

1. Prefer an isolated test account.
2. Use a persistent profile or storage state when the application supports stable sessions.
3. Use a plugin authentication hook to recover an expired session.
4. Stop safely when MFA, CAPTCHA, identity verification, or an unknown state appears.
5. Never place credentials in selector manifests, screenshots, reports, or committed config files.

## Environment-based credentials

```bash
export APP_USERNAME='test-user'
export APP_PASSWORD='test-password'
selector --plugin ./plugins/application.mjs validate selectors/dashboard.yaml https://example.com
```

## Storage state

```yaml
storageStatePath: ./.auth/storage-state.json
```

The file should be excluded from version control and protected with restrictive filesystem permissions.

## Persistent profile

```yaml
userDataDir: ./.browser-profile
```

Only one toolkit process may use a persistent profile at a time. The browser manager enforces a profile lock.

## Challenges that must not be bypassed

A plugin should detect and stop on:

- CAPTCHA or bot challenges
- MFA requiring a human-controlled factor
- account lockouts
- identity verification
- unexpected terms or consent screens
- unknown login flows

The toolkit can capture diagnostic evidence and alert a separate system, but it does not bypass these controls.

## Example

See:

- `examples/authenticated-workflow/`
- `examples/sample-app/`
- [Outside Access integration](outside-access-integration.md)
