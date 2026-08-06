# Module 15 — AI-assisted selector repair

## Scope

Module 15 adds review-only repair proposals for failed selector manifests.

## Delivered

- `selector repair`
- Deterministic element-to-selector matching
- Live unique-candidate requirement
- Optional OpenAI Responses API advisor
- Strict JSON-schema parsing
- Candidate-ID allowlisting
- Immutable source manifests
- YAML proposal output
- JSON repair report
- Portable HTML report support
- CI-safe unresolved-selector exit behavior
- Unit and Chromium smoke coverage

## Safety guarantees

- The original manifest is never changed.
- AI output cannot introduce an unverified locator.
- Only sanitized element summaries and candidate locators are sent to the advisor.
- Human approval is always required.

## Suggested commit

```bash
git add -A
git commit -m "Add review-only selector repair suggestions"
```
