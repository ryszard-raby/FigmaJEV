import test from 'node:test';
import assert from 'node:assert/strict';
import { createJev, choice } from '../server/jev.mjs';

test('146 property decisions are batched without losing IDs or answers', async () => {
  const questions = Object.fromEntries(Array.from({ length: 146 }, (_, i) => [`q${i}`, choice(`Resolve width for n${i} (Item)`, { KEEP: 'Preserve source' })]));
  const state = { phase: 'property-resolution', inputTree: { name: 'unused full tree' }, requiredComponents: Array.from({ length: 146 }, (_, i) => ({ id: `n${i}`, paths: [`root/${i}`], ancestors: [] })), selectedComponents: Object.fromEntries(Array.from({ length: 146 }, (_, i) => [`n${i}`, `c${i}`])), catalog: Array.from({ length: 146 }, (_, i) => ({ id: `c${i}` })) };
  let calls = 0;
  const jev = createJev('fake-key', async (_, req) => {
    calls++; const body = JSON.parse(req.body);
    assert.ok(Object.keys(body.questions).length <= 24);
    assert.ok(body.state.requiredComponents.length <= 24);
    assert.ok(body.state.catalog.length <= 24);
    assert.equal(body.state.inputTree, undefined);
    return { ok: true, json: async () => ({ answers: Object.fromEntries(Object.keys(body.questions).map(key => [key, { type: 'choice', choice: 'KEEP' }])) }) };
  });
  const result = await jev(state, questions);
  assert.equal(calls, 7); assert.equal(Object.keys(result).length, 146);
  assert.equal(result.q145, 'KEEP');
});

test('provider error details are reported without retrying or exposing API key', async () => {
  let calls = 0;
  const jev = createJev('fake-secret', async () => { calls++; return { ok: false, status: 400, text: async () => 'Too many questions: fake-secret' }; });
  await assert.rejects(jev({}, { q: choice('Choose', { yes: 'Yes' }) }), e => e.message.includes('Too many questions') && !e.message.includes('fake-secret'));
  assert.equal(calls, 1);
});

test('serialized byte budget splits requests even below the question-count budget', async () => {
  let calls = 0;
  const jev = createJev('fake-key', async (_, req) => {
    calls++; assert.ok(Buffer.byteLength(req.body, 'utf8') <= 96000);
    return { ok: true, json: async () => ({ answers: Object.fromEntries(Object.keys(JSON.parse(req.body).questions).map(key => [key, { type: 'choice', choice: 'yes' }])) }) };
  });
  const questions = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`q${i}`, choice('Choose', { yes: 'ą'.repeat(20000) })]));
  assert.equal(Object.keys(await jev({}, questions)).length, 4);
  assert.equal(calls, 2);
});
