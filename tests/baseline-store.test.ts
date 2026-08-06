import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  listBaselines,
  loadBaseline,
  saveBaseline,
  validateBaselineName,
} from '../src/core/baseline/store.js';
import type { ToolkitConfig } from '../src/types/config.js';
import type { SnapshotBundleReport } from '../src/types/snapshot.js';

function config(cwd: string): ToolkitConfig {
  return {
    cwd,
    artifactsDir: join(cwd, 'artifacts'),
    browser: 'chromium',
    headless: true,
    timeoutMs: 30_000,
    navigationTimeoutMs: 45_000,
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    screenshots: 'off',
  };
}

async function fakeReport(
  cwd: string,
  id: string,
  createdAt: string,
): Promise<SnapshotBundleReport> {
  const run = join(cwd, 'artifacts', `run-${id}`);
  for (const path of ['snapshots/html', 'reports'])
    await mkdir(join(run, path), { recursive: true });
  const files = {
    domSnapshot: 'snapshots/dom-snapshot.json',
    htmlSnapshot: 'snapshots/html-snapshot.json',
    fingerprints: 'snapshots/element-fingerprints.json',
    htmlFrames: ['snapshots/html/001-main.html'],
  } as const;
  for (const path of [
    files.domSnapshot,
    files.htmlSnapshot,
    files.fingerprints,
    ...files.htmlFrames,
  ]) {
    await writeFile(join(run, path), path.endsWith('.html') ? '<html></html>' : '{}', 'utf8');
  }
  const artifactRun = {
    id,
    command: 'snapshot',
    createdAt,
    directories: {
      root: join(cwd, 'artifacts'),
      run,
      screenshots: join(run, 'screenshots'),
      snapshots: join(run, 'snapshots'),
      traces: join(run, 'traces'),
      reports: join(run, 'reports'),
    },
    metadataPath: join(run, 'run.json'),
  };
  const manifest = {
    schemaVersion: '1.0' as const,
    toolkitVersion: '0.8.0-test',
    createdAt,
    requestedUrl: 'https://example.test',
    finalUrl: 'https://example.test/',
    title: 'Fixture',
    files,
    domSummary: {
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
    htmlSummary: {
      frameCount: 1,
      failedFrameCount: 0,
      visitedNodeCount: 3,
      serializedElementCount: 3,
      shadowRootCount: 0,
      omittedNodeCount: 0,
      omittedAttributeCount: 0,
      redactionCount: 0,
      truncatedFrameCount: 0,
    },
    fingerprintSummary: {
      elementCount: 1,
      uniqueSemanticHashCount: 1,
      duplicateSemanticGroupCount: 0,
      uniqueStructuralHashCount: 1,
    },
    warnings: [],
  };
  return {
    navigation: {
      requestedUrl: 'https://example.test',
      finalUrl: 'https://example.test/',
      title: 'Fixture',
      status: 200,
      ok: true,
    },
    session: {
      id,
      browser: 'chromium',
      mode: 'ephemeral',
      headless: true,
      createdAt,
      currentUrl: 'https://example.test/',
      pageCount: 1,
      traceActive: false,
      userDataDir: null,
      storageStatePath: null,
      artifactRun,
    },
    artifactRun,
    bundlePath: join(run, 'reports/snapshot-bundle.json'),
    domSnapshotPath: join(run, files.domSnapshot),
    htmlManifestPath: join(run, files.htmlSnapshot),
    fingerprintPath: join(run, files.fingerprints),
    htmlFramePaths: [join(run, files.htmlFrames[0])],
    manifest,
    close: {
      closedAt: createdAt,
      tracePath: null,
      screenshotPath: null,
      storageStatePath: null,
      warnings: [],
    },
  };
}

describe('baseline storage', () => {
  it('validates names and rejects traversal', () => {
    expect(validateBaselineName('login-page')).toBe('login-page');
    try {
      validateBaselineName('../escape');
      throw new Error('expected invalid baseline name to throw');
    } catch (error) {
      expect(error).toMatchObject({ code: 'BASELINE_NAME_INVALID' });
    }
  });

  it('saves versioned baselines, updates latest, and lists records', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'selector-baseline-'));
    const toolkitConfig = config(cwd);
    const first = await saveBaseline(
      toolkitConfig,
      'login',
      await fakeReport(cwd, '11111111-0000-0000-0000-000000000000', '2026-07-18T00:00:00.000Z'),
    );
    const second = await saveBaseline(
      toolkitConfig,
      'login',
      await fakeReport(cwd, '22222222-0000-0000-0000-000000000000', '2026-07-18T01:00:00.000Z'),
    );
    expect(first.version).not.toBe(second.version);
    expect((await loadBaseline(toolkitConfig, 'login')).version).toBe(second.version);
    expect((await loadBaseline(toolkitConfig, 'login', first.version)).version).toBe(first.version);
    expect(await listBaselines(toolkitConfig)).toEqual([
      expect.objectContaining({ name: 'login', latestVersion: second.version }),
    ]);
  });

  it('reports missing baselines with exit code two', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'selector-baseline-missing-'));
    await expect(loadBaseline(config(cwd), 'missing')).rejects.toMatchObject({
      code: 'BASELINE_NOT_FOUND',
      exitCode: 2,
    });
  });
});
