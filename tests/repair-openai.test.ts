import { describe, expect, it } from 'vitest';
import { OpenAiRepairAdvisor } from '../src/core/repair/openai.js';
import type { RepairAdvisorRequest } from '../src/types/repair.js';

const request: RepairAdvisorRequest = {
  selector: {
    id: 'submit',
    name: 'Submit button',
    required: true,
    framePath: 'main',
    locator: { type: 'css', selector: '#old-submit' },
    assertions: { count: 1 },
  },
  validation: {
    status: 'fail',
    observed: {
      count: 0,
      visibleCount: 0,
      enabledCount: 0,
      editableCount: 0,
      durationMs: 1,
    },
    assertions: [],
    error: null,
  },
  candidates: [
    {
      candidateId: 'candidate-1',
      playwright: "page.getByRole('button', { name: 'Submit' })",
      strategy: 'role',
      deterministicScore: 88,
      element: {
        elementId: 'button-1',
        framePath: 'main',
        shadowPath: [],
        tagName: 'button',
        kind: 'button',
        role: 'button',
        accessibleName: 'Submit',
        label: null,
        placeholder: null,
        visible: true,
      },
      reasons: ['unique'],
      warnings: [],
    },
  ],
};

function responsePayload(value: unknown) {
  return {
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: JSON.stringify(value) }],
      },
    ],
  };
}

describe('OpenAI repair advisor', () => {
  it('uses structured Responses API output and filters invented candidate IDs', async () => {
    const fetcher: typeof fetch = async (
      _url: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      if (typeof init?.body !== 'string') throw new TypeError('Expected a JSON request body');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(body.store).toBe(false);
      expect(body.text).toBeTruthy();
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-key');
      return new Response(
        JSON.stringify(
          responsePayload({
            recommendations: [
              {
                candidateId: 'candidate-1',
                confidence: 0.95,
                rationale: 'Unique semantic control.',
              },
              { candidateId: 'invented', confidence: 1, rationale: 'Should be filtered.' },
            ],
            notes: ['Human approval is required.'],
          }),
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };
    const advisor = new OpenAiRepairAdvisor({
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: 'https://api.example.test/v1',
      timeoutMs: 1_000,
      fetcher,
    });
    const result = await advisor.advise(request);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]?.candidateId).toBe('candidate-1');
  });

  it('throws a structured error for HTTP failures', async () => {
    const failingFetcher: typeof fetch = async () => new Response('{}', { status: 500 });
    const advisor = new OpenAiRepairAdvisor({
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: 'https://api.example.test/v1',
      timeoutMs: 1_000,
      fetcher: failingFetcher,
    });
    await expect(advisor.advise(request)).rejects.toMatchObject({ code: 'REPAIR_ADVISOR_FAILED' });
  });
});
