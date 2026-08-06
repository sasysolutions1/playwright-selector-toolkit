# Contributing

Thank you for contributing to Playwright Selector Toolkit.

## Local setup

```bash
npm install
npm run check
npm run build
```

## Pull requests

- Keep each pull request focused on one module or fix.
- Include tests for changed behavior.
- Update the README, documentation, and changelog when public behavior changes.
- Do not commit browser profiles, credentials, cookies, traces containing private data, or `.env`
  files.
- Use conventional, concise commit messages such as `Add DOM crawler`.

## Code standards

- TypeScript strict mode is required.
- Public APIs must have exported types.
- Avoid hidden process exits in reusable library code; return explicit results and let the CLI
  select the exit code.
- Browser automation must fail closed when page state is ambiguous.
