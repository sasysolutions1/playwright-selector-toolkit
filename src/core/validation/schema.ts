import { z } from 'zod';
import type { LocatorSpec } from '../../types/locator.js';
import type { SelectorAssertions, SelectorManifest } from '../../types/validation.js';

const roleSpec = z.object({
  type: z.literal('role'),
  role: z.string().trim().min(1),
  name: z.string().min(1).optional(),
  exact: z.boolean().default(true),
});

const textSpec = z.object({
  type: z.enum(['label', 'placeholder', 'text']),
  value: z.string().min(1),
  exact: z.boolean().default(true),
});

const testIdSpec = z.object({
  type: z.literal('test-id'),
  attribute: z.string().trim().min(1).default('data-testid'),
  value: z.string().min(1),
});

const selectorSpec = z.object({
  type: z.enum(['attribute', 'css', 'xpath']),
  selector: z.string().trim().min(1),
});

const locatorSpec = z.discriminatedUnion('type', [roleSpec, textSpec, testIdSpec, selectorSpec]);

function normalizeLocator(value: z.infer<typeof locatorSpec>): LocatorSpec {
  if (value.type === 'role') {
    return {
      type: 'role',
      role: value.role,
      ...(value.name === undefined ? {} : { name: value.name }),
      exact: value.exact,
    };
  }
  return value;
}

const presenceMode = z.enum(['any', 'all', 'none']);
const countRange = z
  .object({
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().nonnegative().optional(),
  })
  .refine((value) => value.min !== undefined || value.max !== undefined, {
    message: 'count range must include min or max',
  })
  .refine((value) => value.min === undefined || value.max === undefined || value.min <= value.max, {
    message: 'count range min cannot exceed max',
  });

const assertions = z
  .object({
    count: z.union([z.number().int().nonnegative(), countRange]).default(1),
    visible: presenceMode.optional(),
    enabled: presenceMode.optional(),
    editable: presenceMode.optional(),
  })
  .default({ count: 1 });

const selectorEntry = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9._-]*$/iu),
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  required: z.boolean().default(true),
  framePath: z.string().trim().min(1).default('main'),
  locator: locatorSpec,
  assertions,
});

function normalizeAssertions(value: z.infer<typeof assertions>): SelectorAssertions {
  const count =
    typeof value.count === 'number'
      ? value.count
      : {
          ...(value.count.min === undefined ? {} : { min: value.count.min }),
          ...(value.count.max === undefined ? {} : { max: value.count.max }),
        };
  return {
    count,
    ...(value.visible === undefined ? {} : { visible: value.visible }),
    ...(value.enabled === undefined ? {} : { enabled: value.enabled }),
    ...(value.editable === undefined ? {} : { editable: value.editable }),
  };
}

export const selectorManifestSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    name: z.string().trim().min(1).default('Selector validation manifest'),
    url: z.string().url().optional(),
    waitUntil: z
      .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
      .default('domcontentloaded'),
    selectors: z.array(selectorEntry).min(1),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    for (const [index, entry] of value.selectors.entries()) {
      if (seen.has(entry.id)) {
        context.addIssue({
          code: 'custom',
          path: ['selectors', index, 'id'],
          message: `duplicate selector id: ${entry.id}`,
        });
      }
      seen.add(entry.id);
    }
  })
  .transform((value): SelectorManifest => ({
    schemaVersion: value.schemaVersion,
    name: value.name,
    ...(value.url === undefined ? {} : { url: value.url }),
    waitUntil: value.waitUntil,
    selectors: value.selectors.map((entry) => ({
      id: entry.id,
      name: entry.name ?? entry.id,
      ...(entry.description === undefined ? {} : { description: entry.description }),
      required: entry.required,
      framePath: entry.framePath,
      locator: normalizeLocator(entry.locator),
      assertions: normalizeAssertions(entry.assertions),
    })),
  }));
