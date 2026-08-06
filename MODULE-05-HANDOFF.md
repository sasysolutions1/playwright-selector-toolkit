# Module 5 Handoff — Locator Candidate Generation

Version: `0.5.0`

## Added

- `selector locators` command.
- Role, label, placeholder, test-ID, text, attribute, CSS, and XPath candidates.
- Safe JavaScript, CSS, and XPath serialization.
- Frame-aware live count, visibility, and enabled-state checks.
- Open-shadow-root support through Playwright semantic/CSS locators.
- Redaction-aware candidate omission.
- Versioned JSON locator reports.
- Unit, CLI, workflow, and real Chromium coverage.

## Suggested commit

```bash
git add -A
git commit -m "Add locator candidate generation and live testing"
git push
```

## Next module

Module 6 adds stability heuristics, ambiguity penalties, confidence scores, and final ranking.
