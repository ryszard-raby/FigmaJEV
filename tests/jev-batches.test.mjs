import test from 'node:test';
import assert from 'node:assert/strict';
import { createJev, choice } from '../server/jev.mjs';

test('client sends all requested decisions once without splitting', async () => {
  const questions = Object.fromEntries(Array.from({ length: 146 }, (_, i) => [`q${i}`, choice(`Resolve width for n${i} (Item)`, { KEEP: 'Preserve source' })]));
  const state = { phase: 'property-resolution', inputTree: { name: 'unused full tree' }, requiredComponents: Array.from({ length: 146 }, (_, i) => ({ id: `n${i}`, paths: [`root/${i}`], ancestors: [] })), selectedComponents: Object.fromEntries(Array.from({ length: 146 }, (_, i) => [`n${i}`, `c${i}`])), catalog: Array.from({ length: 146 }, (_, i) => ({ id: `c${i}` })) };
  let calls = 0;
  const jev = createJev('fake-key', async (_, req) => {
    calls++; const body = JSON.parse(req.body);
    assert.equal(Object.keys(body.questions).length, 146);
    assert.equal(body.state.requiredComponents.length, 146);
    assert.equal(body.state.catalog.length, 146);
    assert.equal(body.state.inputTree, undefined);
    return { ok: true, json: async () => ({ answers: Object.fromEntries(Object.keys(body.questions).map(key => [key, { type: 'choice', choice: 'KEEP' }])) }) };
  });
  const result = await jev(state, questions);
  assert.equal(calls, 1); assert.equal(Object.keys(result).length, 146);
  assert.equal(result.q145, 'KEEP');
});

test('provider error details are reported without retrying or exposing API key', async () => {
  let calls = 0;
  const jev = createJev('fake-secret', async () => { calls++; return { ok: false, status: 400, text: async () => 'Too many questions: fake-secret' }; });
  await assert.rejects(jev({}, { q: choice('Choose', { yes: 'Yes' }) }), e => e.message.includes('Too many questions') && !e.message.includes('fake-secret'));
  assert.equal(calls, 1);
});

test('token-limit errors do not split questions or retry', async () => {
  let calls = 0;
  const jev = createJev('fake', async () => {
    calls++;
    return { ok: false, status: 400, text: async () => '{"error_type":"max_tokens_exceeded"}' };
  }, undefined, {}, async () => {});
  await assert.rejects(jev({}, { a: choice('Choose', { yes: 'Yes' }), b: choice('Choose', { yes: 'Yes' }) }), /limit tokenów/);
  assert.equal(calls, 1);
});

