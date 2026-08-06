import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildHtmlReport, openBrowserSession, runSelectorRepair } from '../../dist/index.js';

const cwd = await mkdtemp(join(tmpdir(), 'selector-repair-smoke-'));
const manifestPath = join(cwd, 'selectors.yaml');
const html = `<!doctype html><html lang="en"><head><title>Repair Fixture</title></head><body>
<main>
<label for="email-address">Email address</label>
<input id="email-address" data-testid="login-email" name="email" type="email">
<button data-testid="login-submit" type="submit">Sign in</button>
<a href="#help">Help</a>
</main>
</body></html>`;

await writeFile(
  manifestPath,
  `schemaVersion: "1.0"
name: Repair fixture
url: about:blank
waitUntil: domcontentloaded
selectors:
  - id: email
    name: Email address field
    description: Email address input used for sign in
    required: true
    framePath: main
    locator:
      type: label
      value: Email
      exact: true
    assertions:
      count: 1
      visible: all
      enabled: all
      editable: all
  - id: submit
    name: Sign in button
    description: Primary sign in submit button
    required: true
    framePath: main
    locator:
      type: role
      role: button
      name: Log in
      exact: true
    assertions:
      count: 1
      visible: all
      enabled: all
  - id: optional-banner
    name: Optional promotion
    required: false
    framePath: main
    locator:
      type: css
      selector: .promotion-banner
    assertions:
      count:
        min: 0
        max: 1
`,
  'utf8',
);

const executablePath = process.env.SELECTOR_EXECUTABLE_PATH;
const config = {
  cwd,
  artifactsDir: join(cwd, 'artifacts'),
  browser: 'chromium',
  headless: true,
  timeoutMs: 15_000,
  navigationTimeoutMs: 30_000,
  viewport: { width: 1280, height: 900 },
  trace: 'off',
  screenshots: 'off',
  ...(executablePath === undefined ? {} : { executablePath }),
};

const session = await openBrowserSession(config, { command: 'repair-smoke' });
session.navigate = async (requestedUrl) => {
  await session.page.setContent(html, { waitUntil: 'domcontentloaded' });
  return {
    requestedUrl,
    finalUrl: 'about:blank',
    title: await session.page.title(),
    status: null,
    ok: true,
  };
};

try {
  const result = await runSelectorRepair(
    config,
    manifestPath,
    { minimumScore: 45, maxSuggestions: 3, includeOptional: false },
    { openSession: async () => session },
  );
  assert.equal(result.report.summary.requiredFailureCount, 2);
  assert.equal(result.report.summary.optionalFailureCount, 0);
  assert.equal(result.report.summary.selectorsWithRecommendation, 2);
  assert.equal(result.report.approvalRequired, true);
  assert.equal(result.report.provider, 'none');
  const proposal = await readFile(result.proposalPath, 'utf8');
  assert.match(proposal, /REVIEW REQUIRED/u);
  assert.ok(
    proposal.includes('login-email') || proposal.includes('Email address'),
    'expected an email replacement selector',
  );
  assert.ok(
    proposal.includes('login-submit') || proposal.includes('Sign in'),
    'expected a submit replacement selector',
  );
  const dashboard = await buildHtmlReport(config, [result.reportPath], {
    title: 'Repair review dashboard',
    name: 'repair-report-smoke',
  });
  const dashboardHtml = await readFile(dashboard.reportPath, 'utf8');
  assert.match(dashboardHtml, /Selector repair proposal/u);
  assert.ok(
    dashboardHtml.includes(
      'The original selector manifest was not changed. Human review and validation are required before applying this proposal.',
    ),
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        summary: result.report.summary,
        reportPath: result.reportPath,
        proposalPath: result.proposalPath,
        dashboardPath: dashboard.reportPath,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await session.close({ success: true }).catch(() => undefined);
  await rm(cwd, { recursive: true, force: true });
}
