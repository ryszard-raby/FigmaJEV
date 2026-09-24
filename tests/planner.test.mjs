import test from 'node:test';
import assert from 'node:assert/strict';
import { plan, textCandidates } from '../server/planner.mjs';
import { createJev, validateAnswers } from '../server/jev.mjs';

test('DefAPI endpoint, auth, model and typed response contract', async () => {
  const decide = createJev('test-key', async (url, req) => {
    assert.equal(url, 'https://api.defapi.org/api/v1/decisions');
    assert.equal(req.headers.Authorization, 'Bearer test-key');
    assert.equal(JSON.parse(req.body).model, 'typesafe/jev-1.13');
    return { ok: true, json: async () => ({ answers: { a: { type: 'choice', choice: 'yes' } } }) };
  });
  assert.deepEqual(await decide({}, { a: { criteria: { yes: 'Yes' } } }), { a: 'yes' });
});
test('rejects missing or out-of-schema model answers', () => {
  const q = { a: { criteria: { yes: 'Yes' } } };
  assert.throws(() => validateAnswers(q, {}));
  assert.throws(() => validateAnswers(q, { a: { type: 'choice', choice: '__proto__' } }));
});
test('builds a nested layout with real catalog IDs and quoted text', async () => {
  let call = 0;
  const result = await plan({ prompt: 'Karta „Oferta”', catalog: [{ id: 'button', name: 'Button / accent' }] }, async () => [
    { direction: 'VERTICAL', gap: '16', count: '2' },
    { child0: 'text', text0: 'v0', child1: 'container', text1: 'v0' },
    { direction: 'HORIZONTAL', gap: '8', count: '1' },
    { child0: 'button', text0: 'v0' }
  ][call++]);
  assert.equal(result.tree.children[0].text, 'Oferta');
  assert.equal(result.tree.children[1].children[0].componentId, 'button');
  assert.equal(call, 4);
});
test('recursive planner obeys total node and depth limits', async () => {
  let calls = 0;
  const result = await plan({ prompt: 'Nested containers', catalog: [] }, async (_, questions) => {
    calls++;
    return Object.fromEntries(Object.entries(questions).map(([key, q]) => [key,
      key === 'count' ? Object.keys(q.criteria).at(-1) : key.startsWith('child') && q.criteria.container ? 'container' : Object.keys(q.criteria)[0]
    ]));
  });
  let count = 0;
  function walk(n, depth = 0) { count++; assert.ok(depth <= 4); for (const child of n.children || []) walk(child, depth + 1); }
  walk(result.tree); assert.ok(count <= 32); assert.ok(calls <= 64);
});
test('pinned edit preserves target, skips unchanged fields and resolves variant', async () => {
  const context = { targetId: '1:1', nodes: [{ id: '1:1', name: 'Card', type: 'INSTANCE', properties: { Color: { type: 'VARIANT', value: 'primary', options: ['primary', 'accent'] } }, layout: { direction: 'VERTICAL', gap: 16 } }] };
  const result = await plan({ prompt: 'Zmień kolor na accent', catalog: [], context }, async (_, questions) => {
    return Object.fromEntries(Object.entries(questions).map(([key, q]) => [key, q.instructions.includes('property:Color') ? 'v1' : 'keep']));
  });
  assert.equal(result.targetId, '1:1');
  assert.deepEqual(result.operations, [{ id: '1:1', field: 'property:Color', value: 'accent' }]);
});
test('copy candidates retain Polish quoted text and do not invent copy', () => {
  assert.deepEqual(textCandidates('„Kup teraz” oraz "Anuluj"').slice(0, 2), ['Kup teraz', 'Anuluj']);
});
test('limits input before any paid request', async () => {
  await assert.rejects(plan({ prompt: '', catalog: [] }, () => assert.fail('Must not call API')));
  await assert.rejects(plan({ prompt: 'UI', catalog: Array(181).fill({ id: 'x', name: 'X' }) }, () => assert.fail()));
});
