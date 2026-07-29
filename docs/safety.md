# Authorized-use boundary

Use the toolkit only on pages and accounts you own or are authorized to test.
It helps replace brittle selectors with maintainable locators; it is not a
mechanism for evading access controls.

- Do not use it to bypass CAPTCHA, MFA, rate limits, authorization checks, or
  account-recovery controls.
- Keep secrets, session state, personal data, and captured page content out of
  logs and issue reports.
- Prefer a service API when one exists. Browser automation should fail closed
  when a required element or authorization boundary changes.
- Treat a zero-match or multi-match validation result as a release failure.
  Do not silently add `nth()` or a long DOM path merely to make a run continue.
- Revalidate selectors against representative accessible and localized pages.
