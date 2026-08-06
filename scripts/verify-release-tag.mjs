import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!tag) throw new Error('A release tag is required.');
const expected = `v${manifest.version}`;
if (tag !== expected)
  throw new Error(`Release tag ${tag} does not match package version ${expected}.`);
process.stdout.write(`Release tag ${tag} matches package version.\n`);
