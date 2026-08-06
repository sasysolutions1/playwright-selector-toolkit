# Security and privacy

## Treat plugins as code

Plugins are not sandboxed. Review them before use and pin package versions.

## Keep secrets out of artifacts

The toolkit omits input values and applies built-in redaction, but users remain responsible for:

- using test accounts and synthetic data where possible;
- reviewing custom page content and plugin diagnostics;
- restricting artifact access;
- deleting sensitive traces after the retention period;
- keeping storage state and persistent profiles outside version control.

## Recommended permissions

```bash
chmod 700 .auth .browser-profile .selector-artifacts
chmod 600 .auth/storage-state.json
```

## URL handling

Snapshots remove query strings and fragments. Plugins can apply additional URL sanitization.

## Authentication challenges

The project does not bypass CAPTCHA, MFA, identity verification, access controls, or account locks.

## Reporting vulnerabilities

Follow [SECURITY.md](../SECURITY.md). Do not open public issues containing credentials, cookies,
private DOM snapshots, traces, or user data.

## AI-assisted repair boundary

AI assistance is disabled by default. When enabled, the repair advisor receives only sanitized selector metadata and candidate summaries that were already generated and live-tested by the toolkit. It may rank allowlisted candidate IDs, but it cannot introduce a new selector, edit the source manifest, execute a proposed locator, or approve a change.

Do not add raw HTML, form values, cookies, storage state, credentials, or browser-profile data to custom repair prompts or plugins. Review the JSON evidence and validate the generated YAML proposal before copying any locator into a production manifest.
