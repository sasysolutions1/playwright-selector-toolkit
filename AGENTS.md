# AGENTS.md — operating rules for this repository

Any agent or session working in this repository **must** follow these rules. They
exist because the Auto Secure Login platform accumulated drift — live code that was
never merged to `main`, READMEs left stale for days, parallel rebuilds on long‑lived
branches, deploys with no record of what commit was running. That must not recur.

## 1. The default branch is the source of truth — commit **and push**, every time
- `main` (the default branch) must reflect what is deployed. Never leave work only on
  the droplet, only on your local machine, or on an unmerged branch when you stop.
- Commit **and push** before ending a session. Never leave a dirty tree or a
  "finished" feature that only exists in a branch/PR.
- Deploy only from a commit that is on `main`. If you must hotfix directly on the
  server, backport it to `main` in the **same** session.

## 2. Provenance — every deploy is traceable
- The deployed release must carry a `RELEASE_SOURCE.json` at its root recording:
  `repository`, `branch`, the exact `commit`/`mainHead`, and the deploy timestamp.
- Verify provenance against the **actually running** service, not a local copy.

## 3. README — update it *with* the change, never later
- Every meaningful code / config / deploy / security change updates the README in the
  **same commit**: what changed, who it affects, validation evidence, deploy + backup
  status, and remaining work. An auditor must never have to guess. Do not defer it to
  "a docs pass later" — that pass never comes.

## 4. One track — no divergence
- Do not spawn parallel, long‑lived rebuilds of the same product. Merge feature
  branches to `main` when done and delete them. Archive superseded work under
  `archived/<name>` — never leave dangling divergent branches or a stale default
  branch (e.g. an old `master`) as the apparent source.
- The build toolchain lives locally / in‑session. **The production droplet has
  production `node_modules` only — no build tools (`tsup`, `vite`, `tsc`).** Build
  artifacts where the toolchain exists and upload them; do not assume you can build on
  the server.

## 5. Verify production, not just the merge
- A green PR merge proves nothing about live traffic. After deploying, `curl` or
  exercise the real endpoint and confirm the change is actually running. "Merged" ≠
  "deployed" ≠ "working".

## 6. Never commit secrets
- No environment files with real values, private keys, signing keystores, API tokens,
  or recovery codes. Examples/templates only — clearly named and blank.

---
*Platform tooling (Command Center) reads repository inventory and provenance. Keeping
this repo honest — main current, README current, provenance stamped, no divergence —
is what keeps the whole platform auditable.*
