# npm publishing and provenance

## Local release review

```bash
npm ci
npm run release:check
```

This runs static checks, tests, a production build, compatibility and security reviews, dependency
audit, public API verification, two reproducible `npm pack` builds, clean package installation, CLI
execution, and CycloneDX/SPDX SBOM generation.

Generated release files are written under `release/` and are excluded from source control.

## First npm publication

Trusted publishing can only be configured in npm package settings after the package exists. For the
initial bootstrap publication:

1. sign in to npm with an account protected by MFA;
2. run `npm run release:check`;
3. inspect `release/package-verification.json` and the tarball;
4. run `npm publish --access public --ignore-scripts` locally;
5. configure the package's npm trusted publisher for:
   - owner: `sasysolutions1`
   - repository: `playwright-selector-toolkit`
   - workflow filename: `release.yml`
   - optional GitHub environment: `npm`;
6. revoke any automation token created for bootstrap publication.

## Subsequent releases

1. update the version and changelog;
2. merge only after CI, browser smoke, CodeQL, and package review pass;
3. create and push the matching tag, such as `v0.16.0`;
4. `.github/workflows/release.yml` verifies the tag, runs `release:check`, creates GitHub
   provenance and SBOM attestations, uploads release artifacts, and publishes through npm OIDC.

The workflow requires GitHub-hosted runners and `id-token: write`. Protect the `npm` GitHub
environment and release tags before publishing.

## Verification

Consumers can verify the GitHub artifact attestation with GitHub CLI:

```bash
gh attestation verify playwright-selector-toolkit-0.16.0.tgz \
  --repo sasysolutions1/playwright-selector-toolkit
```

The npm package page should also display npm provenance after a public-package publish from the
public GitHub repository through trusted publishing.
