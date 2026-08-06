import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const expected = [
  'createProgram',
  'runCli',
  'discoverDom',
  'analyzeLocators',
  'runCompatibilityReview',
  'runSecurityReview',
  'runSelectorRepair',
  'validateManifestSelectors',
  'buildHtmlReport',
  'buildMonitorHistoryReport',
  'appendMonitorHistory',
  'definePlugin',
];
const entry = resolve(process.cwd(), 'dist/index.js');
const declarations = resolve(process.cwd(), 'dist/index.d.ts');
await Promise.all([access(entry), access(declarations)]);
const module = await import(entry);
const missing = expected.filter((name) => typeof module[name] !== 'function');
if (missing.length > 0) throw new Error(`Public API exports are missing: ${missing.join(', ')}`);
const declarationText = await readFile(declarations, 'utf8');
for (const name of expected) {
  if (!declarationText.includes(name)) throw new Error(`Type declarations do not mention ${name}.`);
}
process.stdout.write(`Public API verified: ${expected.length} required exports.\n`);
