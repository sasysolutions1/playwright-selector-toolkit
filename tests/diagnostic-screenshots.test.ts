import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Locator, Page } from 'playwright';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createArtifactRun } from '../src/core/artifacts/manager.js';
import { captureDiagnosticScreenshots } from '../src/core/diagnostics/screenshots.js';
import type { ToolkitConfig } from '../src/types/config.js';

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function setup() {
  const cwd = await mkdtemp(join(tmpdir(), 'selector-diagnostic-screenshots-'));
  temporaryDirectories.push(cwd);
  const config: ToolkitConfig = {
    cwd,
    artifactsDir: join(cwd, 'artifacts'),
    browser: 'chromium',
    headless: true,
    timeoutMs: 30_000,
    navigationTimeoutMs: 45_000,
    viewport: { width: 1200, height: 800 },
    trace: 'off',
    screenshots: 'off',
  };
  return createArtifactRun(config, {
    command: 'evidence',
    id: '12345678-aaaa-bbbb-cccc-123456789abc',
  });
}

describe('captureDiagnosticScreenshots', () => {
  it('captures viewport, full-page, and element screenshots while isolating missing selectors', async () => {
    const run = await setup();
    const element = {
      scrollIntoViewIfNeeded: vi.fn(async () => undefined),
      screenshot: vi.fn(async ({ path }: { path: string }) => writeFile(path, 'element')),
      boundingBox: vi.fn(async () => ({ x: 0, y: 0, width: 100, height: 40 })),
    } as unknown as Locator;
    const locator = {
      count: vi.fn(async () => 1),
      nth: vi.fn(() => element),
    } as unknown as Locator;
    const missing = {
      count: vi.fn(async () => 0),
      nth: vi.fn(),
    } as unknown as Locator;
    const page = {
      screenshot: vi.fn(async ({ path }: { path: string }) => writeFile(path, 'page')),
      viewportSize: vi.fn(() => ({ width: 1200, height: 800 })),
      locator: vi.fn((selector: string) => (selector === '#missing' ? missing : locator)),
    } as unknown as Page;

    const report = await captureDiagnosticScreenshots(page, run, {
      elements: [
        { id: 'submit', selector: '#submit' },
        { id: 'missing', selector: '#missing' },
      ],
    });

    expect(report.artifacts.map((item) => item.kind)).toEqual(['viewport', 'full-page', 'element']);
    expect(report.artifacts[2]).toMatchObject({ selector: '#submit', width: 100, height: 40 });
    expect(report.failures).toEqual([
      expect.objectContaining({ selector: '#missing', message: 'Selector matched no elements' }),
    ]);
  });
});
