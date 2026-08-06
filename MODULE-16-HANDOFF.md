# Module 16 handoff

## Scope

Compatibility review, repository security review, reproducible package verification, SBOMs,
Dependabot, CodeQL, provenance attestations, and npm trusted-publishing automation.

## Validate

```bash
npm ci
npm run check
npm run build
npm run compatibility
npm run security:review
npm run security:audit
npm run api:check
npm run package:verify
npm run sbom
```

## Suggested commit

```bash
git add -A
git commit -m "Add secure package release automation"
git push
```

## Manual configuration still required

The repository owner must bootstrap the package on npm, configure the trusted publisher, protect the
`npm` GitHub environment and release tags, and enable repository security settings.
