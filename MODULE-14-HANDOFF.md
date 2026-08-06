# Module 14 handoff

## Scope

Module 14 turns the implemented toolkit into an adoptable open-source project with complete adoption
documentation and executable integration examples.

## New validation commands

```bash
npm run smoke:sample-app
npm run smoke:outside-access
npm run smoke:all
```

## Commit suggestion

```bash
git add -A
git commit -m "Add documentation and integration examples"
```

## Important boundary

The Outside Access example contains no live Securus selectors or credentials. Live selector mapping
must be performed with an authorized account and reviewed before production use.
