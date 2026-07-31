# Auto Secure Login repository instructions

These instructions apply to every human or automated contributor working in this repository. Read them before changing code, configuration, infrastructure, content, or deployment state.

## Source-of-truth and drift control

1. Identify the current source of truth before editing. When the DigitalOcean Droplet contains a newer live release or operational record, the Droplet is authoritative.
2. Inspect and reconcile live drift immediately before deployment. Never deploy an older GitHub snapshot over newer production files.
3. Reconcile only sanitized source and documentation outward from production. Never copy production secrets, databases, logs, customer records, PHI, or runtime-only configuration into Git.
4. Keep this repository's product boundary intact. Do not copy another application wholesale into this repository or maintain competing copies of shared platform services.
5. Shared identity, messaging, ticketing, email delivery, and knowledge-agent capabilities must be consumed through their documented interfaces, not duplicated locally.

## Branch, merge, and release safety

1. Use one focused branch and one pull request per logical change. Start from a clean, current default branch.
2. Never force-push a protected/shared branch, use destructive resets, or resolve conflicts by blindly choosing all of "ours" or "theirs."
3. Resolve every conflict by comparing both sides with the current live release and the intended product boundary. Re-run validation after resolution.
4. Review the exact staged diff and run repository-specific tests, syntax checks, generated-file checks, and security scans before publication.
5. Keep release and development status distinct. Do not describe unmerged, undeployed, unaccepted, or store-pending work as live.
6. Prefer versioned releases, reversible migrations, feature flags, and bounded rollback artifacts over full-directory production copies.

## Append-only README rule

1. Before a meaningful update is complete, append or carefully extend the existing `README.md`. Create it once if absent; never truncate, regenerate over, or discard prior human-authored history.
2. Add a chronological entry with both the local America/Denver timestamp and UTC timestamp.
3. Record the outcome and reason, affected applications/services/files, user-visible and operational impact, validation and deployment evidence, source-of-truth and backup status, and remaining work, limitations, risks, or acceptance testing.
4. Include the README update in the same commit or pull request as the implementation.
5. When production is authoritative, update its operational README first and reconcile the sanitized record outward.
6. Correct old information with a dated correction or a focused edit; preserve the historical record unless the owner explicitly requests archival or removal.
7. Do not report work complete until the README entry exists, prior content is preserved, and the change has been checked for sensitive information.

## Three-copy major-release backup gate

1. For every major platform, application, infrastructure, security, content, or deployment release, create a sanitized ZIP from the verified source state.
2. Keep one copy in the local workspace `backups` directory and upload the identical ZIP to the established private Google Drive `ASL Site Backups` folder.
3. Verify and record in the README: filename, byte size, SHA-256 checksum, source commit/release identity, and Drive upload status.
4. Documentation-only corrections do not require a redundant archive; the next major release archive must include them.
5. Do not call a major update complete until the local archive, Drive copy, and README evidence are verified.

## Security and privacy boundaries

Never commit or place in ordinary backups: passwords, API keys, tokens, recovery codes, private keys, completed environment files, signing material, production databases, client records, PHI, private customer data, full personal phone numbers, logs, browser profiles, or trade-secret runtime configuration. Use placeholders in examples and approved secret storage at runtime.

## Repository identity

- Repository: `sasysolutions1/playwright-selector-toolkit`
- This repository must remain the canonical reviewed source for its own product; production may remain the operational source when explicitly documented.
- If repository-specific instructions are added later, they supplement these safeguards and must not silently weaken them.
