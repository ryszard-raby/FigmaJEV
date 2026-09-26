import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../server/planner.mjs';
import { parseCompactTree, collectRequired } from '../server/compact-tree.mjs';
import { componentCandidates } from '../server/resolver.mjs';
mock.method(console, 'log', () => {});

const slot = { name: 'Content', path: [0], capacity: 0, settings: { maxChildren: 12 } };
const catalog = [
  { id: 'layout', name: 'Layout', slots: [slot] },
  { id: 'card', name: 'Card', slots: [slot] },
  { id: 'input', name: 'Input', properties: { 'Password#1': { type: 'BOOLEAN' } } },
  { id: 'primary', name: 'Button / Main', properties: { 'Label#1': { type: 'TEXT' } } },
  { id: 'secondary', name: 'Button / Quiet', properties: { 'Label#1': { type: 'TEXT' } } },
];
function model(calls = []) {
  return async (state, questions) => {
    calls.push({ state, questions });
    if (state.phase === 'component-resolution') return Object.fromEntries(state.requiredComponents.map(n => [n.id,
      n.name === 'Button' ? (n.properties.importance === 'secondary' ? 'secondary' : 'primary') : n.name === 'Container' ? 'native_container' : n.name === 'Text' ? 'native_text' : n.name.toLowerCase()
    ]));
    return Object.fromEntries(Object.entries(questions).map(([key, q]) => {
      const node = state.requiredComponents.find(n => q.instructions.includes(`for ${n.id} (`));
      const options = Object.keys(q.criteria);
      let answer = options.includes('KEEP') ? 'KEEP' : options[0];
      if (q.instructions.includes('Resolve property:Label')) answer = options.find(v => q.criteria[v].startsWith('text:')) || 'KEEP';
      if (q.instructions.includes('Resolve property:Password')) answer = node.properties.purpose === 'password' ? 'true' : 'false';
      if (q.instructions.includes('Resolve direction') && node.properties.direction === 'horizontal') answer = 'HORIZONTAL';
      if (q.instructions.includes('Resolve primaryAlign') && node.properties.align === 'right') answer = 'MAX';
      return [key, answer];
    }));
  };
}

test('compact parser preserves order, intent and repeated nodes; rejects malformed trees before JEV', async () => {
  const root = parseCompactTree('["Container", ["Input"], ["Input"]]');
  assert.equal(root.children.length, 2);
  assert.equal(root.children[1].path, 'root/1');
  for (const bad of ['invalid', {}, ['Card', null], ['Card', { nested: {} }], ['Container', ...Array(32).fill(['Button'])]]) {
    await assert.rejects(plan({ structure: bad, catalog }, () => { throw new Error('MUST NOT CALL'); }), e => !e.message.includes('MUST NOT CALL'));
  }
});

test('login tree resolves in two requests with exact hierarchy and distinct semantic properties', async () => {
  const structure = ['Layout', ['Card', ['Text', { type: 'heading', text: 'Zaloguj się' }], ['Input', { purpose: 'login' }], ['Input', { purpose: 'password' }], ['Container', { direction: 'horizontal', align: 'right' }, ['Button', { importance: 'secondary', text: 'Anuluj' }], ['Button', { importance: 'primary', text: 'Zaloguj' }]]]];
  const calls = [];
  const result = await plan({ structure, catalog }, model(calls));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(c => c.state.phase), ['component-resolution', 'property-resolution']);
  const card = result.tree.slots[0].children[0];
  const children = card.slots[0].children;
  assert.equal(children.length, 4);
  assert.equal(children[0].text, 'Zaloguj się');
  assert.equal(children[1].properties['Password#1'], false);
  assert.equal(children[2].properties['Password#1'], true);
  assert.equal(children[3].primaryAlign, 'MAX');
  assert.deepEqual(children[3].children.map(n => [n.componentId, n.properties['Label#1']]), [['secondary', 'Anuluj'], ['primary', 'Zaloguj']]);
  assert.equal(card.slots[0].mode, 'replace'); // full default slots remain valid replacement targets
  assert.equal(result.exactTree, true);
  assert.ok(!Object.values(calls[1].questions).some(q => /number of|next child|additional children/i.test(q.instructions)));
});

test('identical nodes reuse decisions but remain separate output nodes; context/intent prevent unsafe reuse', async () => {
  const structure = ['Container', ['Button'], ['Button']];
  const calls = [];
  const result = await plan({ structure, catalog }, model(calls));
  assert.equal(result.resolutionCount, 2);
  assert.equal(result.tree.children.length, 2);
  assert.notEqual(result.tree.children[0], result.tree.children[1]);
  assert.deepEqual(calls[0].state.requiredComponents[1].paths, ['root/0', 'root/1']);
  const contextual = collectRequired(parseCompactTree(['Container', ['Card', { purpose: 'a' }, ['Button']], ['Card', { purpose: 'b' }, ['Button']]]));
  assert.equal(contextual.required.filter(n => n.name === 'Button').length, 2);
});

test('missing components and invalid JEV choices fail explicitly', async () => {
  await assert.rejects(plan({ structure: ['Unknown'], catalog }, async () => ({ n0: 'unresolved' })), /JEV nie dopasował/);
  await assert.rejects(plan({ structure: ['Button'], catalog }, async () => ({ n0: 'invented' })), /decyzj/);
  await assert.rejects(plan({ structure: ['Button', { text: 'Save' }], catalog: [{ id: 'primary', name: 'Button' }] }, model()), /tekstu/);
});

test('bare Button offers only its family variants and explains missing properties are unconstrained', async () => {
  const calls = [];
  await plan({ structure: ['Button'], catalog }, model(calls));
  assert.deepEqual(Object.keys(calls[0].questions.n0.criteria), ['primary', 'secondary', 'unresolved']);
  assert.deepEqual(calls[0].state.catalog.map(c => c.id), ['primary', 'secondary']);
  assert.match(calls[0].questions.n0.instructions, /Unspecified properties impose no constraints/);
  await assert.rejects(plan({ structure: ['Button'], catalog }, async () => ({ n0: 'unresolved' })), /Kandydaci: Button \/ Main; Button \/ Quiet/);
});

test('generic family lookup respects names and capacity without choosing variants or unrelated fallback', () => {
  const items = [
    { id: 'a', name: 'Controls / Checkbox / State=Checked' },
    { id: 'b', name: 'Checkbox / State=Default' },
    { id: 'c', name: 'CheckboxGroup' },
    { id: 'card', name: 'Card', slots: [slot] },
  ];
  assert.deepEqual(componentCandidates({ name: ' checkbox ', childCount: 0 }, items).map(c => c.id), ['a', 'b']);
  assert.equal(componentCandidates({ name: 'Toggle', childCount: 0 }, items).length, items.length);
  assert.equal(componentCandidates({ name: 'Checkbox', childCount: 1 }, items).length, 0);
});

test('sizing questions allow Fill on both axes including root and Hug slots', async () => {
  const ds = [{ id: 'card', name: 'Card', slots: [{ ...slot, width: 'FILL', height: 'HUG' }] }];
  const calls = [];
  const result = await plan({ structure: ['Card', ['Container']], catalog: ds }, async (state, questions) => {
    if (state.phase === 'component-resolution') return { n0: 'card', n1: 'native_container' };
    calls.push(questions);
    return Object.fromEntries(Object.entries(questions).map(([key, q]) => [key,
      q.instructions.includes('Resolve width for n1') ? 'FILL' : 'KEEP' in q.criteria ? 'KEEP' : Object.keys(q.criteria)[0]
    ]));
  });
  const question = (field, id) => Object.values(calls[0]).find(q => q.instructions.startsWith(`Resolve ${field} for ${id} (`));
  assert.ok('FILL' in question('width', 'n1').criteria);
  assert.ok('FILL' in question('height', 'n1').criteria);
  assert.ok('FILL' in question('width', 'n0').criteria);
  assert.equal(result.tree.slots[0].children[0].width, 'FILL');
  assert.equal(result.tree.slots[0].children[0].height, 'KEEP');
});

test('sizing options do not depend on parent or slot sizing', async () => {
  for (const [structure, ds] of [
    [['Container', ['Button']], catalog],
    [['Card', ['Button']], catalog],
    [['Card', ['Button']], [{ id: 'card', name: 'Card', slots: [{ ...slot, width: 'FIXED', height: 'FIXED' }, { ...slot, path: [1], width: 'HUG', height: 'HUG' }] }, ...catalog.filter(c => c.id !== 'card')]],
  ]) {
    const calls = [];
    await plan({ structure, catalog: ds }, model(calls));
    const axes = Object.values(calls[1].questions).filter(q => /^Resolve (width|height) for n1 /.test(q.instructions));
    assert.equal(axes.length, 2);
    for (const q of axes) assert.deepEqual(Object.keys(q.criteria), ['KEEP', 'HUG', 'FILL']);
  }
});

test('JEV chooses the variant; renderer plan does not reinterpret importance', async () => {
  const decide = model();
  const result = await plan({ structure: ['Button', { importance: 'primary' }], catalog }, async (state, questions) => state.phase === 'component-resolution' ? { n0: 'secondary' } : decide(state, questions));
  assert.equal(result.tree.componentId, 'secondary');
});

test('quick edit can remove a specific child or increase existing text without recursive planning', async () => {
  const context = { targetId: 'root', nodes: [{ id: 'root', name: 'Card', type: 'INSTANCE' }, { id: 'label', name: 'Label', type: 'TEXT', fontSize: 16, removable: true }] };
  const removed = await plan({ prompt: 'usuń tekst', context, catalog }, async (_, questions) => 'action' in questions ? { action: 'remove' } : { target: 'label' });
  assert.deepEqual(removed, { mode: 'remove', targetId: 'root', nodeId: 'label' });
  const edited = await plan({ prompt: 'zrób większy tekst', context, catalog }, async (_, questions) => 'action' in questions ? { action: 'properties' } : { q0: '20' });
  assert.deepEqual(edited.operations, [{ id: 'label', field: 'fontSize', value: 20 }]);
});

test('quick insert uses resolved component and preserves pinned target', async () => {
  const context = { targetId: 'root', nodes: [{ id: 'slot', name: 'Content', contentSlot: { capacity: 2 } }] };
  const decide = model(); let calls = 0;
  const result = await plan({ prompt: 'dodaj przycisk', context, catalog }, async (state, questions) => {
    calls++;
    if ('action' in questions) return { action: 'insert' };
    if ('target' in questions) return { target: 'slot', component: 'primary' };
    if (state.phase === 'component-resolution') return { n0: 'primary' };
    return decide(state, questions);
  });
  assert.equal(result.mode, 'insert'); assert.equal(result.targetId, 'root');
  assert.equal(result.children.length, 1); assert.equal(result.children[0].componentId, 'primary');
  assert.equal(calls, 4);
});
