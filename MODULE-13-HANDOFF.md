# Module 13 Handoff — Plugin API

## Scope

Module 13 adds a trusted, typed ESM plugin system to the existing browser, DOM, locator, and artifact
pipelines.

## Included

- Plugin definition validation and API versioning
- Local-file and package-specifier loading
- Repeatable CLI, environment, JSON, and YAML configuration
- Ordered setup and reverse-order teardown
- Authentication hooks with abort signals
- Page-state detectors
- Structured DOM text and URL redactors
- Custom locator-candidate generators
- Per-plugin state and logging
- Hook timeouts and isolate/fail-fast behavior
- Versioned `reports/plugins.json` diagnostics
- `selector plugins inspect`
- Real Chromium fixture and CI smoke coverage

## Security boundary

Plugins are arbitrary trusted Node.js code and are not sandboxed. Do not load unreviewed plugins.
The toolkit does not bypass CAPTCHA, MFA, anti-automation controls, or access restrictions.
Credentials should come from environment variables or an external secret manager and must never be
written to plugin logs or artifacts.

## Validation

- Formatting, ESLint, and strict TypeScript passed
- 166 unit/integration tests passed
- Production build and npm package validation passed
- All ten Chromium smoke workflows passed
- Plugin smoke verified authentication, page-state detection, redaction, custom candidates,
  diagnostics, and clean teardown

## Suggested commit

```bash
git add -A
git commit -m "Add trusted plugin extension API"
git push
```
