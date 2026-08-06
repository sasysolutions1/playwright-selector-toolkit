export default {
  apiVersion: '1',
  name: 'sample-application-workflow',
  version: '1.0.0',
  description: 'Authenticates and extends the local sample application.',

  authentication: [
    {
      id: 'sample-login',
      async run({ page }) {
        const form = page.locator('#login-form:visible');
        if ((await form.count()) === 0) return { handled: false };
        await page.getByLabel('Username').fill(process.env.SAMPLE_APP_USERNAME ?? 'demo');
        await page.getByLabel('Password').fill(process.env.SAMPLE_APP_PASSWORD ?? 'selector');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
        return { handled: true, authenticated: true };
      },
    },
  ],

  pageStateDetectors: [
    {
      id: 'dashboard',
      async detect({ page }) {
        return (await page.getByRole('heading', { name: 'Dashboard' }).count()) === 1
          ? { id: 'dashboard', label: 'Sample dashboard', confidence: 1 }
          : false;
      },
    },
  ],

  redactors: [
    {
      id: 'customer-identifiers',
      redactText(value) {
        return value.replace(/CUSTOMER-\d+/gu, '[CUSTOMER]');
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
                rationale: 'Uses the sample application data-qa convention.',
              },
            ];
      },
    },
  ],
};
