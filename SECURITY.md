# Security Policy

## Supported versions

During pre-1.0 development, only the newest released minor version receives security fixes. Node.js
22.14+ and Node.js 24 are the tested runtime lines.

## Reporting a vulnerability

Do not open a public issue containing credentials, cookies, browser storage, private DOM snapshots,
or other sensitive material. Use GitHub private vulnerability reporting when it is enabled for the
repository, or contact the repository owner privately through GitHub.

Include the affected version, reproduction steps, impact, and a minimal sanitized example. Do not
include live credentials or unredacted user data.

## Sensitive artifacts

Discovery reports, traces, screenshots, storage state, and DOM snapshots may contain personal or
confidential information. Store them outside source control, apply redaction, limit retention, and
review them before sharing.

## Trusted code boundary

Plugins execute with the same operating-system permissions as the toolkit and are not sandboxed.
Install and load only reviewed plugin code. The toolkit does not bypass CAPTCHA, MFA, account locks,
or access controls.
