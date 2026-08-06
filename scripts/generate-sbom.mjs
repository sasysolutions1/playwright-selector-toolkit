import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const releaseDir = resolve(process.cwd(), 'release');
await mkdir(releaseDir, { recursive: true });

function generate(format, filename) {
  const result = spawnSync('npm', ['sbom', '--sbom-format', format], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`npm sbom (${format}) failed\n${result.stderr}`);
  JSON.parse(result.stdout);
  return writeFile(resolve(releaseDir, filename), `${result.stdout.trim()}\n`);
}

await Promise.all([
  generate('cyclonedx', 'sbom.cyclonedx.json'),
  generate('spdx', 'sbom.spdx.json'),
]);
process.stdout.write(`SBOM files written to ${releaseDir}\n`);
