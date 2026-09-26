import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { plan as trackedPlan, textCandidates } from '../server/legacy-planner.mjs';
import { createJev, validateAnswers } from '../server/jev.mjs';
mock.method(console, 'debug', () => {});

// Existing layout fixtures isolate layout decisions. Requirement-specific
// integration cases below use trackedPlan directly with explicit purposes.
const plan = (input, decide) => trackedPlan(input, async (state, questions) => {
  if (state.phase === 'requirements-count') return { total: '32' };
  if (state.phase === 'requirements-grounding') return Object.fromEntries(Object.keys(questions).map(key => [key, 's0']));
  if (state.phase === 'requirement-claim') return { requirement: state.candidate.contentSlots?.length ? 'structural' : state.remainingRequirements[0].id };
  return decide(state, questions);
});

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
    { direction: 'VERTICAL', width: 'FILL', height: 'HUG', count: '2' },
    { child0: 'text', text0: 'v0', width0: 'HUG' },
    { child1: 'container', text1: 'v0', width1: 'FILL' },
    { direction: 'HORIZONTAL', count: '1' },
    { child0: 'button', text0: 'v0' }
  ][call++]);
  assert.equal(result.tree.children[0].text, 'Oferta');
  assert.equal(result.tree.children[1].children[0].componentId, 'button');
  assert.equal(result.tree.width, 'FILL');
  assert.equal(result.tree.children[1].width, 'FILL');
  assert.equal(result.tree.children[1].height, 'KEEP');
  assert.ok(!JSON.stringify(result.tree).includes('gap'));
  assert.ok(!JSON.stringify(result.tree).includes('padding'));
  assert.equal(call, 5);
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

test('edits size using only supported options without spacing decisions', async () => {
  const result = await plan({ prompt: 'Fill width', catalog: [], context: { targetId: 'a', nodes: [{ id: 'a', name: 'Card', type: 'FRAME', sizing: { width: { allowed: ['HUG', 'FILL'] }, height: { allowed: ['HUG'] } }, layout: { direction: 'VERTICAL' } }] } }, async (_, questions) => {
    assert.ok(!JSON.stringify(questions).includes('gap'));
    return Object.fromEntries(Object.entries(questions).map(([key, q]) => [key, q.instructions.includes('choose width') ? 'FILL' : 'keep']));
  });
  assert.deepEqual(result.operations, [{ id: 'a', field: 'width', value: 'FILL' }]);
});

test('creation expands Content inside a catalog component', async () => {
  const catalog = [{ id: 'card', name: 'Card', slots: [{ path: [0], name: 'Content', width: 'HUG', height: 'HUG', capacity: 2 }] }, { id: 'button', name: 'Button' }];
  let call = 0;
  const result = await plan({ prompt: 'Card with button inside Content', catalog }, async () => [
    { direction: 'VERTICAL', width: 'HUG', height: 'HUG', count: '1' },
    { child0: 'card', text0: 'v0' }, { count: '1' }, { child0: 'button', text0: 'v0' }
  ][call++]);
  assert.equal(result.tree.children[0].slots[0].children[0].componentId, 'button');
  assert.deepEqual(result.tree.children[0].slots[0].path, [0]);
});

test('pinned insertion selects Content and respects its capacity', async () => {
  const context = { targetId: 'card', nodes: [{ id: 'slot', name: 'Content', type: 'SLOT', contentSlot: { capacity: 1, width: 'HUG', height: 'HUG' } }] };
  let call = 0;
  const result = await plan({ prompt: 'Add button', catalog: [{ id: 'button', name: 'Button' }], context }, async (_, questions) => {
    if (questions.count) assert.deepEqual(Object.keys(questions.count.criteria), ['0', '1']);
    return [{ action: 'insert' }, { count: '1' }, { child0: 'button', text0: 'v0' }][call++];
  });
  assert.equal(result.mode, 'insert'); assert.equal(result.parentId, 'slot');
  assert.equal(result.children[0].componentId, 'button');
});

test('button axes can remain unchanged even under a Hug parent', async () => {
  let call = 0;
  const result = await plan({ prompt: 'Add a button', catalog: [{ id: 'button', name: 'Button' }] }, async (_, questions) => {
    if (call++ === 0) return { direction: 'VERTICAL', width: 'HUG', height: 'HUG', count: '1' };
    assert.ok(questions.width0.criteria.KEEP);
    assert.ok(questions.height0.criteria.KEEP);
    assert.equal(questions.height0.criteria.FILL, undefined);
    return { child0: 'button', text0: 'v0', width0: 'KEEP', height0: 'KEEP' };
  });
  assert.equal(result.tree.children[0].width, 'KEEP');
  assert.equal(result.tree.children[0].height, 'KEEP');
});

test('Fill width can be selected independently of unchanged height', async () => {
  let call = 0;
  const result = await plan({ prompt: 'Button fill width, standard height', catalog: [{ id: 'button', name: 'Button' }] }, async (_, questions) => {
    if (call++ === 0) return { direction: 'VERTICAL', width: 'FILL', height: 'HUG', count: '1' };
    assert.ok(questions.width0.criteria.FILL); assert.ok(questions.width0.criteria.KEEP);
    return { child0: 'button', text0: 'v0', width0: 'FILL', height0: 'KEEP' };
  });
  assert.equal(result.tree.children[0].width, 'FILL');
  assert.equal(result.tree.children[0].height, 'KEEP');
});

test('slot questions identify their owner and expose a zero-child decision', async () => {
  let call = 0;
  const result = await plan({ prompt: 'Layout with content', catalog: [{ id: 'layout', name: 'Layout / vertical', slots: [{ path: [0], name: 'Content', width: 'HUG', height: 'HUG', capacity: 4, existingChildren: [] }] }] }, async (state, questions) => {
    if (call++ === 0) return { direction: 'VERTICAL', width: 'KEEP', height: 'KEEP', count: '1' };
    if (questions.child0) return { child0: 'layout', text0: 'v0', width0: 'KEEP', height0: 'KEEP' };
    assert.equal(state.currentComponent.name, 'Layout / vertical');
    assert.match(questions.count.instructions, /ALREADY been instantiated/);
    assert.doesNotMatch(questions.count.instructions, /add that component as one child/);
    return { count: '0' };
  });
  assert.equal(result.trace.find(t => t.slot === 'Content').count, '0');
  assert.match(result.warnings[0], /0 nowych dzieci/);
});

test('missing Content on Layout produces a diagnostic', async () => {
  let call = 0;
  const result = await plan({ prompt: 'Layout with content', catalog: [{ id: 'layout', name: 'Layout', slots: [] }] }, async () => [
    { direction: 'VERTICAL', width: 'KEEP', height: 'KEEP', count: '1' },
    { child0: 'layout', text0: 'v0', width0: 'KEEP', height0: 'KEEP' }
  ][call++]);
  assert.match(result.warnings[0], /nie wykryto natywnego slotu/);
});

test('one button and one input: second decision sees first selected component', async () => {
  const catalog = [{ id: 'button', name: 'Button / primary' }, { id: 'input', name: 'Input / default' }];
  let call = 0;
  const result = await plan({ prompt: 'utwórz widok z jednym buttonem i jednym inputem', catalog }, async (state, questions) => {
    call++;
    if (questions.count) return { count: '2', direction: 'VERTICAL', width: 'KEEP', height: 'KEEP' };
    const keys = Object.keys(questions).filter(key => /^child\d+$/.test(key));
    assert.equal(keys.length, 1);
    if (state.childIndex === 0) {
      assert.deepEqual(state.selectedSiblings, []);
      return { child0: 'button', width0: 'KEEP', height0: 'KEEP', text0: 'v0' };
    }
    assert.equal(state.expectedChildren, 2);
    assert.equal(state.selectedSiblings[0].componentId, 'button');
    assert.equal(state.selectedSiblings[0].name, 'Button / primary');
    assert.equal(state.tree.children[0].componentId, 'button');
    return { child1: 'input', width1: 'KEEP', height1: 'KEEP', text1: 'v0' };
  });
  assert.deepEqual(result.tree.children.map(c => c.componentId), ['button', 'input']);
  assert.equal(call, 3);
});

test('sequential sibling choices still allow intentionally repeated components', async () => {
  const result = await plan({ prompt: 'Dwa buttony', catalog: [{ id: 'button', name: 'Button' }] }, async (state, questions) => {
    if (questions.count) return { count: '2', direction: 'VERTICAL', width: 'KEEP', height: 'KEEP' };
    const i = state.childIndex;
    assert.ok(questions[`child${i}`].criteria.button);
    return { [`child${i}`]: 'button', [`width${i}`]: 'KEEP', [`height${i}`]: 'KEEP', [`text${i}`]: 'v0' };
  });
  assert.deepEqual(result.tree.children.map(c => c.componentId), ['button', 'button']);
});
