import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../server/planner.mjs';
import { componentCandidates } from '../server/resolver.mjs';
import { parseCompactTree } from '../server/compact-tree.mjs';
mock.method(console, 'log', () => {});
const slot = { name: 'Content', path: [0], capacity: 0 };
const catalog = [
  { id: 'layout', name: 'Layout / Mobile', slots: [slot] },
  { id: 'card', name: 'Card', slots: [slot] },
  { id: 'container', name: 'Container / Horizontal', slots: [slot] },
  { id: 'text', name: 'Text', properties: { 'Label#1': { type: 'TEXT' } } },
  { id: 'input', name: 'Input', properties: { 'Password#1': { type: 'BOOLEAN' }, 'Placeholder#2': { type: 'TEXT' } } },
  { id: 'primary', name: 'Button / Primary', description: 'Main action', properties: { 'Label#1': { type: 'TEXT' }, 'Icon#2': { type: 'INSTANCE_SWAP' } } },
  { id: 'secondary', name: 'Button / Secondary', properties: { 'Label#1': { type: 'TEXT' } } }
];
function model(calls = []) {
  return async (state, questions) => {
    calls.push({ state, questions });
    assert.equal(state.phase, 'component-resolution');
    return Object.fromEntries(state.requiredComponents.map(n => [n.id, n.name === 'Button' ? (n.properties.importance === 'secondary' ? 'secondary' : 'primary') : n.name.toLowerCase()]));
  };
}

test('login structure resolves with one component-only call and retains copy, hierarchy and explicit properties', async () => {
  const structure = ['Layout', { device: 'mobile' }, ['Card',
    ['Text', { type: 'heading', text: 'Zaloguj się' }],
    ['Input', { Placeholder: 'Login' }], ['Input', { Password: true, Placeholder: 'Hasło' }],
    ['Container', { direction: 'horizontal' }, ['Button', { importance: 'secondary', text: 'Anuluj' }], ['Button', { importance: 'primary', text: 'Zaloguj' }]]
  ]];
  const calls = [];
  const result = await plan({ structure, catalog }, model(calls));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].state.catalog, undefined);
  assert.equal(calls[0].state.inputTree, undefined);
  assert.ok(!JSON.stringify(calls).includes('INSTANCE_SWAP'));
  assert.ok(JSON.stringify(calls).includes('Main action'));
  const children = result.tree.slots[0].children[0].slots[0].children;
  assert.equal(children.length, 4);
  assert.equal(children[0].properties['Label#1'], 'Zaloguj się');
  assert.equal(children[1].properties['Placeholder#2'], 'Login');
  assert.equal(children[2].properties['Password#1'], true);
  assert.deepEqual(children[3].slots[0].children.map(n => [n.componentId, n.properties['Label#1']]), [['secondary', 'Anuluj'], ['primary', 'Zaloguj']]);
  assert.equal(result.tree.width, 'KEEP');
});

test('repeated nodes reuse component selection without dropping instances', async () => {
  const calls = [];
  const result = await plan({ structure: ['Container', ['Button'], ['Button']], catalog }, model(calls));
  assert.equal(Object.keys(calls[0].questions).length, 2);
  assert.equal(result.tree.slots[0].children.length, 2);
  assert.notEqual(result.tree.slots[0].children[0], result.tree.slots[0].children[1]);
});

test('default tree only asks four component questions', async () => {
  const calls = [];
  await plan({ structure: ['Layout', { device: 'mobile' }, ['Card', ['Container', ['Button']]]], catalog }, model(calls));
  assert.equal(calls.length, 1);
  assert.equal(Object.keys(calls[0].questions).length, 4);
  assert.ok(!Object.values(calls[0].questions).some(q => /native_container|native_text/.test(JSON.stringify(q))));
});

test('explicit sizing is copied without questions and unspecified axes inherit defaults', async () => {
  const result = await plan({ structure: ['Card', { width: 'hug' }, ['Button', { width: 'fill', height: 'hug' }]], catalog }, model());
  assert.equal(result.tree.width, 'HUG'); assert.equal(result.tree.height, 'KEEP');
  assert.equal(result.tree.slots[0].children[0].width, 'FILL');
  assert.equal(result.tree.slots[0].children[0].height, 'HUG');
});

test('unresolved and invalid component choices fail without a second request or native fallback', async () => {
  for (const answer of ['unresolved', 'invented']) {
    let calls = 0;
    await assert.rejects(plan({ structure: ['Button'], catalog }, async () => { calls++; return { n0: answer }; }));
    assert.equal(calls, 1);
  }
  await assert.rejects(plan({ structure: ['Text'], catalog: [] }, () => assert.fail('No call')), /brak komponentu/);
});

test('text maps to a unique layer; ambiguous text requires an explicit DS property', async () => {
  const result = await plan({ structure: ['Text', { text: 'Hello' }], catalog: [{ id: 'text', name: 'Text', textTargets: [{ name: 'Copy', path: [1] }] }] }, model());
  assert.deepEqual(result.tree.textOverrides, [{ path: [1], text: 'Hello' }]);
  const ds = [{ id: 'text', name: 'Text', properties: { Title: { type: 'TEXT' }, Subtitle: { type: 'TEXT' } } }];
  await assert.rejects(plan({ structure: ['Text', { text: 'Hello' }], catalog: ds }, model()), /jednoznacznego miejsca/);
  const explicit = await plan({ structure: ['Text', { Title: 'Hello' }], catalog: ds }, model());
  assert.deepEqual(explicit.tree.properties, { Title: 'Hello' });
});

test('Content is preferred; named slots work and ambiguous slots fail without extra JEV calls', async () => {
  const ds = [{ id: 'card', name: 'Card', slots: [{ name: 'Header', path: [0] }, { name: 'Content', path: [1] }] }, catalog[5]];
  const result = await plan({ structure: ['Card', ['Button']], catalog: ds }, model());
  assert.equal(result.tree.slots[0].children.length, 0);
  assert.equal(result.tree.slots[1].children.length, 1);
  const header = await plan({ structure: ['Card', { slot: 'Header' }, ['Button']], catalog: ds }, model());
  assert.equal(header.tree.slots[0].children.length, 1);
  ds[0].slots[1].name = 'Footer';
  await assert.rejects(plan({ structure: ['Card', ['Button']], catalog: ds }, model()), /jednoznacznego slotu/);
});

test('name lookup preserves variants and slot capacity filtering', () => {
  assert.deepEqual(componentCandidates({ name: 'Button', childCount: 0 }, catalog).map(c => c.id), ['primary', 'secondary']);
  assert.equal(componentCandidates({ name: 'Button', childCount: 1 }, catalog).length, 0);
});

test('large trees preserve quantities and parser limits', async () => {
  const result = await plan({ structure: ['Card', ...Array(255).fill(['Button'])], catalog }, model());
  assert.equal(result.tree.slots[0].children.length, 255);
  let nested = ['Button'];
  for (let i = 1; i < 32; i++) nested = ['Container', nested];
  assert.doesNotThrow(() => parseCompactTree(nested));
  assert.throws(() => parseCompactTree(['Container', nested]), /32 poziomy/);
  for (const bad of ['invalid', {}, ['Card', null], ['Card', { nested: {} }], ['Card', ...Array(256).fill(['Button'])]]) assert.throws(() => parseCompactTree(bad));
});
