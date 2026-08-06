import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { buildHtmlReport } from '../../dist/index.js';

const cwd = await mkdtemp(join(tmpdir(), 'selector-html-report-smoke-'));
const runRoot = join(cwd, 'evidence-run');
const generatedAt = '2026-07-18T12:00:00.000Z';
try {
  await mkdir(join(runRoot, 'reports'), { recursive: true });
  await mkdir(join(runRoot, 'screenshots'), { recursive: true });
  await writeFile(join(runRoot, 'run.json'), '{}');
  await writeFile(
    join(runRoot, 'screenshots', 'viewport.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n1cAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  const discovery = {
    schemaVersion: '1.0',
    toolkitVersion: '0.11.0',
    capturedAt: generatedAt,
    requestedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    title: 'Report fixture',
    options: {
      scope: 'interactive',
      includeHidden: false,
      maxElements: 10,
      maxFrameDepth: 2,
      textLimit: 100,
      redact: true,
    },
    summary: {
      frameCount: 1,
      failedFrameCount: 0,
      shadowRootCount: 0,
      inspectedElementCount: 1,
      matchedElementCount: 1,
      visibleElementCount: 1,
      hiddenElementCount: 0,
      interactiveElementCount: 1,
      sensitiveElementCount: 0,
      redactionCount: 0,
      truncated: false,
      kinds: { button: 1 },
    },
    frames: [
      {
        path: 'main',
        parentPath: null,
        depth: 0,
        index: 0,
        name: null,
        url: 'https://example.com/',
        title: 'Fixture',
        language: 'en',
        readyState: 'complete',
        shadowRootCount: 0,
        inspectedElementCount: 1,
        matchedElementCount: 1,
        truncated: false,
        elements: [
          {
            id: 'one',
            framePath: 'main',
            shadowPath: [],
            domPath: 'body > button',
            tagName: 'button',
            kind: 'button',
            role: 'button',
            accessibleName: 'Submit',
            text: 'Submit',
            label: null,
            placeholder: null,
            attributes: { id: 'submit' },
            visibility: { visible: true, reason: 'visible', inViewport: true, boundingBox: null },
            interactive: true,
            interactivitySources: ['native-control'],
            disabled: false,
            readonly: false,
            required: false,
            checked: null,
            selected: null,
            sensitive: false,
            redactionsApplied: 0,
          },
        ],
      },
    ],
    failures: [],
    warnings: [],
  };
  const locators = {
    schemaVersion: '1.1',
    toolkitVersion: '0.11.0',
    generatedAt,
    requestedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    title: 'Fixture',
    options: {
      maxCandidatesPerElement: 8,
      includeXPath: true,
      includeRoleWithoutName: false,
      testIdAttributes: ['data-testid'],
      liveTest: true,
      minimumRecommendedScore: 60,
    },
    domSummary: discovery.summary,
    summary: {
      elementCount: 1,
      candidateCount: 1,
      testedCandidateCount: 1,
      uniqueCandidateCount: 1,
      multipleCandidateCount: 0,
      missingCandidateCount: 0,
      errorCandidateCount: 0,
      elementsWithUniqueCandidate: 1,
      elementsWithoutCandidates: 0,
      strategies: { role: 1 },
      recommendedLocatorCount: 1,
      elementsWithRecommendation: 1,
      elementsWithoutRecommendation: 0,
      highConfidenceCandidateCount: 1,
      mediumConfidenceCandidateCount: 0,
      lowConfidenceCandidateCount: 0,
      averageStabilityScore: 95,
    },
    elements: [],
    failures: [],
    warnings: [],
    recommendations: [
      {
        elementId: 'one',
        elementKind: 'button',
        framePath: 'main',
        playwright: "page.getByRole('button', { name: 'Submit' })",
        strategy: 'role',
        score: 95,
        confidence: 'high',
      },
    ],
  };
  const validation = {
    schemaVersion: '1.0',
    toolkitVersion: '0.11.0',
    generatedAt,
    manifestPath: 'selectors.yaml',
    manifestName: 'Fixture selectors',
    requestedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    title: 'Fixture',
    summary: {
      total: 1,
      required: 1,
      optional: 0,
      passed: 1,
      failed: 0,
      errors: 0,
      requiredFailures: 0,
      optionalFailures: 0,
      success: true,
    },
    results: [
      {
        id: 'submit',
        name: 'Submit',
        required: true,
        framePath: 'main',
        locator: { type: 'role', role: 'button', name: 'Submit', exact: true },
        playwright: "page.getByRole('button', { name: 'Submit' })",
        status: 'pass',
        observed: { count: 1, visibleCount: 1, enabledCount: 1, editableCount: 0, durationMs: 1 },
        assertions: [],
        error: null,
      },
    ],
    warnings: [],
  };
  const comparison = {
    schemaVersion: '1.0',
    toolkitVersion: '0.11.0',
    generatedAt,
    baseline: {
      name: 'fixture',
      version: 'v1',
      capturedAt: generatedAt,
      finalUrl: 'https://example.com/',
      title: 'Fixture',
    },
    current: { capturedAt: generatedAt, finalUrl: 'https://example.com/', title: 'Fixture' },
    options: {
      similarityThreshold: 0.65,
      includeUnchanged: false,
      maxReplacementLocators: 5,
      minimumLocatorScore: 60,
    },
    summary: {
      baselineElementCount: 1,
      currentElementCount: 1,
      matchedElementCount: 1,
      unchangedElementCount: 1,
      addedElementCount: 0,
      removedElementCount: 0,
      movedElementCount: 0,
      changedElementCount: 0,
      movedAndChangedElementCount: 0,
      driftElementCount: 0,
      driftDetected: false,
      matchMethods: { structural: 1, semantic: 0, similarity: 0 },
    },
    differences: [],
    warnings: [],
  };
  const diagnostics = {
    schemaVersion: '1.0',
    toolkitVersion: '0.11.0',
    createdAt: generatedAt,
    success: true,
    requestedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    title: 'Fixture evidence',
    navigation: null,
    metadata: null,
    recorder: {
      schemaVersion: '1.0',
      capturedAt: generatedAt,
      console: [],
      pageErrors: [],
      requestFailures: [],
      httpErrors: [],
      summary: {
        consoleEntryCount: 0,
        pageErrorCount: 0,
        requestFailureCount: 0,
        httpErrorCount: 0,
        droppedConsoleEntries: 0,
        droppedPageErrors: 0,
        droppedRequestFailures: 0,
        droppedHttpErrors: 0,
        redactionCount: 0,
      },
    },
    screenshots: {
      artifacts: [
        {
          kind: 'viewport',
          path: join(runRoot, 'screenshots', 'viewport.png'),
          selector: null,
          matchIndex: null,
          width: 1,
          height: 1,
        },
      ],
      failures: [],
    },
    files: {
      metadata: 'reports/page-metadata.json',
      events: 'reports/events.json',
      domSnapshot: null,
      htmlSnapshot: null,
      htmlFrames: [],
      screenshots: ['screenshots/viewport.png'],
      trace: null,
    },
    failure: null,
    warnings: [],
  };
  await writeFile(join(cwd, 'discovery.json'), JSON.stringify(discovery));
  await writeFile(join(cwd, 'locators.json'), JSON.stringify(locators));
  await writeFile(join(cwd, 'validation.json'), JSON.stringify(validation));
  await writeFile(join(cwd, 'comparison.json'), JSON.stringify(comparison));
  await writeFile(
    join(runRoot, 'reports', 'diagnostic-evidence.json'),
    JSON.stringify(diagnostics),
  );

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
  };
  const result = await buildHtmlReport(
    config,
    ['discovery.json', 'locators.json', 'validation.json', 'comparison.json', runRoot],
    { title: 'Portable smoke report' },
  );
  const html = await readFile(result.reportPath, 'utf8');
  assert.equal(result.manifest.sourceCount, 5);
  assert.equal(result.manifest.embeddedImageCount, 1);
  assert.ok(html.includes('data:image/png;base64,'));
  assert.ok(!html.includes('<script src='));
  assert.ok(html.includes('data-dashboard-controls'));
  assert.ok(html.includes('Interactive controls run entirely offline'));
  assert.ok(!html.includes('<link rel='));

  const executablePath = process.env.SELECTOR_EXECUTABLE_PATH;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setContent(html, { waitUntil: 'load' });
    assert.equal(await page.locator('h1').textContent(), 'Portable smoke report');
    assert.equal(await page.locator('section').count(), 5);
    assert.equal(await page.locator('img').count(), 2);
    assert.equal(await page.locator('[data-dashboard-controls]').count(), 1);
    assert.equal(errors.length, 0);
  } finally {
    await browser.close();
  }
  process.stdout.write(
    `${JSON.stringify({ ok: true, reportPath: result.reportPath, sources: result.manifest.sourceCount, embeddedImages: result.manifest.embeddedImageCount }, null, 2)}\n`,
  );
} finally {
  await rm(cwd, { recursive: true, force: true });
}
