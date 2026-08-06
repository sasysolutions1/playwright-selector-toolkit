import { z } from 'zod';
import { RepairError } from '../../errors/toolkit-error.js';
import type {
  RepairAdvisor,
  RepairAdvisorRequest,
  RepairAdvisorResponse,
} from '../../types/repair.js';

const advisorResponseSchema = z.object({
  recommendations: z.array(
    z.object({
      candidateId: z.string().min(1),
      confidence: z.number().min(0).max(1),
      rationale: z.string().min(1).max(500),
    }),
  ),
  notes: z.array(z.string().max(500)),
});

const outputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          candidateId: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          rationale: { type: 'string' },
        },
        required: ['candidateId', 'confidence', 'rationale'],
      },
    },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['recommendations', 'notes'],
} as const;

export interface OpenAiRepairAdvisorOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly fetcher?: typeof fetch;
}

function extractOutputText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '';
  const output = (payload as { readonly output?: unknown }).output;
  if (!Array.isArray(output)) return '';
  for (const item of output) {
    if (typeof item !== 'object' || item === null) continue;
    const content = (item as { readonly content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue;
      if ((part as { readonly type?: unknown }).type === 'output_text') {
        const text = (part as { readonly text?: unknown }).text;
        if (typeof text === 'string') return text;
      }
    }
  }
  return '';
}

export class OpenAiRepairAdvisor implements RepairAdvisor {
  readonly provider = 'openai' as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(options: OpenAiRepairAdvisorOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/+$/u, '');
    this.timeoutMs = options.timeoutMs;
    this.fetcher = options.fetcher ?? fetch;
  }

  async advise(request: RepairAdvisorRequest): Promise<RepairAdvisorResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${this.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          store: false,
          input: [
            {
              role: 'system',
              content:
                'You review sanitized Playwright locator candidates. Choose only candidateId values supplied in the request. Never invent selectors, credentials, page content, or element IDs. Prefer unique semantic locators and explain uncertainty. The output is advisory and requires human approval.',
            },
            {
              role: 'user',
              content: JSON.stringify(request),
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'selector_repair_advice',
              strict: true,
              schema: outputJsonSchema,
            },
          },
          max_output_tokens: 1200,
        }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new RepairError(
          'REPAIR_ADVISOR_FAILED',
          `OpenAI repair advisor returned HTTP ${response.status}`,
          { details: { status: response.status }, cause: payload },
        );
      }
      const text = extractOutputText(payload);
      if (text === '') {
        throw new RepairError('REPAIR_ADVISOR_FAILED', 'OpenAI repair advisor returned no text');
      }
      const parsed = advisorResponseSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        throw new RepairError('REPAIR_ADVISOR_FAILED', 'OpenAI repair advice was invalid', {
          details: { issues: parsed.error.issues },
        });
      }
      const allowed = new Set(request.candidates.map((candidate) => candidate.candidateId));
      return {
        recommendations: parsed.data.recommendations.filter((item) =>
          allowed.has(item.candidateId),
        ),
        notes: parsed.data.notes,
      };
    } catch (error) {
      if (error instanceof RepairError) throw error;
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? `OpenAI repair advisor timed out after ${this.timeoutMs}ms`
          : 'OpenAI repair advisor request failed';
      throw new RepairError('REPAIR_ADVISOR_FAILED', message, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}
