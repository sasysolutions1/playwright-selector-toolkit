# Authenticated workflow example

Set credentials only in the environment:

```bash
export APP_USERNAME='test-user'
export APP_PASSWORD='test-password'
selector --config examples/authenticated-workflow/selector.config.yaml discover https://example.com
```

The plugin stops rather than bypassing a CAPTCHA, MFA, or human-verification page.
