# Module 15 handoff

## Version

`0.15.0`

## Main command

```bash
selector repair selectors/login.yaml https://example.com/login
```

## Validation

```bash
npm ci
npm run check
npm run build
SELECTOR_EXECUTABLE_PATH=/usr/bin/chromium npm run smoke:repair
```

## Important behavior

- Generates review-only suggestions.
- Never modifies the input manifest.
- Requires live unique locator matches.
- Optional OpenAI assistance only ranks known candidate IDs.
- Writes JSON evidence and a YAML proposal.
