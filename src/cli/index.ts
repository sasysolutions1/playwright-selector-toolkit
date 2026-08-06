#!/usr/bin/env node

import { normalizeError } from '../errors/toolkit-error.js';
import { formatCliError } from './output.js';
import { runCli } from './program.js';

runCli().catch((error: unknown) => {
  const normalized = normalizeError(error);
  const json = process.argv.includes('--json');
  process.stderr.write(formatCliError(normalized, json));
  process.exitCode = normalized.exitCode;
});
