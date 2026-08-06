import { readFileSync } from 'node:fs';

interface PackageManifest {
  readonly version: string;
}

export function getToolkitVersion(): string {
  const packageUrl = new URL('../../package.json', import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageUrl, 'utf8')) as PackageManifest;

  if (!packageJson.version) {
    throw new Error('package.json does not contain a version');
  }

  return packageJson.version;
}
