import { extname } from 'node:path';
import { writeJsonArtifact } from '../artifacts/manager.js';
import { openBrowserSession } from '../browser/session.js';
import { DomError } from '../../errors/toolkit-error.js';
import type { BrowserSessionHandle, OpenBrowserSessionOptions } from '../../types/browser.js';
import type { ToolkitConfig } from '../../types/config.js';
import type { DomDiscoveryOptions, DomDiscoveryReport, DomSnapshot } from '../../types/dom.js';
import { crawlDomSnapshot } from './crawler.js';

export interface DomDiscoveryDependencies {
  readonly openSession?: (
    config: ToolkitConfig,
    options?: OpenBrowserSessionOptions,
  ) => Promise<BrowserSessionHandle>;
  readonly crawler?: (
    page: BrowserSessionHandle['page'],
    requestedUrl: string,
    options: DomDiscoveryOptions,
  ) => Promise<DomSnapshot>;
  readonly writeSnapshot?: (
    run: BrowserSessionHandle['artifactRun'],
    relativePath: string,
    value: unknown,
  ) => Promise<string>;
}

function snapshotFileName(value: string | undefined): string {
  const path = value ?? 'snapshots/dom-snapshot.json';
  if (extname(path).toLowerCase() !== '.json') {
    throw new DomError('DOM_SNAPSHOT_FAILED', 'DOM snapshot filename must end in .json', {
      details: { snapshotFile: path },
      exitCode: 2,
    });
  }
  return path;
}

export async function discoverDom(
  config: ToolkitConfig,
  url: string,
  options: DomDiscoveryOptions = {},
  dependencies: DomDiscoveryDependencies = {},
): Promise<DomDiscoveryReport> {
  const session = await (dependencies.openSession ?? openBrowserSession)(config, {
    command: options.command ?? 'discover',
    ...(options.name === undefined ? {} : { name: options.name }),
  });

  try {
    const navigation = await session.navigate(url, options.waitUntil ?? 'domcontentloaded');
    const snapshot = await (dependencies.crawler ?? crawlDomSnapshot)(session.page, url, {
      ...options,
      ...(session.plugins === undefined ? {} : { pluginHost: session.plugins }),
    });
    const snapshotPath = await (dependencies.writeSnapshot ?? writeJsonArtifact)(
      session.artifactRun,
      snapshotFileName(options.snapshotFile),
      snapshot,
    );
    const summary = session.summary();
    const close = await session.close({ success: true });
    return {
      navigation,
      session: summary,
      artifactRun: session.artifactRun,
      snapshotPath,
      summary: snapshot.summary,
      failures: snapshot.failures,
      warnings: [...snapshot.warnings, ...close.warnings],
      close,
    };
  } catch (error) {
    await session.close({ success: false, reason: 'DOM discovery failed' });
    if (error instanceof DomError) throw error;
    throw new DomError('DOM_CRAWL_FAILED', `Could not discover DOM elements at ${url}`, {
      cause: error,
      details: { url },
    });
  }
}
