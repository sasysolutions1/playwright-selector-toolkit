export default {
  apiVersion: '1',
  name: 'demo-workflow-plugin',
  version: '1.0.0',
  description: 'Demonstrates authentication, page-state, redaction, and locator hooks.',
  authentication: [
    {
      id: 'fixture-login',
      async run({ page }) {
        const form = page.locator('#login-form:visible');
        if ((await form.count()) === 0) return { handled: false };
        await page.getByLabel('Username').fill('demo');
        await page.getByLabel('Password').fill('selector');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.locator('#dashboard:visible').waitFor();
        return { handled: true, authenticated: true };
      },
    },
  ],
  pageStateDetectors: [
    {
      id: 'dashboard',
      async detect({ page }) {
        return (await page.locator('#dashboard:visible').count()) === 1
          ? { id: 'dashboard', label: 'Authenticated dashboard', confidence: 1 }
          : false;
      },
    },
  ],
  redactors: [
    {
      id: 'account-identifiers',
      redactText(value) {
        return value.replace(/ACCOUNT-\d+/gu, '[PLUGIN_ACCOUNT]');
      },
    },
  ],
  locatorCandidateGenerators: [
    {
      id: 'data-qa',
      generate(element) {
        const value = element.attributes['data-qa'];
        return value === undefined
          ? []
          : [
              {
                spec: { type: 'css', selector: `[data-qa="${value}"]` },
                priority: 8,
                rationale: 'Uses the application-specific data-qa hook.',
              },
            ];
      },
    },
  ],
};
