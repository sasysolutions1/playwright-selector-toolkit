# Outside Access integration

This integration example shows how the toolkit can be embedded in the Outside Access operational
workflow without hard-coding live Securus selectors.

## Boundary

The example does not contain current Securus DOM selectors, credentials, private URLs, CAPTCHA
bypass, MFA bypass, or undocumented network calls. Live selectors must be mapped through an
authorized regular-user account and reviewed before production use.

## Files

- `examples/outside-access/outside-access-plugin.mjs`
- `examples/outside-access/selector.config.yaml`
- `examples/outside-access/selectors.template.yaml`
- `examples/outside-access/health-check.sh`

## Plugin behavior

The plugin:

- reads credentials only from environment variables;
- detects login, inbox, CAPTCHA/MFA, account-lock, and unknown states;
- stops safely when a security challenge appears;
- redacts correctional identifiers and resident reference numbers;
- generates candidates for `data-testid`, `data-qa`, and stable automation attributes.

## Initial mapping

```bash
export SECURUS_USERNAME='...'
export SECURUS_PASSWORD='...'

selector \
  --config examples/outside-access/selector.config.yaml \
  --headed \
  discover "$SECURUS_INBOX_URL" \
  --all-elements \
  --include-hidden
```

Review the generated candidates and copy approved locators into a private selector manifest. Do not
commit credentials, cookies, storage state, resident names, message content, or live diagnostic bundles.

## Scheduled validation

```bash
examples/outside-access/health-check.sh
```

The script expects the URL and credentials through environment variables and returns a nonzero exit
code if required selectors fail. Attach the artifact directory to the existing exception-only alerting
system so unresolved failures can trigger email, SMS, and voice alerts.

## Production recommendation

Run discovery and comparison without sending messages. If selector drift is detected, pause outbound
browser automation until a reviewed manifest passes validation. This prevents a changed UI from
sending to the wrong conversation or attaching the wrong files.

## Review-only selector repair

After a scheduled validation failure, create a repair proposal without changing the private production manifest:

```bash
selector \
  --config examples/outside-access/selector.config.yaml \
  repair examples/outside-access/selectors.template.yaml "$SECURUS_INBOX_URL" \
  --minimum-score 65 \
  --fail-on-unresolved
```

Optional AI ranking can be enabled with `--provider openai`, but it is not required. The output remains review-only. Before resuming outbound automation:

1. Inspect `reports/selector-repair.json`.
2. Review every proposed locator and its live match evidence.
3. Copy only approved replacements into the private selector manifest.
4. Run `selector validate` again.
5. Resume outbound work only after all required selectors pass.

The repair workflow does not bypass CAPTCHA, MFA, account locks, or unknown page states. Those conditions must continue to pause the Outside Access worker and trigger exception alerts.

## Historical selector-health review

After the Outside Access selector monitor has accumulated records, generate a monthly trend report:

```bash
selector monitor history examples/outside-access/monitor.yaml --since 30d
selector report .selector-artifacts --title "Outside Access selector health"
```

This report helps distinguish isolated selector changes from recurring instability and provides MTTR,
longest-outage, pass-rate, and estimated-availability evidence for the operational manual.
