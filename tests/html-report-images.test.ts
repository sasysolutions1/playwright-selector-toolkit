import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectHtmlReportImages } from '../src/core/report/images.js';
import { diagnosticFixture } from './html-report-fixtures.js';

const dirs: string[] = [];
afterEach(async () =>
  Promise.all(dirs.splice(0).map((path) => rm(path, { recursive: true, force: true }))),
);

describe('collectHtmlReportImages', () => {
  it('embeds diagnostic screenshots and respects size limits', async () => {
    const root = await mkdtemp(join(tmpdir(), 'selector-report-images-'));
    dirs.push(root);
    await mkdir(join(root, 'screenshots'), { recursive: true });
    await writeFile(join(root, 'run.json'), '{}');
    await writeFile(
      join(root, 'screenshots', 'viewport.png'),
      Buffer.from('89504e470d0a1a0a', 'hex'),
    );
    const diagnostic = diagnosticFixture();
    const source = {
      kind: 'diagnostics' as const,
      path: join(root, 'reports', 'diagnostic-evidence.json'),
      runRoot: root,
      data: {
        ...diagnostic,
        screenshots: {
          ...diagnostic.screenshots,
          artifacts: diagnostic.screenshots.artifacts.map((item) => ({
            ...item,
            path: join(root, 'screenshots', 'viewport.png'),
          })),
        },
      },
    };
    const embedded = await collectHtmlReportImages([source], true, 100);
    expect(embedded.images).toHaveLength(1);
    expect(embedded.images[0]?.dataUri).toMatch(/^data:image\/png;base64,/u);
    const omitted = await collectHtmlReportImages([source], true, 2);
    expect(omitted.images[0]?.dataUri).toBeNull();
    expect(omitted.warnings).toHaveLength(1);
  });
});
