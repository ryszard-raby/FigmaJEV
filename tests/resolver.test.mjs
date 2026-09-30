import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../server/planner.mjs';
import { parseCompactTree, collectRequired } from '../server/compact-tree.mjs';
import { componentCandidates } from '../server/resolver.mjs';

test('large snapshot does not expand the model context for a selected component', async () => {
  const context = { targetId: 'button', nodes: [
    { id: 'button', name: 'Button', type: 'INSTANCE', properties: { Style: { type: 'VARIANT', value: 'Primary', options: ['Primary', 'Outline'] } } },
    ...Array.from({ length: 1000 }, (_, i) => ({ id: `detail${i}`, parentId: 'button', type: 'VECTOR', name: 'Internal detail', width: 10, height: 10 }))
  ] };
  let calls = 0;
  const result = await plan({ prompt: 'zmień na outline', context, catalog: [] }, async (state, questions) => {
    calls++;
    assert.ok(!JSON.stringify({ state, questions }).includes('Internal detail'));
    assert.ok(JSON.stringify({ state, questions }).length < 2000);
    return 'action' in questions ? { action: 'properties' } : { q0: 'v1' };
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.operations, [{ id: 'button', field: 'property:Style', value: 'Outline' }]);
});

test('icon edit exposes swap candidates by name and description without internal vectors', async () => {
  const context = { targetId: 'button', nodes: [
    { id: 'button', name: 'Button', type: 'INSTANCE', properties: { 'Icon#1': { type: 'INSTANCE_SWAP', value: '1:10' }, 'Show Icon#2': { type: 'BOOLEAN', value: false } } },
    { id: 'path', parentId: 'button', type: 'VECTOR', name: 'Stroke' },
  ] };
  const ds = [{ id: 'bell', key: 'bell-key', name: 'Icons / Alarm', description: 'Bell notification icon' }];
  const result = await plan({ prompt: 'zmień ikonę na dzwonek', context, catalog: ds }, async (state, questions) => {
    assert.ok(!JSON.stringify(state).includes('Stroke'));
    if ('action' in questions) return { action: 'properties' };
    assert.equal(state.catalog, undefined);
    if (questions.q0.criteria.change) {
      assert.ok(!JSON.stringify({ state, questions }).includes('bell-key'));
      return { q0: 'change', q1: 'true' };
    }
    assert.equal(questions.q0.criteria['bell-key'], 'Icons / Alarm: Bell notification icon');
    return { q0: 'bell-key' };
  });
  assert.deepEqual(result.operations, [{ id: 'button', field: 'property:Show Icon#2', value: true }, { id: 'button', field: 'property:Icon#1', value: 'bell-key' }]);
  const noop = await plan({ prompt: 'zmień ikonę na dzwonek', context, catalog: [] }, async (_, questions) => 'action' in questions ? { action: 'properties' } : Object.fromEntries(Object.keys(questions).map(k => [k, 'keep'])));
  assert.equal(noop.operations.length, 0); assert.ok(noop.warnings.length);
});

test('show icon edits visibility without a replacement request', async () => {
  const context = { targetId: 'button', nodes: [{ id: 'button', name: 'Button', type: 'INSTANCE', properties: {
    'Icon#1': { type: 'INSTANCE_SWAP', value: '1:10' }, 'Show Icon#2': { type: 'BOOLEAN', value: false }
  } }] };
  let calls = 0;
  const result = await plan({ prompt: 'pokaż ikonę', context, catalog: [{ id: 'bell', key: 'bell', name: 'Bell' }] }, async (state, questions) => {
    calls++;
    if (questions.action) return { action: 'properties' };
    assert.match(state.instructions, /visibility BOOLEAN only/);
    assert.match(questions.q0.criteria.change, /Showing or hiding the existing one means keep/);
    return { q0: 'keep', q1: 'true' };
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.operations, [{ id: 'button', field: 'property:Show Icon#2', value: true }]);
});

test('missing swap replacement preserves other JEV property decisions and reports the missing replacement', async () => {
  const context = { targetId: 'button', nodes: [{ id: 'button', name: 'Button', type: 'INSTANCE', properties: {
    'Icon#1': { type: 'INSTANCE_SWAP', value: '1:10' }, 'Show Icon#2': { type: 'BOOLEAN', value: false }
  } }] };
  const result = await plan({ prompt: 'pokaż ikonę', context, catalog: [{ id: 'bell', key: 'bell', name: 'Bell' }] }, async (_, questions) => {
    if (questions.action) return { action: 'properties' };
    if (questions.q0.criteria.change) return { q0: 'change', q1: 'true' };
    return { q0: 'none' };
  });
  assert.deepEqual(result.operations, [{ id: 'button', field: 'property:Show Icon#2', value: true }]);
  assert.match(result.warnings[0], /nie znalazł zamiennika/);
});

test('vectors never enter JEV edit context or choices; deletion sends only identifying data', async () => {
  for (const action of ['remove', 'properties', 'insert']) {
    const context = { targetId: 'root', nodes: [
      { id: 'root', name: 'Card', type: 'FRAME', insertable: true, width: 500, sizing: { width: { allowed: ['HUG', 'FILL'] } } },
      { id: 'slot', parentId: 'root', name: 'Content', type: 'SLOT', contentSlot: { capacity: 3 } },
      { id: 'button', parentId: 'root', name: 'Vector (Stroke)', type: 'INSTANCE', removable: true, properties: { Size: { type: 'VARIANT', value: 'Small', options: ['Small', 'Default'] } } },
      { id: 'svg-path', parentId: 'button', name: 'Hidden SVG detail', type: 'VECTOR', removable: true, width: 12 },
    ] };
    const original = JSON.stringify(context);
    await plan({ prompt: 'zmień element', context, catalog }, async (state, questions) => {
      assert.ok(!JSON.stringify({ state, questions }).includes('svg-path'));
      if ('action' in questions) return { action };
      if (action === 'remove') {
        assert.deepEqual(Object.keys(state), ['prompt', 'selected']);
        assert.equal(state.selected, null);
        assert.equal(questions.target.criteria.r0, 'Vector (Stroke)');
        return { target: 'r0' };
      }
      if ('component' in questions) return { component: 'primary' };
      if ('target' in questions) return { target: 'slot' };
      return Object.fromEntries(Object.entries(questions).map(([key, q]) => [key, 'keep' in q.criteria ? 'keep' : 'KEEP' in q.criteria ? 'KEEP' : Object.keys(q.criteria)[0]]));
    });
    assert.equal(JSON.stringify(context), original);
  }
});

test('selecting a vector asks to select its component before calling JEV', async () => {
  await assert.rejects(plan({ prompt: 'usuń', catalog, context: { targetId: 'v', nodes: [{ id: 'v', type: 'VECTOR' }] } }, () => assert.fail('No model call expected')), /warstwy wektorowej/);
});
mock.method(console, 'log', () => {});

const slot = { name: 'Content', path: [0], capacity: 0, settings: { maxChildren: 12 } };
const catalog = [
  { id: 'layout', name: 'Layout', slots: [slot] },
  { id: 'card', name: 'Card', slots: [slot] },
  { id: 'input', name: 'Input', properties: { 'Password#1': { type: 'BOOLEAN' } } },
  { id: 'primary', name: 'Button / Main', properties: { 'Label#1': { type: 'TEXT' } } },
  { id: 'secondary', name: 'Button / Quiet', properties: { 'Label#1': { type: 'TEXT' } } },
];
test('quick edit can remove a specific child but no longer edits raw text layer geometry', async () => {
  const context = { targetId: 'root', nodes: [{ id: 'root', name: 'Card', type: 'FRAME' }, { id: 'label', name: 'Label', type: 'TEXT', fontSize: 16, removable: true }] };
  const removed = await plan({ prompt: 'usuń tekst', context, catalog }, async (_, questions) => 'action' in questions ? { action: 'remove' } : { target: 'r0' });
  assert.deepEqual(removed, { mode: 'remove', targetId: 'root', nodeId: 'label' });
  const edited = await plan({ prompt: 'zrób większy tekst', context, catalog }, async (_, questions) => 'action' in questions ? { action: 'properties' } : { q0: '20' });
  assert.deepEqual(edited.operations, []);
  assert.ok(edited.warnings.length);
});

test('named removal uses concise own names and maps the chosen descendant without another request', async () => {
  const context = { targetId: '51:4856', nodes: [
    { id: '51:4856', name: 'Layout', type: 'INSTANCE', removable: true },
    { id: 'layout-slot', parentId: '51:4856', name: 'Content', type: 'SLOT' },
    { id: 'I51:4856;305:8310;51:4861', parentId: 'layout-slot', name: 'Card', type: 'INSTANCE', removable: true },
    { id: 'card-slot', parentId: 'I51:4856;305:8310;51:4861', name: 'Content', type: 'SLOT' },
    { id: 'I51:4856;305:8310;51:4861;37:39;51:6475', parentId: 'card-slot', name: 'Product', description: 'Product details', type: 'INSTANCE', removable: true }
  ] };
  let calls = 0;
  const result = await plan({ prompt: 'usuń produkt', context, catalog: [] }, async (state, questions) => {
    calls++;
    if ('action' in questions) return { action: 'remove' };
    assert.deepEqual(state, { prompt: 'usuń produkt', selected: 'r0' });
    assert.deepEqual(questions.target.criteria, { none: 'No matching element', r0: 'Layout', r1: 'Card', r2: 'Product: Product details' });
    assert.ok(!JSON.stringify({ state, questions }).includes('51:4856'));
    assert.match(questions.target.instructions, /explicitly named target takes priority/);
    return { target: 'r2' };
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, { mode: 'remove', targetId: context.targetId, nodeId: context.nodes[4].id });
});

test('removal distinguishes namesakes by path and retains the no-match choice', async () => {
  const context = { targetId: 'root', nodes: [
    { id: 'root', name: 'Layout', type: 'FRAME', removable: true },
    { id: 'left', parentId: 'root', name: 'Left', type: 'INSTANCE' },
    { id: 'left-slot', parentId: 'left', name: 'Content', type: 'SLOT' },
    { id: 'a', parentId: 'left-slot', name: 'Card', type: 'INSTANCE', removable: true },
    { id: 'right', parentId: 'root', name: 'Right', type: 'INSTANCE' },
    { id: 'right-slot', parentId: 'right', name: 'Content', type: 'SLOT' },
    { id: 'b', parentId: 'right-slot', name: 'Card', type: 'INSTANCE', removable: true }
  ] };
  const result = await plan({ prompt: 'usuń zdjęcie', context, catalog: [] }, async (_, questions) => {
    if ('action' in questions) return { action: 'remove' };
    assert.equal(questions.target.criteria.r0, 'Layout');
    assert.equal(questions.target.criteria.r1, 'Card (path: Layout / Left / Card)');
    assert.equal(questions.target.criteria.r2, 'Card (path: Layout / Right / Card)');
    return { target: 'none' };
  });
  assert.equal(result.nodeId, null);
});

test('removal and edit target choices include actual Label text without unrelated properties', async () => {
  const context = { targetId: 'root', nodes: [
    { id: 'root', name: 'Layout', type: 'FRAME' },
    { id: 'cancel', parentId: 'root', name: 'Button', type: 'INSTANCE', removable: true, properties: {
      'Label#12:34': { type: 'TEXT', value: 'Anuluj', defaultValue: 'Default label' },
      Size: { type: 'VARIANT', value: 'UNRELATED_SIZE', options: ['UNRELATED_SIZE'] }
    } },
    { id: 'login', parentId: 'root', name: 'Button', type: 'INSTANCE', removable: true, properties: {
      Label: { type: 'TEXT', value: 'Zaloguj' }
    } }
  ] };
  for (const action of ['remove', 'properties']) {
    let calls = 0;
    const result = await plan({ prompt: `${action === 'remove' ? 'usuń' : 'zmień'} przycisk Anuluj`, context, catalog: [] }, async (_, questions) => {
      calls++;
      if ('action' in questions) return { action };
      if ('target' in questions) {
        const criteria = questions.target.criteria;
        assert.match(criteria[action === 'remove' ? 'r0' : 'cancel'], /Label: "Anuluj"/);
        assert.match(criteria[action === 'remove' ? 'r1' : 'login'], /Label: "Zaloguj"/);
        assert.ok(!JSON.stringify(questions).includes('UNRELATED_SIZE'));
        assert.ok(!JSON.stringify(questions).includes('Default label'));
        return { target: action === 'remove' ? 'r0' : 'cancel' };
      }
      return { q0: 'keep' };
    });
    assert.equal(calls, action === 'remove' ? 2 : 3);
    if (action === 'remove') assert.equal(result.nodeId, 'cancel');
  }
});

test('quick insert uses resolved component and preserves pinned target', async () => {
  const context = { targetId: 'root', nodes: [{ id: 'slot', name: 'Content', contentSlot: { capacity: 2 } }] };
  let calls = 0;
  const result = await plan({ prompt: 'dodaj przycisk', context, catalog }, async (state, questions) => {
    calls++;
    if ('action' in questions) { assert.equal(state.catalog, undefined); return { action: 'insert' }; }
    if ('component' in questions) { assert.equal(state.context, undefined); assert.equal(state.catalog, undefined); return { component: 'primary' }; }
    if ('target' in questions) { assert.equal(state.context, undefined); return { target: 'slot' }; }
    assert.fail('Unexpected extra JEV call');
  });
  assert.equal(result.mode, 'insert'); assert.equal(result.targetId, 'root');
  assert.equal(result.children.length, 1); assert.equal(result.children[0].componentId, 'primary');
  assert.equal(calls, 3);
  assert.deepEqual(result.children[0], { type: 'component', componentId: 'primary', width: 'KEEP', height: 'KEEP' });
});

test('enlarging an instance asks only for its exposed properties without catalog or sublayers', async () => {
  const context = { targetId: 'button', nodes: [
    { id: 'button', name: 'Button', type: 'INSTANCE', layout: { direction: 'HORIZONTAL' }, sizing: { width: { allowed: ['HUG', 'FILL'] } }, properties: { Size: { type: 'VARIANT', value: 'Small', options: ['Small', 'Default'] } } },
    { id: 'internal', parentId: 'button', name: 'Label', type: 'TEXT', fontSize: 12, sizing: { width: { allowed: ['HUG', 'FILL'] } } },
  ] };
  let calls = 0;
  const result = await plan({ prompt: 'powiększ button', context, catalog }, async (state, questions) => {
    calls++;
    assert.equal(state.catalog, undefined);
    assert.ok(!JSON.stringify(state).includes('"id":"internal"'));
    if ('action' in questions) return { action: 'properties' };
    assert.equal(state.context, undefined);
    assert.equal(state.component.properties.Size.value, 'Small');
    assert.equal(Object.keys(questions).length, 1);
    assert.deepEqual(questions.q0.criteria, { keep: 'Unchanged', v0: 'Small', v1: 'Default' });
    return { q0: 'v1' };
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.operations, [{ id: 'button', field: 'property:Size', value: 'Default' }]);
});

test('editing surroundings first selects one UI component, then sends only its exposed properties', async () => {
  const context = { targetId: 'row', nodes: [
    { id: 'row', name: 'Container', type: 'FRAME', width: 900, layout: { direction: 'HORIZONTAL' } },
    { id: 'button', parentId: 'row', name: 'Button', type: 'INSTANCE', description: 'Action button', properties: { Style: { type: 'VARIANT', value: 'Primary', options: ['Primary', 'Outline'] } } },
    { id: 'inner-icon', parentId: 'button', name: 'Internal icon', type: 'INSTANCE', properties: { Hidden: { type: 'BOOLEAN', value: true } } },
    { id: 'card', parentId: 'row', name: 'Card', type: 'INSTANCE', properties: { Size: { type: 'VARIANT', value: 'Default', options: ['Default'] } } },
  ] };
  let calls = 0;
  const result = await plan({ prompt: 'zmień przycisk na outline', catalog, context }, async (state, questions) => {
    calls++;
    assert.ok(!JSON.stringify({ state, questions }).includes('inner-icon'));
    assert.equal(state.context, undefined); assert.equal(state.catalog, undefined);
    if ('action' in questions) return { action: 'properties' };
    if ('target' in questions) {
      assert.deepEqual(Object.keys(questions.target.criteria), ['button', 'card']);
      return { target: 'button' };
    }
    assert.deepEqual(Object.keys(state.component), ['name', 'description', 'properties']);
    assert.equal(state.component.description, 'Action button');
    assert.equal(state.component.properties.Size, undefined);
    return { q0: 'v1' };
  });
  assert.equal(calls, 3);
  assert.deepEqual(result.operations, [{ id: 'button', field: 'property:Style', value: 'Outline' }]);
});

test('insertion tells JEV to group matching siblings instead of nesting inside them', async () => {
  const context = { targetId: 'layout', nodes: [
    { id: 'layout', name: 'Layout', type: 'INSTANCE' },
    { id: 'outer', parentId: 'layout', name: 'Content', type: 'SLOT', contentSlot: { capacity: 3, existingChildren: [{ name: 'Container', type: 'INSTANCE' }] } },
    { id: 'list', parentId: 'outer', name: 'Container', type: 'INSTANCE' },
    { id: 'products', parentId: 'list', name: 'Content', type: 'SLOT', contentSlot: { capacity: 3, existingChildren: [{ name: 'Product', type: 'INSTANCE' }, { name: 'Product', type: 'INSTANCE' }] } },
    { id: 'product', parentId: 'products', name: 'Product', type: 'INSTANCE' },
    { id: 'inner', parentId: 'product', name: 'Content', type: 'SLOT', contentSlot: { capacity: 3, existingChildren: [{ name: 'Text', type: 'INSTANCE' }, { name: 'INTERNAL_VECTOR', type: 'VECTOR' }] } }
  ] };
  let calls = 0;
  const result = await plan({ prompt: 'dodaj produkt', context, catalog: [{ id: 'product', name: 'Product / Vertical' }] }, async (state, questions) => {
    calls++;
    if (questions.action) return { action: 'insert' };
    if (questions.component) return { component: 'product' };
    assert.equal(state.selected, 'Layout');
    assert.equal(questions.target.criteria.products, 'Layout / Container / Content; direct children: ["Product"]');
    assert.equal(questions.target.criteria.inner, 'Layout / Container / Product / Content; direct children: ["Text"]');
    assert.match(questions.target.instructions, /first prefer a slot already containing components of the same kind/);
    assert.match(questions.target.instructions, /add beside them as a sibling, not inside/);
    return { target: 'products' };
  });
  assert.equal(calls, 3);
  assert.equal(result.parentId, 'products');
});

test('insertion uses only slots and never sends snapshot, properties, geometry or sibling internals', async () => {
  const context = { targetId: 'card', nodes: [
    { id: 'card', name: 'Card', type: 'INSTANCE', width: 500, height: 800, properties: { 'UNNEEDED_PROPERTY': { type: 'BOOLEAN', value: true } } },
    { id: 'slot', parentId: 'card', name: 'Content', type: 'SLOT', contentSlot: { capacity: 2, preferredValues: ['UNNEEDED_SLOT_METADATA'] } },
    { id: 'frame', parentId: 'card', name: 'UNNEEDED_FRAME', type: 'FRAME', insertable: true },
  ] };
  const calls = [];
  const result = await plan({ prompt: 'Dodaj button', context, catalog }, async (state, questions) => {
    calls.push({ state, questions });
    assert.ok(!JSON.stringify({ state, questions }).includes('UNNEEDED'));
    if ('action' in questions) return { action: 'insert' };
    if ('component' in questions) { assert.deepEqual(state, { prompt: 'Dodaj button' }); return { component: 'primary' }; }
    assert.deepEqual(Object.keys(questions.target.criteria), ['slot']);
    assert.equal(questions.target.criteria.slot, 'Card / Content');
    return { target: 'slot' };
  });
  assert.equal(calls.length, 3);
  assert.equal(result.children[0].componentId, 'primary');
  assert.equal(result.children[0].properties, undefined);
  let attempts = 0;
  await assert.rejects(plan({ prompt: 'Dodaj button', catalog, context: { targetId: 'frame', nodes: [{ id: 'frame', type: 'FRAME', insertable: true }] } }, async () => { attempts++; return { action: 'insert' }; }), /slotu Content/);
  assert.equal(attempts, 1);
});
