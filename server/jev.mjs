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
  return async (state, questions) => {
    if (!apiKey) throw new Error('Ustaw DEFAPI_API_KEY w pliku .env serwera.');
    const response = await fetcher('https://api.defapi.org/api/v1/decisions', {
      method: 'POST', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'typesafe/jev-1.13', state, questions })
    });
    if (!response.ok) throw new Error(`DefAPI: HTTP ${response.status}. Sprawdź klucz, limit i dostępność modelu.`);
    const data = await response.json();
    return validateAnswers(questions, data.answers);
  };
}
