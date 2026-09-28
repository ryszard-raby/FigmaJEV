import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const logPath = resolve('logs/defapi.log');

async function logDefApi(direction, payload) {
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify({ timestamp: new Date().toISOString(), direction, payload })}\n`);
}

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

export function createJev(apiKey, fetcher = fetch, signal) {
  async function requestBatch(state, questions) {
    if (!apiKey) throw new Error('Ustaw DEFAPI_API_KEY w pliku .env serwera.');
    const request = { model: 'typesafe/jev-1.13', state, questions };
    await logDefApi('request', request);
    console.log(`[DefAPI] request zapisany w ${logPath}`);
    const response = await fetcher('https://api.defapi.org/api/v1/decisions', {
      method: 'POST', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      const body = await response.text();
      const detail = body.split(apiKey).join('[REDACTED]').slice(0, 2000);
      await logDefApi('error', { status: response.status, detail });
      throw new Error(`DefAPI: HTTP ${response.status}. ${detail || 'Serwer nie podał szczegółów.'}`);
    }
    const data = await response.json();
    await logDefApi('response', data);
    console.log(`[DefAPI] response zapisany w ${logPath}`);
    return validateAnswers(questions, data.answers);
  }
  return async (state, questions) => {
    // Application batch budget, not a claimed provider limit. Keep independent
    // choices together while bounding both question count and serialized size.
    const entries = Object.entries(questions);
    const limit = 96000;
    const bytes = (s, q) => Buffer.byteLength(JSON.stringify({ model: 'typesafe/jev-1.13', state: s, questions: q }), 'utf8');
    if (entries.length <= 24 && bytes(state, questions) <= limit) return requestBatch(state, questions);
    function scope(batch) {
      if (!Array.isArray(state.requiredComponents)) return state;
      const ids = new Set(Object.entries(batch).flatMap(([key, q]) => [key, ...Array.from(q.instructions?.matchAll(/\b(n\d+)\b/g) || [], m => m[1])]));
      const direct = state.requiredComponents.filter(n => ids.has(n.id));
      if (!direct.length) return state;
      const paths = new Set(direct.flatMap(n => (n.ancestors || []).map(a => a.path)));
      const requiredComponents = state.requiredComponents.filter(n => ids.has(n.id) || n.paths.some(p => paths.has(p)));
      const selectedComponents = state.selectedComponents ? Object.fromEntries(requiredComponents.map(n => [n.id, state.selectedComponents[n.id]])) : undefined;
      const candidates = new Set([...Object.values(selectedComponents || {}), ...Object.values(batch).flatMap(q => Object.keys(q.criteria))]);
      const { inputTree, ...rest } = state;
      return { ...rest, requiredComponents, ...(selectedComponents ? { selectedComponents } : {}), catalog: state.catalog?.filter(c => candidates.has(c.id)), batchContext: 'Only these decisions are requested. Ancestor paths preserve the original hierarchy; do not generate children.' };
    }
    const batches = []; let batch = {};
    for (const [key, question] of entries) {
      const next = { ...batch, [key]: question };
      if (Object.keys(batch).length && (Object.keys(next).length > 24 || bytes(scope(next), next) > limit)) {
        batches.push(batch); batch = {};
      }
      batch[key] = question;
      if (bytes(scope(batch), batch) > limit) throw new Error(`JEV: pytanie ${key} z kontekstem przekracza budżet 96 kB. Zmniejsz katalog lub strukturę.`);
    }
    if (Object.keys(batch).length) batches.push(batch);
    const answers = {};
    for (const [index, batch] of batches.entries()) {
      console.log(`[JEV BATCH] ${index + 1}/${batches.length}, questions=${Object.keys(batch).length}`);
      Object.assign(answers, await requestBatch(scope(batch), batch));
    }
    return answers;
  };
}
