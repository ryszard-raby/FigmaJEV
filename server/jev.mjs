import { logDefApi } from './file-logger.mjs';
export { logDefApi } from './file-logger.mjs';

export function choice(instructions, criteria) {
  return { type: 'choice', instructions, criteria };
}

export function validateAnswers(questions, answers) {
  const result = {};
  for (const [id, question] of Object.entries(questions)) {
    const answer = answers?.[id];
    if (answer?.type !== 'choice' || !Object.hasOwn(question.criteria, answer.choice)) {
      throw new Error(`JEV zwrócił nieprawidłową decyzję: ${id}`);
    }
    result[id] = answer.choice;
  }
  return result;
}

export function createJev(apiKey, fetcher = fetch, signal, trace = {}, logger = logDefApi) {
  async function requestBatch(state, questions) {
    if (!apiKey) throw new Error('Ustaw DEFAPI_API_KEY w pliku .env serwera.');
    trace.requestCount = (trace.requestCount || 0) + 1;
    const metadata = { promptId: trace.promptId, requestNumber: trace.requestCount };
    const request = { model: 'typesafe/jev-1.13', state, questions };
    await logger('request', request, metadata);
    console.log(`[DefAPI] request ${metadata.requestNumber}`);
    let response;
    try {
      response = await fetcher('https://api.defapi.org/api/v1/decisions', {
      method: 'POST', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
      });
    } catch (error) {
      await logger('error', { detail: String(error.message || error).split(apiKey).join('[REDACTED]').slice(0, 2000) }, metadata);
      throw error;
    }
    if (!response.ok) {
      const body = await response.text();
      const detail = body.split(apiKey).join('[REDACTED]').slice(0, 2000);
      await logger('error', { status: response.status, detail }, metadata);
      if (response.status === 400 && detail.includes('max_tokens_exceeded')) throw new Error('JEV: przekroczony limit tokenów żądania. Kontekst lub lista możliwości wymaga dalszego ograniczenia.');
      throw new Error(`DefAPI: HTTP ${response.status}. ${detail || 'Serwer nie podał szczegółów.'}`);
    }
    const data = await response.json();
    await logger('response', data, metadata);
    console.log(`[DefAPI] response ${metadata.requestNumber}`);
    return validateAnswers(questions, data.answers);
  }
  return async (state, questions) => {
    function scope(batch) {
      if (!Array.isArray(state.requiredComponents)) return state;
      const ids = new Set(Object.entries(batch).flatMap(([key, q]) => [key, ...Array.from(q.instructions?.matchAll(/\b(n\d+)\b/g) || [], m => m[1])]));
      const direct = state.requiredComponents.filter(n => ids.has(n.id));
      if (!direct.length) return state;
      const paths = new Set(direct.flatMap(n => (n.ancestors || []).map(a => a.path)));
      const requiredComponents = state.requiredComponents.filter(n => ids.has(n.id) || n.paths?.some(p => paths.has(p)));
      const selectedComponents = state.selectedComponents ? Object.fromEntries(requiredComponents.map(n => [n.id, state.selectedComponents[n.id]])) : undefined;
      const candidates = new Set([...Object.values(selectedComponents || {}), ...Object.values(batch).flatMap(q => Object.keys(q.criteria))]);
      const { inputTree, ...rest } = state;
      return { ...rest, requiredComponents, ...(selectedComponents ? { selectedComponents } : {}), catalog: state.catalog?.filter(c => candidates.has(c.id)) };
    }
    return requestBatch(scope(questions), questions);
  };
}
