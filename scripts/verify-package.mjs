import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const releaseDir = resolve(cwd, 'release');
const packageManifest = JSON.parse(await readFile(resolve(cwd, 'package.json'), 'utf8'));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? cwd,
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function sha256(path) {
  return readFile(path).then((value) => createHash('sha256').update(value).digest('hex'));
}

async function pack(directory) {
  await mkdir(directory, { recursive: true });
  const output = run('npm', [
    'pack',
    '--json',
    '--ignore-scripts',
    '--pack-destination',
    directory,
  ]);
  const result = JSON.parse(output)[0];
  if (!result?.filename || !Array.isArray(result.files))
    throw new Error('npm pack returned no package result.');
  return { result, path: resolve(directory, result.filename) };
}

await mkdir(releaseDir, { recursive: true });
const tempRoot = await mkdtemp(resolve(tmpdir(), 'selector-toolkit-package-'));
try {
  const first = await pack(resolve(tempRoot, 'pack-one'));
  const second = await pack(resolve(tempRoot, 'pack-two'));
  const [firstHash, secondHash] = await Promise.all([sha256(first.path), sha256(second.path)]);
  const files = first.result.files.map((item) => item.path).sort();
  const forbidden = files.filter((path) =>
    /^(?:src|tests|examples|docs|scripts|\.github|release|node_modules)(?:\/|$)/u.test(path),
  );
  if (forbidden.length > 0) throw new Error(`Forbidden published files: ${forbidden.join(', ')}`);
  const required = [
    'package.json',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'SECURITY.md',
    'dist/index.js',
    'dist/index.d.ts',
    'dist/cli/index.js',
  ];
  const missing = required.filter((path) => !files.includes(path));
  if (missing.length > 0)
    throw new Error(`Required published files are missing: ${missing.join(', ')}`);
  if (firstHash !== secondHash)
    throw new Error('Two clean npm pack runs produced different SHA-256 digests.');

  const installDir = resolve(tempRoot, 'install');
  await mkdir(installDir, { recursive: true });
  await writeFile(
    resolve(installDir, 'package.json'),
    '{"name":"package-verification","private":true,"type":"module"}\n',
  );
  run('npm', ['install', first.path, '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: installDir,
  });
  run(
    'node',
    [
      '--input-type=module',
      '-e',
      "const pkg=await import('playwright-selector-toolkit'); if(typeof pkg.runCompatibilityReview!=='function') process.exit(1);",
    ],
    { cwd: installDir },
  );
  const cliPath = resolve(
    installDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'selector.cmd' : 'selector',
  );
  const cliVersion = run(cliPath, ['version'], { cwd: installDir });
  if (cliVersion !== packageManifest.version)
    throw new Error(`Installed CLI reported ${cliVersion}, expected ${packageManifest.version}.`);

  const target = resolve(releaseDir, basename(first.path));
  await cp(first.path, target);
  const report = {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    packageName: packageManifest.name,
    packageVersion: packageManifest.version,
    tarballPath: target,
    tarballSha256: firstHash,
    fileCount: files.length,
    files,
    importVerified: true,
    cliVerified: true,
    reproducible: true,
  };
  await writeFile(
    resolve(releaseDir, 'package-verification.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
