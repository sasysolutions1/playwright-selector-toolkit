# Module 16 — Release hardening

Module 16 prepares the toolkit for secure public distribution.

## Delivered

- Node.js 22/24 compatibility matrix and `selector compatibility`.
- Repository security review and `selector security audit`.
- Reproducible npm tarball verification.
- Clean-install import and CLI verification.
- Public API declaration checks.
- CycloneDX and SPDX SBOM generation.
- Dependabot for npm and GitHub Actions.
- CodeQL JavaScript/TypeScript analysis.
- OIDC npm trusted-publishing workflow.
- GitHub provenance and SBOM attestations.
- Release-tag/version verification.

## Required owner configuration

- Publish the package once to establish the npm package name.
- Configure npm trusted publishing for `release.yml`.
- Protect the GitHub `npm` environment and release tags.
- Enable private vulnerability reporting, Dependabot alerts, and branch protection in repository settings.

## Validation

```bash
npm ci
npm run release:check
```
