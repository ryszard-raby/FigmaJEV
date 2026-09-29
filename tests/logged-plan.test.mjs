import test from 'node:test';
import assert from 'node:assert/strict';
import { loggedPlan } from '../server/logged-plan.mjs';
import { choice } from '../server/jev.mjs';

test('one user prompt correlates all physical batches and final request count', async () => {
  const entries = [];
  const prompt = 'Dodaj button\nz ikoną';
  await loggedPlan({ prompt, context: { targetId: 'card' } }, {
    apiKey: 'test-secret', logger: async (direction, payload, metadata) => entries.push({ direction, payload, ...metadata }),
    planner: async (_, decide) => decide({}, Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`q${i}`, choice('Choose', { yes: 'Yes' })]))),
    fetcher: async (_, req) => ({ ok: true, json: async () => ({ answers: Object.fromEntries(Object.keys(JSON.parse(req.body).questions).map(k => [k, { type: 'choice', choice: 'yes' }])) }) })
  });
  assert.equal(entries.filter(e => e.direction === 'user_prompt').length, 1);
  assert.equal(entries[0].payload.prompt, prompt);
  assert.equal(new Set(entries.map(e => e.promptId)).size, 1);
  assert.deepEqual(entries.filter(e => e.direction === 'request').map(e => e.requestNumber), [1, 2]);
  assert.equal(entries.at(-1).payload.jevRequests, 2);
  assert.equal(entries.at(-1).payload.status, 'success');
  assert.ok(!JSON.stringify(entries).includes('test-secret'));
});

test('invalid input and failed API calls still have a prompt and accurate summary', async () => {
  for (const apiFailure of [false, true]) {
    const entries = [];
    await assert.rejects(loggedPlan({ prompt: 'Usuń element' }, {
      apiKey: 'test-secret', logger: async (direction, payload) => entries.push({ direction, payload }),
      planner: async (_, decide) => { if (!apiFailure) throw new Error('Invalid input'); return decide({}, { q: choice('Choose', { yes: 'Yes' }) }); },
      fetcher: async () => { throw new Error('Network failure'); }
    }));
    assert.equal(entries[0].direction, 'user_prompt');
    assert.equal(entries.at(-1).payload.status, 'error');
    assert.equal(entries.at(-1).payload.jevRequests, apiFailure ? 1 : 0);
  }
});
