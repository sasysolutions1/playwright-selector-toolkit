export default {
  apiVersion: '1',
  name: 'environment-authentication-example',
  authentication: [
    {
      id: 'login',
      async run({ page }) {
        if ((await page.locator('form[data-login]:visible').count()) === 0) {
          return { handled: false };
        }
        const username = process.env.APP_USERNAME;
        const password = process.env.APP_PASSWORD;
        if (!username || !password) {
          throw new Error('APP_USERNAME and APP_PASSWORD are required');
        }
        await page.getByLabel('Username').fill(username);
        await page.getByLabel('Password').fill(password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
        return { handled: true, authenticated: true };
      },
    },
  ],
  pageStateDetectors: [
    {
      id: 'security-challenge',
      order: -100,
      async detect({ page }) {
        const challenge = page.getByText(
          /captcha|multi-factor|verification code|verify you are human/i,
        );
        return (await challenge.count()) > 0
          ? { id: 'security-challenge', label: 'Human verification required', confidence: 1 }
          : false;
      },
    },
  ],
};
