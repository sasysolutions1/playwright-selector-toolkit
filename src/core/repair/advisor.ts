import { RepairError } from '../../errors/toolkit-error.js';
import type {
  RepairAdvisor,
  RepairAdvisorResponse,
  ResolvedSelectorRepairOptions,
  SelectorRepairOptions,
} from '../../types/repair.js';
import { OpenAiRepairAdvisor } from './openai.js';

export class DeterministicRepairAdvisor implements RepairAdvisor {
  readonly provider = 'none' as const;
  readonly model = null;

  async advise(): Promise<RepairAdvisorResponse> {
    return { recommendations: [], notes: [] };
  }
}

export function createRepairAdvisor(
  resolved: ResolvedSelectorRepairOptions,
  options: SelectorRepairOptions = {},
): RepairAdvisor {
  if (resolved.provider === 'none') return new DeterministicRepairAdvisor();
  const apiKey = options.apiKey ?? process.env['OPENAI_API_KEY'];
  if (apiKey === undefined || apiKey.trim() === '') {
    throw new RepairError(
      'REPAIR_OPTIONS_INVALID',
      'OpenAI repair assistance requires OPENAI_API_KEY or apiKey',
      { exitCode: 2 },
    );
  }
  if (resolved.model === null) {
    throw new RepairError('REPAIR_OPTIONS_INVALID', 'OpenAI repair assistance requires a model', {
      exitCode: 2,
    });
  }
  return new OpenAiRepairAdvisor({
    apiKey,
    model: resolved.model,
    baseUrl: resolved.apiBaseUrl,
    timeoutMs: resolved.aiTimeoutMs,
  });
}
