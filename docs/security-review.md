# Security review

Run the repository-aware review with:

```bash
npm run build
selector security audit
selector --json security audit
selector security audit --strict
```

The review checks:

- public-package and `publishConfig.access` settings;
- the explicit npm file allowlist;
- absence of `preinstall`, `install`, and `postinstall` hooks;
- `.npmrc` credential safety;
- lockfile integrity metadata;
- license and security-policy presence;
- repository identity;
- high-confidence private-key and access-token patterns.

The scanner intentionally favors precision over broad entropy matching. It is not a substitute for
GitHub secret scanning, CodeQL, dependency review, or manual security review.

CI also runs:

```bash
npm audit --audit-level=high
```

Plugins remain trusted code and are not sandboxed. Never install or load an unreviewed plugin in a
process that has access to credentials, browser profiles, or private artifacts.
