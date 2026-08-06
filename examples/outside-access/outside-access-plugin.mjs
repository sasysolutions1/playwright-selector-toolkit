function env(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

async function visible(page, selector) {
  return selector ? (await page.locator(selector).filter({ visible: true }).count()) > 0 : false;
}

export default {
  apiVersion: '1',
  name: 'outside-access-channel-health',
  version: '1.0.0',
  description: 'Safe authentication and page-state hooks for an authorized regular-user channel.',

  authentication: [
    {
      id: 'regular-user-login',
      async run({ page }) {
        const challengeText = page.getByText(
          /captcha|verify you are human|verification code|multi-factor|account locked/i,
        );
        if ((await challengeText.count()) > 0) {
          throw new Error('Interactive security challenge detected; automated validation stopped');
        }

        const usernameSelector = env(
          'SECURUS_USERNAME_SELECTOR',
          'input[type="email"], input[name*="user" i]',
        );
        const passwordSelector = env('SECURUS_PASSWORD_SELECTOR', 'input[type="password"]');
        const submitSelector = env('SECURUS_SUBMIT_SELECTOR', 'button[type="submit"]');
        if (!(await visible(page, usernameSelector)) || !(await visible(page, passwordSelector))) {
          return { handled: false };
        }

        const username = process.env.SECURUS_USERNAME;
        const password = process.env.SECURUS_PASSWORD;
        if (!username || !password) {
          throw new Error('SECURUS_USERNAME and SECURUS_PASSWORD are required');
        }

        await page.locator(usernameSelector).first().fill(username);
        await page.locator(passwordSelector).first().fill(password);
        await page.locator(submitSelector).first().click();
        await page.waitForLoadState('domcontentloaded');

        if ((await challengeText.count()) > 0) {
          throw new Error(
            'Interactive security challenge detected after login; validation stopped',
          );
        }
        return { handled: true, authenticated: true };
      },
    },
  ],

  pageStateDetectors: [
    {
      id: 'security-challenge',
      order: -100,
      async detect({ page }) {
        const found =
          (await page
            .getByText(/captcha|verify you are human|verification code|multi-factor/i)
            .count()) > 0;
        return found
          ? { id: 'security-challenge', label: 'Human verification required', confidence: 1 }
          : false;
      },
    },
    {
      id: 'account-locked',
      order: -90,
      async detect({ page }) {
        const found =
          (await page.getByText(/account locked|too many attempts|contact support/i).count()) > 0;
        return found ? { id: 'account-locked', label: 'Account locked', confidence: 1 } : false;
      },
    },
    {
      id: 'inbox',
      async detect({ page }) {
        const selector = env('SECURUS_INBOX_ROOT_SELECTOR', '[data-testid*="inbox" i], main');
        return (await visible(page, selector))
          ? { id: 'inbox', label: 'Messaging inbox candidate', confidence: 0.65 }
          : false;
      },
    },
  ],

  redactors: [
    {
      id: 'resident-identifiers',
      redactText(value) {
        return value
          .replace(/\b(?:DOC|OFFENDER|RESIDENT)[- #:]*[A-Z0-9]{4,}\b/giu, '[RESIDENT_ID]')
          .replace(/\b(?:conversation|message)[- #:]*\d{5,}\b/giu, '[CHANNEL_REFERENCE]');
      },
    },
  ],

  locatorCandidateGenerators: [
    {
      id: 'automation-attributes',
      generate(element) {
        for (const attribute of ['data-testid', 'data-qa', 'data-automation-id']) {
          const value = element.attributes[attribute];
          if (value) {
            return [
              {
                spec: { type: 'css', selector: `[${attribute}="${value}"]` },
                priority: 9,
                rationale: `Uses stable ${attribute} automation metadata.`,
              },
            ];
          }
        }
        return [];
      },
    },
  ],
};
