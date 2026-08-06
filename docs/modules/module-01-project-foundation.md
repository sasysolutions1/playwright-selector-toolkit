# Module 1 — Project Foundation

## Purpose

Module 1 establishes a production-quality open-source TypeScript foundation for the Playwright
Selector Toolkit. It intentionally does not perform DOM discovery or selector validation yet;
those capabilities are added in later modules.

## Implemented

- Node.js 22+ package with ESM and strict TypeScript.
- Published library exports and two CLI binary names: `selector` and `selector-toolkit`.
- `version` command and `--version` flag.
- `doctor` command with human-readable and JSON output.
- Environment checks for Node.js, operating system, Playwright, Chromium, and filesystem access.
- Strict-mode doctor exit behavior suitable for CI.
- ESLint flat configuration with type-aware rules.
- Prettier formatting.
- Vitest unit and CLI tests.
- Playwright test configuration for future browser modules.
- GitHub Actions workflow.
- MIT license, security policy, contribution guide, changelog, architecture, and roadmap.

## Validation completed

```text
Formatting: passed
ESLint: passed
TypeScript strict typecheck: passed
Vitest: 3 files, 6 tests passed
Production build: passed
npm package dry run: passed
CLI version command: passed
CLI doctor JSON output: passed
CLI help output: passed
```

The browser executable check reports a warning until Chromium is installed with:

```bash
npx playwright install chromium
```

This is expected for Module 1 and does not prevent normal `doctor` success. Use `doctor --strict`
when a missing browser should fail CI.

## Suggested commit

```bash
git add -A
git commit -m "Add project foundation and environment doctor"
```

## Next module

Module 2 adds shared CLI flags, configuration-file discovery and validation, structured errors,
and a standardized artifact-directory manager.
