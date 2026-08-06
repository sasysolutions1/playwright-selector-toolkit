import { z } from 'zod';
import type { ToolkitConfigInput } from '../../types/config.js';

const viewportSchema = z
  .object({
    width: z.number().int().min(320).max(10_000).optional(),
    height: z.number().int().min(240).max(10_000).optional(),
  })
  .strict();

export const toolkitConfigInputSchema = z
  .object({
    artifactsDir: z.string().trim().min(1).optional(),
    browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
    headless: z.boolean().optional(),
    timeoutMs: z.number().int().min(100).max(300_000).optional(),
    navigationTimeoutMs: z.number().int().min(100).max(600_000).optional(),
    viewport: viewportSchema.optional(),
    trace: z.enum(['off', 'on', 'retain-on-failure']).optional(),
    screenshots: z.enum(['off', 'always', 'on-failure']).optional(),
    baseUrl: z.url().optional(),
    userDataDir: z.string().trim().min(1).optional(),
    storageStatePath: z.string().trim().min(1).optional(),
    executablePath: z.string().trim().min(1).optional(),
    plugins: z.array(z.string().trim().min(1)).max(100).optional(),
    pluginTimeoutMs: z.number().int().min(100).max(300_000).optional(),
    pluginFailureMode: z.enum(['isolate', 'fail-fast']).optional(),
  })
  .strict();

export function parseConfigInput(value: unknown): ToolkitConfigInput {
  return toolkitConfigInputSchema.parse(value);
}
