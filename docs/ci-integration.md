# CI integration

## Basic validation job

```yaml
name: Selector health

on:
  workflow_dispatch:
  schedule:
    - cron: '17 8 * * *'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: >-
          node dist/cli/index.js
          --trace retain-on-failure
          --screenshots on-failure
          validate selectors/login.yaml
          https://example.com/login
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: selector-artifacts
          path: .selector-artifacts
```

## Review-only repair artifact

A failing validation job may run deterministic repair in a separate step to produce evidence for a developer. Do not commit or apply the generated YAML automatically.

```yaml
- name: Generate repair proposal
  if: failure()
  run: >-
    node dist/cli/index.js
    repair selectors/login.yaml
    https://example.com/login
    --fail-on-unresolved
  continue-on-error: true
```

Upload the repair JSON, YAML proposal, screenshots, and HTML report as CI artifacts. A developer must review the proposed locator, rerun `selector validate`, and commit an approved manifest change separately.

## Baseline drift

Store approved baselines in a protected artifact store or a dedicated repository branch. Do not
silently overwrite baselines in CI. A baseline update should be reviewed like a test change.

```bash
selector compare login-page https://example.com/login --fail-on-drift
```

## Secrets

Use GitHub Actions secrets or an OpenID Connect integration. Never commit credentials or storage state.

## Templates

Copy the examples from `examples/ci/`:

- `selector-health.yml`
- `selector.config.ci.yaml`
- `selectors/login.yaml`

The example workflow uploads diagnostic artifacts even when validation fails.
