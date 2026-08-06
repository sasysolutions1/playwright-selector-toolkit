# Getting started

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- A Playwright-managed browser or an explicit browser executable

## Install

```bash
npm install --save-dev playwright-selector-toolkit
npx playwright install chromium
```

For toolkit development:

```bash
git clone https://github.com/sasysolutions1/playwright-selector-toolkit.git
cd playwright-selector-toolkit
npm ci
npm run build
```

## First health check

```bash
npx selector doctor --strict
```

## Discover a page

```bash
npx selector discover https://example.com
```

The command creates a timestamped artifact run containing a redacted DOM snapshot.

## Generate locator recommendations

```bash
npx selector locators https://example.com --minimum-score 65
```

## Validate a selector manifest

Create `selectors/login.yaml`:

```yaml
schemaVersion: '1.0'
name: Login page
url: https://example.com/login
selectors:
  - id: email
    locator:
      type: label
      value: Email
    assertions:
      count: 1
      visible: all
      enabled: all
      editable: all

  - id: submit
    locator:
      type: role
      role: button
      name: Sign in
    assertions:
      count: 1
      visible: all
      enabled: all
```

Run:

```bash
npx selector validate selectors/login.yaml
```

When a required selector fails, create a review-only repair proposal:

```bash
npx selector repair selectors/login.yaml --fail-on-unresolved
```

The command never changes the source manifest. Review the generated JSON evidence and YAML proposal, validate approved changes, and update the production manifest intentionally.

## Save and compare a baseline

```bash
npx selector baseline save login-page https://example.com/login
npx selector compare login-page https://example.com/login --fail-on-drift
```

## Build a portable report

```bash
npx selector report .selector-artifacts --title "Selector health"
```

## Authenticated pages

Use a trusted plugin rather than placing credentials in a manifest. See
[Authenticated workflows](authenticated-workflows.md) and the executable
[sample application](sample-application.md).
