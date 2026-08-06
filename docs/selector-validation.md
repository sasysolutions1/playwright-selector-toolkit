# Selector Validation

Module 7 adds executable selector contracts for live Playwright pages. A manifest declares each
required or optional selector, its frame, and the state assertions that must hold.

## Command

```bash
selector validate selectors.yaml
selector validate selectors.yaml https://example.com
selector validate selectors.json --report-file reports/login-validation.json --json
```

URL precedence is:

```text
CLI URL > manifest url > configured baseUrl
```

Exit codes:

- `0`: every required selector passed; optional failures may be present.
- `1`: one or more required selectors failed or errored.
- `2`: invalid command, manifest, target URL, or report path.

## Manifest format

```yaml
schemaVersion: '1.0'
name: Login page
url: https://example.com/login
waitUntil: domcontentloaded
selectors:
  - id: email
    name: Email input
    required: true
    framePath: main
    locator:
      type: label
      value: Email
      exact: true
    assertions:
      count: 1
      visible: all
      enabled: all
      editable: all

  - id: optional-promotion
    required: false
    locator:
      type: css
      selector: .promotion
    assertions:
      count:
        min: 0
        max: 1
```

Selector IDs must be unique. `required` defaults to `true`, `framePath` defaults to `main`, and
`assertions.count` defaults to exactly one match.

## Locator specifications

The manifest uses structured locators rather than evaluating arbitrary JavaScript:

```yaml
locator: { type: role, role: button, name: Save, exact: true }
locator: { type: label, value: Email, exact: true }
locator: { type: placeholder, value: Search, exact: true }
locator: { type: text, value: Welcome, exact: true }
locator: { type: test-id, attribute: data-testid, value: save }
locator: { type: css, selector: '#save' }
locator: { type: attribute, selector: '[aria-label=Save]' }
locator: { type: xpath, selector: "//button[@type='submit']" }
```

## Assertions

`count` accepts an exact number or a range:

```yaml
count: 1
count: { min: 1 }
count: { max: 3 }
count: { min: 1, max: 3 }
```

`visible`, `enabled`, and `editable` accept:

- `any`: at least one matching element has the state.
- `all`: every matching element has the state and at least one match exists.
- `none`: no matching element has the state.

Every validation writes `reports/selector-validation.json` inside a timestamped artifact run. Failed
validations are treated as unsuccessful browser sessions, allowing retain-on-failure traces and
screenshots to be preserved automatically.

## CI

```yaml
- run: npx selector validate selectors/login.yaml https://staging.example.com
```

The command's exit code is designed for CI gates. Optional selectors are reported but do not fail the
job.
