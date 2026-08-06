# Selector repair suggestions

Module 15 adds review-only repair suggestions for failed selector-manifest entries.

The repair command does **not** edit the source manifest. It validates the existing selectors, inventories the current page, live-tests locator candidates, ranks deterministic replacements, and writes:

- `reports/selector-repair.json`
- `reports/selector-repair-proposal.yaml`

The YAML file is a proposal. A developer must review it, validate it against the page, and intentionally replace the source manifest.

## Deterministic repair

```bash
selector repair selectors/login.yaml https://example.com/login
```

Useful options:

```bash
selector repair selectors/login.yaml https://example.com/login \
  --max-suggestions 5 \
  --minimum-score 65 \
  --include-optional \
  --fail-on-unresolved
```

The deterministic engine considers:

- Semantic overlap between the selector name, description, old locator, and current element metadata
- Frame compatibility
- Role and control-kind compatibility
- Visibility
- Editable assertions
- Live locator uniqueness
- Existing locator stability scores

Only candidates that were live-tested and uniquely matched are eligible.

## Optional OpenAI assistance

OpenAI assistance is disabled by default. It can only reorder and explain candidate IDs that the deterministic engine already generated and live-tested. It cannot invent a selector or modify files.

```bash
export OPENAI_API_KEY='...'
export SELECTOR_AI_MODEL='gpt-5-mini'

selector repair selectors/login.yaml https://example.com/login \
  --provider openai
```

Optional environment variables:

```text
OPENAI_API_KEY       required for --provider openai
SELECTOR_AI_MODEL    defaults to gpt-5-mini
OPENAI_BASE_URL      defaults to https://api.openai.com/v1
```

The implementation uses the OpenAI Responses API with strict JSON-schema output. Only sanitized selector metadata and verified candidate summaries are sent. Raw HTML, form values, credentials, cookies, browser profiles, and API keys are not included in the model prompt.

Official references:

- <https://platform.openai.com/docs/api-reference/responses>
- <https://platform.openai.com/docs/guides/structured-outputs>

## Output and approval

The JSON report records:

- Original validation failure
- Ranked suggestions
- Deterministic score and reasons
- Optional AI confidence and rationale
- Recommended suggestion ID
- Unresolved reason
- Explicit `approvalRequired: true`

The proposal begins with:

```yaml
# REVIEW REQUIRED: generated selector repair proposal.
# The original manifest was not modified. Validate and approve each change before use.
```

Recommended review sequence:

1. Inspect `selector-repair.json`.
2. Compare the old and suggested locators.
3. Run `selector validate` against the proposed YAML.
4. Review screenshots or evidence bundles when the page changed substantially.
5. Copy approved locator changes into the source manifest.
6. Commit the source-manifest update separately.

## Exit codes

- `0` — suggestions were generated, even when some selectors remain unresolved
- `1` — `--fail-on-unresolved` was supplied and required selectors remain unresolved
- `2` — invalid arguments, manifest, provider configuration, or output paths

## Security boundary

The toolkit does not:

- Apply repairs automatically
- Execute model-generated selectors
- Send raw page HTML to an AI provider
- Bypass CAPTCHA, MFA, account locks, or access controls
- Include credentials or secret form values in repair requests
