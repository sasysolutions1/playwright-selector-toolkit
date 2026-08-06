import { z } from 'zod';

const severitySchema = z.enum(['warning', 'high', 'critical']);

const escalationPolicySchema = z
  .object({
    openAfterFailures: z.number().int().min(1).max(100).default(2),
    recoverAfterSuccesses: z.number().int().min(1).max(100).default(1),
    highAfterFailures: z.number().int().min(1).max(1000).default(3),
    criticalAfterFailures: z.number().int().min(1).max(1000).default(5),
    reminderIntervalMs: z
      .number()
      .int()
      .min(60_000)
      .max(30 * 24 * 60 * 60 * 1000)
      .default(21_600_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.highAfterFailures < value.openAfterFailures) {
      context.addIssue({
        code: 'custom',
        path: ['highAfterFailures'],
        message: 'must be greater than or equal to openAfterFailures',
      });
    }
    if (value.criticalAfterFailures < value.highAfterFailures) {
      context.addIssue({
        code: 'custom',
        path: ['criticalAfterFailures'],
        message: 'must be greater than or equal to highAfterFailures',
      });
    }
  });

const targetSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u),
    name: z.string().trim().min(1).max(200),
    manifestPath: z.string().trim().min(1),
    url: z.url().optional(),
    intervalMs: z
      .number()
      .int()
      .min(60_000)
      .max(30 * 24 * 60 * 60 * 1000)
      .default(300_000),
    policy: escalationPolicySchema.default({
      openAfterFailures: 2,
      recoverAfterSuccesses: 1,
      highAfterFailures: 3,
      criticalAfterFailures: 5,
      reminderIntervalMs: 21_600_000,
    }),
    notificationAdapterIds: z.array(z.string().trim().min(1)).max(20).default([]),
  })
  .strict();

const notificationSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u),
    type: z.enum(['console', 'webhook', 'sendgrid-email', 'twilio-sms', 'twilio-voice']),
    enabled: z.boolean().default(true),
    severities: z.array(severitySchema).min(1).default(['warning', 'high', 'critical']),
    notifyRecovery: z.boolean().default(true),
    urlEnv: z.string().trim().min(1).optional(),
    apiKeyEnv: z.string().trim().min(1).optional(),
    accountSidEnv: z.string().trim().min(1).optional(),
    authTokenEnv: z.string().trim().min(1).optional(),
    fromEnv: z.string().trim().min(1).optional(),
    toEnv: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const require = (field: keyof typeof value, message: string): void => {
      if (value[field] === undefined) context.addIssue({ code: 'custom', path: [field], message });
    };
    if (value.type === 'webhook') require('urlEnv', 'is required for webhook adapters');
    if (value.type === 'sendgrid-email') {
      require('apiKeyEnv', 'is required for SendGrid adapters');
      require('fromEnv', 'is required for SendGrid adapters');
      require('toEnv', 'is required for SendGrid adapters');
    }
    if (value.type === 'twilio-sms' || value.type === 'twilio-voice') {
      require('accountSidEnv', 'is required for Twilio adapters');
      require('authTokenEnv', 'is required for Twilio adapters');
      require('fromEnv', 'is required for Twilio adapters');
      require('toEnv', 'is required for Twilio adapters');
    }
  });

export const monitorManifestSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    name: z.string().trim().min(1).max(200),
    pollIntervalMs: z
      .number()
      .int()
      .min(10_000)
      .max(24 * 60 * 60 * 1000)
      .default(60_000),
    targets: z.array(targetSchema).min(1).max(1000),
    notifications: z.array(notificationSchema).max(50).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const targetIds = new Set<string>();
    for (const [index, target] of value.targets.entries()) {
      if (targetIds.has(target.id)) {
        context.addIssue({
          code: 'custom',
          path: ['targets', index, 'id'],
          message: 'must be unique',
        });
      }
      targetIds.add(target.id);
    }
    const adapterIds = new Set<string>();
    for (const [index, adapter] of value.notifications.entries()) {
      if (adapterIds.has(adapter.id)) {
        context.addIssue({
          code: 'custom',
          path: ['notifications', index, 'id'],
          message: 'must be unique',
        });
      }
      adapterIds.add(adapter.id);
    }
    for (const [targetIndex, target] of value.targets.entries()) {
      for (const [adapterIndex, id] of target.notificationAdapterIds.entries()) {
        if (!adapterIds.has(id)) {
          context.addIssue({
            code: 'custom',
            path: ['targets', targetIndex, 'notificationAdapterIds', adapterIndex],
            message: `references unknown notification adapter ${id}`,
          });
        }
      }
    }
  });
