import type { ToolkitConfig } from '../../types/config.js';
import type {
  HtmlReportBuildReport,
  HtmlReportOptions,
  HtmlReportManifest,
} from '../../types/html-report.js';
import { createArtifactRun, writeJsonArtifact, writeTextArtifact } from '../artifacts/manager.js';
import { getToolkitVersion } from '../version.js';
import { collectHtmlReportImages } from './images.js';
import { summarizeHtmlReportSource } from './model.js';
import { resolveHtmlReportOptions } from './options.js';
import { renderPortableHtmlReport } from './render.js';
import { loadHtmlReportSources } from './sources.js';

export interface HtmlReportDependencies {
  readonly now?: () => Date;
  readonly toolkitVersion?: () => string;
}

export async function buildHtmlReport(
  config: ToolkitConfig,
  inputs: readonly string[],
  options: HtmlReportOptions = {},
  dependencies: HtmlReportDependencies = {},
): Promise<HtmlReportBuildReport> {
  const resolved = resolveHtmlReportOptions(options);
  const artifactRun = await createArtifactRun(config, {
    command: resolved.command,
    ...(resolved.name === undefined ? {} : { name: resolved.name }),
  });
  const sources = await loadHtmlReportSources(inputs, config.cwd, resolved.maxDirectoryDepth);
  const collected = await collectHtmlReportImages(
    sources,
    resolved.embedImages,
    resolved.maxImageBytes,
  );
  const html = renderPortableHtmlReport(sources, collected.images, {
    title: resolved.title,
    maxItemsPerSection: resolved.maxItemsPerSection,
    interactive: resolved.interactive,
  });
  const reportPath = await writeTextArtifact(artifactRun, resolved.outputFile, html);
  const now = dependencies.now ?? (() => new Date());
  const manifest: HtmlReportManifest = {
    schemaVersion: '1.1',
    toolkitVersion: (dependencies.toolkitVersion ?? getToolkitVersion)(),
    generatedAt: now().toISOString(),
    title: resolved.title,
    reportPath,
    sourceCount: sources.length,
    sources: sources.map(summarizeHtmlReportSource),
    imageCount: collected.images.length,
    embeddedImageCount: collected.images.filter((item) => item.dataUri !== null).length,
    omittedImageCount: collected.images.filter((item) => item.dataUri === null).length,
    interactive: resolved.interactive,
    warnings: collected.warnings,
  };
  const manifestPath = await writeJsonArtifact(artifactRun, resolved.manifestFile, manifest);
  return { artifactRun, reportPath, manifestPath, manifest };
}
