# Release and maintenance

The complete public-package workflow is documented in [publishing.md](publishing.md).

## Local release gate

```bash
npm ci
npm run release:check
```

The gate runs formatting, linting, strict TypeScript, 196 unit tests, the build, compatibility and
security reviews, dependency audit, public API checks, reproducible package verification, clean
installation, CLI execution, and CycloneDX/SPDX SBOM generation.

## Versioning

The toolkit follows semantic versioning. JSON artifact schema versions are independent from the npm
package version and change only when a report format changes incompatibly.

## Release controls

- Protect the default branch and `v*` tags.
- Require CI, browser smoke, CodeQL, and package-review jobs.
- Protect the `npm` GitHub environment.
- Publish through npm trusted publishing rather than a long-lived automation token.
- Review the generated tarball, package-verification report, and SBOMs.
- Keep baseline changes and selector-repair proposals human-reviewed.

## Dependency maintenance

Dependabot checks npm and GitHub Actions weekly. Playwright upgrades must pass the entire Chromium
smoke suite and persistent-profile tests before merge.
