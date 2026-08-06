import { readFile, stat } from 'node:fs/promises';
import { extname, isAbsolute, resolve } from 'node:path';
import type { DiagnosticEvidenceManifest } from '../../types/diagnostics.js';
import type { HtmlReportImage, HtmlReportSource } from '../../types/html-report.js';

function mime(path: string): string | null {
  const extension = extname(path).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  return null;
}

function diagnosticPaths(source: HtmlReportSource): readonly string[] {
  if (source.kind !== 'diagnostics') return [];
  const manifest = source.data as DiagnosticEvidenceManifest;
  const listed = new Set<string>(manifest.files.screenshots);
  for (const item of manifest.screenshots.artifacts) listed.add(item.path);
  return [...listed];
}

function absoluteImagePath(source: HtmlReportSource, path: string): string | null {
  if (isAbsolute(path)) return path;
  if (source.runRoot !== null) return resolve(source.runRoot, path);
  return resolve(source.path, '..', path);
}

export async function collectHtmlReportImages(
  sources: readonly HtmlReportSource[],
  embedImages: boolean,
  maxImageBytes: number,
): Promise<{ readonly images: readonly HtmlReportImage[]; readonly warnings: readonly string[] }> {
  const images: HtmlReportImage[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const listedPath of diagnosticPaths(source)) {
      const path = absoluteImagePath(source, listedPath);
      if (path === null || seen.has(path)) continue;
      seen.add(path);
      const mimeType = mime(path);
      if (mimeType === null) continue;
      try {
        const info = await stat(path);
        if (!info.isFile()) continue;
        let dataUri: string | null = null;
        let reasonNotEmbedded: string | null = null;
        if (!embedImages) {
          reasonNotEmbedded = 'Image embedding disabled';
        } else if (info.size > maxImageBytes) {
          reasonNotEmbedded = `Image exceeds maxImageBytes (${info.size} > ${maxImageBytes})`;
          warnings.push(`${listedPath} was not embedded because it is too large`);
        } else {
          const data = await readFile(path);
          dataUri = `data:${mimeType};base64,${data.toString('base64')}`;
        }
        images.push({
          sourcePath: path,
          label: listedPath,
          mimeType,
          byteLength: info.size,
          dataUri,
          reasonNotEmbedded,
        });
      } catch (error) {
        warnings.push(
          `Could not read screenshot ${listedPath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  return { images, warnings };
}
