import { createWriteStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import archiver from 'archiver';
import { DiagnosticError } from '../../errors/toolkit-error.js';
import type { ArtifactRun } from '../../types/artifacts.js';
import { resolveArtifactPath } from '../artifacts/manager.js';

async function collectFiles(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(root, path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

export async function createDiagnosticArchive(
  run: ArtifactRun,
  relativePath = 'reports/diagnostic-evidence.zip',
): Promise<string> {
  const outputPath = resolveArtifactPath(run, relativePath);
  const files = (await collectFiles(run.directories.run)).filter(
    (path) => resolve(path) !== resolve(outputPath),
  );

  try {
    await new Promise<void>((resolvePromise, reject) => {
      const output = createWriteStream(outputPath, { mode: 0o600 });
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', resolvePromise);
      output.on('error', reject);
      archive.on('warning', (error) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        reject(error);
      });
      archive.on('error', reject);
      archive.pipe(output);
      for (const path of files) {
        const name = relative(run.directories.run, path).split(sep).join('/');
        archive.file(path, { name });
      }
      void archive.finalize();
    });
    const result = await stat(outputPath);
    if (result.size === 0) throw new Error('Archive is empty');
    return outputPath;
  } catch (error) {
    throw new DiagnosticError(
      'DIAGNOSTIC_ARCHIVE_FAILED',
      `Could not create diagnostic archive: ${outputPath}`,
      { cause: error, details: { path: outputPath } },
    );
  }
}
