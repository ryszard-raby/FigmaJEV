import { randomUUID } from 'node:crypto';
import { createJev, logDefApi } from './jev.mjs';
import { plan } from './planner.mjs';

export async function loggedPlan(input, { apiKey, fetcher = fetch, signal, logger = logDefApi, planner = plan } = {}) {
  const trace = { promptId: randomUUID(), requestCount: 0 };
  const started = Date.now();
  const metadata = { promptId: trace.promptId };
  const entry = {
    prompt: typeof input?.prompt === 'string' ? input.prompt : '',
    mode: input?.context ? 'edit' : 'create',
    targetId: input?.context?.targetId,
    ...(!input?.context ? { structure: input?.structure } : {})
  };
  await logger('user_prompt', entry, metadata);
  console.log(`[USER PROMPT] ${trace.promptId} ${JSON.stringify(entry)}`);
  let status = 'error';
  try {
    const result = await planner(input, createJev(apiKey, fetcher, signal, trace, logger));
    status = 'success';
    return result;
  } finally {
    const summary = { status, jevRequests: trace.requestCount, durationMs: Date.now() - started };
    await logger('prompt_summary', summary, metadata);
    console.log(`[PROMPT SUMMARY] ${trace.promptId} ${JSON.stringify(summary)}`);
  }
}
