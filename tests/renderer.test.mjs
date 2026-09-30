import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { plan } from '../server/planner.mjs';
mock.method(console, 'log', () => {});

const { code } = await transform(await readFile(new URL('../plugin/code.ts', import.meta.url), 'utf8'), { loader: 'ts', target: 'es2017' });
function harness(storage = new Map()) {
  let sequence = 0;
  const nodes = new Map(); const messages = []; const events = {};
  function frame(type = 'FRAME') {
    const n = { id: `id${sequence++}`, type, name: 'Card', visible: true, width: 300, height: 200, x: 0, y: 0,
      layoutMode: 'VERTICAL', itemSpacing: 16, layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED', layoutPositioning: 'AUTO', children: [], removed: false,
      resize(width, height) { n.width = width; n.height = height; },
      appendChild(child) { if (child.parent) child.parent.children = child.parent.children.filter(c => c !== child); child.parent = n; n.children.push(child); },
      remove() { n.removed = true; if (n.parent) n.parent.children = n.parent.children.filter(c => c !== n); for (const c of [...n.children]) c.remove(); nodes.delete(n.id); },
      findAllWithCriteria() { return []; }
    };
    nodes.set(n.id, n); return n;
  }
  const page = frame('PAGE'); page.selection = [];
  const figma = { currentPage: page, root: { children: [page] }, ui: { postMessage: m => messages.push(m) },
    clientStorage: { getAsync: async key => storage.get(key), setAsync: async (key, value) => { storage.set(key, value); } },
    showUI() {}, on: (event, fn) => { events[event] = fn; }, loadAllPagesAsync: async () => {},
    getNodeByIdAsync: async id => nodes.get(id) || null,
    createFrame() { const n = frame(); page.appendChild(n); return n; },
    viewport: { center: { x: 500, y: 500 }, scrollAndZoomIntoView() {} }, commitUndo() {},
    importComponentByKeyAsync: async () => { throw new Error('Import failed'); }
  };
  vm.runInNewContext(code, { figma, __html__: '', Error });
  function cardWithContent() {
    const component = frame('COMPONENT'); component.componentPropertyDefinitions = {};
    const definition = frame('SLOT'); definition.name = 'Content'; definition.limitViolations = []; component.appendChild(definition);
    const instance = frame('INSTANCE'); instance.componentProperties = {}; instance.getMainComponentAsync = async () => component;
    const slot = frame('SLOT'); slot.name = 'Content'; slot.limitViolations = []; instance.appendChild(slot); page.appendChild(instance);
    return { component, instance, slot };
  }
  return { figma, frame, page, messages, cardWithContent, send: m => figma.ui.onmessage(m) };
}

test('connection settings survive reopening and can be cleared', async () => {
  const storage = new Map();
  const first = harness(storage); await first.send({ type: 'init' });
  await first.send({ type: 'save-settings', token: 'test-token' });
  await first.send({ type: 'save-settings', libraryUrl: 'https://www.figma.com/design/testkey/Library' });
  const second = harness(storage); await second.send({ type: 'init' });
  const restored = second.messages.find(m => m.type === 'settings');
  assert.equal(restored.token, 'test-token'); assert.equal(restored.libraryUrl, 'https://www.figma.com/design/testkey/Library');
  await second.send({ type: 'save-settings', token: '', libraryUrl: '' });
  const third = harness(storage); await third.send({ type: 'init' });
  assert.equal(third.messages.find(m => m.type === 'settings').token, '');
  assert.equal(third.messages.find(m => m.type === 'settings').libraryUrl, '');
});

test('renderer merges technical root and host into one frame', async () => {
  const h = harness(); await h.send({ type: 'init' });
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Layout' });
  await h.send({ type: 'apply', plan: { mode: 'create', tree: { type: 'container', direction: 'HORIZONTAL', width: 'KEEP', height: 'KEEP', children: [] } } });
  assert.equal(h.page.children.length, 1);
  const host = h.page.children[0];
  assert.equal(host.name, 'FigmaJev');
  assert.equal(host.layoutSizingHorizontal, 'HUG');
  assert.equal(host.layoutSizingVertical, 'HUG');
  assert.equal(host.children.length, 0);
  assert.equal(host.layoutMode, 'HORIZONTAL');
  assert.equal(host.itemSpacing, 0);
  assert.equal(host.paddingTop, 0);
  assert.equal(h.page.selection[0], host);
  assert.equal(h.messages.at(-2).type, 'done');
});

test('renderer accepts a full 256-node tree and nesting beyond the old five-level cap', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const leaf = () => ({ type: 'container', direction: 'VERTICAL', width: 'KEEP', height: 'KEEP', children: [] });
  const tree = leaf(); let parent = tree;
  for (let i = 1; i < 32; i++) { const child = leaf(); parent.children.push(child); parent = child; }
  tree.children.push(...Array.from({ length: 224 }, leaf));
  await h.send({ type: 'prepare', libraryId: 'local' });
  await h.send({ type: 'apply', plan: { mode: 'create', tree } });
  assert.equal(h.messages.at(-2).type, 'done');
  assert.equal(h.page.children[0].children.length, 225);
});
test('renderer rejects unknown component and cleans partial layout', async () => {
  const h = harness(); await h.send({ type: 'init' });
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Layout' });
  await h.send({ type: 'apply', plan: { mode: 'create', tree: { type: 'container', direction: 'VERTICAL', width: 'HUG', height: 'HUG', children: [{ type: 'component', componentId: 'invented', width: 'HUG', height: 'HUG' }] } } });
  assert.equal(h.page.children.length, 0);
  assert.equal(h.messages.at(-1).type, 'error');
});

test('planned children are direct children of FigmaJev without Generated content', async () => {
  const h = harness(); await h.send({ type: 'init' });
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Layout' });
  await h.send({ type: 'apply', plan: { mode: 'create', tree: { type: 'container', name: 'Generated content', direction: 'VERTICAL', width: 'KEEP', height: 'HUG', children: [
    { type: 'container', name: 'Requested row', direction: 'HORIZONTAL', width: 'HUG', height: 'HUG', children: [] }
  ] } } });
  const root = h.page.children[0];
  assert.equal(root.name, 'FigmaJev');
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].name, 'Requested row');
  assert.equal(root.layoutSizingVertical, 'HUG');
  assert.equal(h.messages.at(-2).type, 'done');
});
test('selected edits keep identity even after changing selection', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const card = h.frame(); h.page.appendChild(card); h.page.selection = [card];
  
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Hug width' });
  h.page.selection = [];
  await h.send({ type: 'apply', plan: { mode: 'edit', targetId: card.id, operations: [{ id: card.id, field: 'width', value: 'HUG' }] } });
  assert.equal(card.layoutSizingHorizontal, 'HUG'); assert.equal(h.page.children[0], card);
  assert.equal(card.itemSpacing, 16);
});
test('clearing selection creates a layout and multiple selections cannot start an operation', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const card = h.frame(); const other = h.frame();
  h.page.appendChild(card); h.page.appendChild(other);
  h.page.selection = [card, other];
  await h.send({ type: 'prepare', libraryId: 'local' });
  assert.equal(h.messages.at(-1).type, 'error');
  assert.equal(h.messages.some(m => m.type === 'prepared'), false);
  h.page.selection = [];
  await h.send({ type: 'prepare', libraryId: 'local', structure: '["Container"]' });
  assert.equal(h.messages.at(-1).input.context, null);
});
test('concurrent user change invalidates plan without touching canvas', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const card = h.frame(); h.page.appendChild(card); h.page.selection = [card];
  
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Hug width' });
  card.layoutSizingVertical = 'HUG';
  await h.send({ type: 'apply', plan: { mode: 'edit', targetId: card.id, operations: [{ id: card.id, field: 'width', value: 'HUG' }] } });
  assert.equal(card.layoutSizingHorizontal, 'FIXED'); assert.equal(h.messages.at(-1).type, 'error');
});

test('snapshot accepts more than 80 layers and still detects changes in late descendants', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const root = h.frame(); h.page.appendChild(root); h.page.selection = [root];
  for (let i = 0; i < 200; i++) root.appendChild(h.frame());
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'usuń element' });
  const prepared = h.messages.findLast(m => m.type === 'prepared');
  assert.equal(prepared.input.context.nodes.length, 201);
  root.children[199].width += 10;
  await h.send({ type: 'apply', plan: { mode: 'remove', targetId: root.id, nodeId: root.id } });
  assert.equal(h.messages.at(-1).type, 'error');
  assert.equal(root.removed, false);
});

test('fill under hugging parent reaches Figma without a renderer veto', async () => {
  const h = harness(); await h.send({ type: 'init' });
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Layout' });
  await h.send({ type: 'apply', plan: { mode: 'create', tree: { type: 'container', direction: 'VERTICAL', width: 'HUG', height: 'HUG', children: [{ type: 'container', direction: 'VERTICAL', width: 'FILL', height: 'HUG', children: [] }] } } });
  assert.equal(h.page.children[0].children[0].layoutSizingHorizontal, 'FILL');
  assert.equal(h.messages.at(-2).type, 'done');
});

test('legacy spacing edits are rejected without changing spacing', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const card = h.frame(); h.page.appendChild(card); h.page.selection = [card];
   await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Gap' });
  await h.send({ type: 'apply', plan: { mode: 'edit', targetId: card.id, operations: [{ id: card.id, field: 'gap', value: 24 }] } });
  assert.equal(card.itemSpacing, 16); assert.equal(h.messages.at(-1).type, 'error');
});

test('insertion appends into native Content without replacing existing children', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { instance, slot } = h.cardWithContent();
  const existing = h.frame(); slot.appendChild(existing); h.page.selection = [instance];
   await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Add content' });
  await h.send({ type: 'apply', plan: { mode: 'insert', targetId: instance.id, parentId: slot.id, children: [{ type: 'container', direction: 'VERTICAL', width: 'HUG', height: 'HUG', children: [] }] } });
  assert.equal(slot.children.length, 2); assert.equal(slot.children[0], existing);
  assert.equal(h.page.children[0], instance); assert.equal(h.messages.at(-2).type, 'done');
});

test('failed insertion rolls back only new children', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { instance, slot } = h.cardWithContent();
  const existing = h.frame(); slot.appendChild(existing); h.page.selection = [instance];
   await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Add content' });
  await h.send({ type: 'apply', plan: { mode: 'insert', targetId: instance.id, parentId: slot.id, children: [
    { type: 'container', direction: 'VERTICAL', width: 'HUG', height: 'HUG', children: [] },
    { type: 'component', componentId: 'missing', width: 'HUG', height: 'HUG' }
  ] } });
  assert.equal(slot.children.length, 1); assert.equal(slot.children[0], existing);
  assert.equal(h.messages.at(-1).type, 'error');
});

test('ordinary Content frame in instance is not an insertion target', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { instance, slot, component } = h.cardWithContent(); slot.type = 'FRAME'; component.children[0].type = 'FRAME';
  h.page.selection = [instance];  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Add content' });
  await h.send({ type: 'apply', plan: { mode: 'insert', targetId: instance.id, parentId: slot.id, children: [{ type: 'container', direction: 'VERTICAL', width: 'HUG', height: 'HUG' }] } });
  assert.equal(slot.children.length, 0); assert.equal(h.messages.at(-1).type, 'error');
});

test('new component renders children into its slot and keeps instance intact', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { component, instance, slot } = h.cardWithContent();
  component.createInstance = () => instance;
  await h.send({ type: 'library', fileKey: 'testlibrary', components: [{ id: 'card', nodeId: component.id, key: 'card', name: 'Card', description: '' }] });
  await h.send({ type: 'prepare', libraryId: 'testlibrary', prompt: 'Card with content' });
  await h.send({ type: 'apply', plan: { mode: 'create', tree: { type: 'component', componentId: 'card', width: 'HUG', height: 'HUG', slots: [{ path: [0], children: [{ type: 'container', direction: 'VERTICAL', width: 'HUG', height: 'HUG', children: [] }] }] } } });
  assert.equal(slot.children.length, 1); assert.equal(instance.type, 'INSTANCE');
  assert.equal(h.messages.at(-2).type, 'done');
});

test('slot restrictions reject additions and roll back', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { instance, slot } = h.cardWithContent();
  Object.defineProperty(slot, 'limitViolations', { get: () => slot.children.length ? ['HAS_NON_PREFERRED'] : [] });
  h.page.selection = [instance];  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Add content' });
  await h.send({ type: 'apply', plan: { mode: 'insert', targetId: instance.id, parentId: slot.id, children: [{ type: 'container', direction: 'VERTICAL', width: 'HUG', height: 'HUG', children: [] }] } });
  assert.equal(slot.children.length, 0); assert.equal(h.messages.at(-1).type, 'error');
});

test('KEEP restores standard button height after slot auto-stretch while width can Fill', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { instance: card, slot } = h.cardWithContent();
  const buttonMain = h.frame('COMPONENT'); buttonMain.componentPropertyDefinitions = {};
  buttonMain.height = 40; buttonMain.width = 120;
  const button = h.frame('INSTANCE'); button.height = 40; button.width = 120;
  buttonMain.createInstance = () => button;
  const append = slot.appendChild;
  slot.appendChild = child => { append(child); child.height = 180; child.layoutSizingVertical = 'FILL'; };
  await h.send({ type: 'library', fileKey: 'buttons', components: [{ id: 'button', nodeId: buttonMain.id, key: 'button', name: 'Button', description: '' }] });
  h.page.selection = [card]; 
  await h.send({ type: 'prepare', libraryId: 'buttons', prompt: 'Add button' });
  await h.send({ type: 'apply', plan: { mode: 'insert', targetId: card.id, parentId: slot.id, children: [{ type: 'component', componentId: 'button', width: 'FILL', height: 'KEEP' }] } });
  assert.equal(button.height, 40);
  assert.equal(button.layoutSizingVertical, 'FIXED');
  assert.equal(button.layoutSizingHorizontal, 'FILL');
  assert.equal(h.messages.at(-2).type, 'done');
});

test('compact tree resolves and renders into a new slot replacing only inherited demo children', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { component, instance, slot } = h.cardWithContent();
  component.createInstance = () => instance;
  const demo = h.frame(); slot.appendChild(demo);
  component.componentPropertyDefinitions = { 'Caption#1': { type: 'TEXT' } };
  instance.setProperties = props => { instance.applied = props; };
  const containerMain = h.frame('COMPONENT'); containerMain.componentPropertyDefinitions = {};
  containerMain.createInstance = () => h.frame('INSTANCE');
  await h.send({ type: 'library', fileKey: 'testlibrary', components: [{ id: 'card', nodeId: component.id, key: 'card', name: 'Card', description: '' }, { id: 'container', nodeId: containerMain.id, key: 'container', name: 'Container' }] });
  const structure = ['Card', { text: 'Resolved title' }, ['Container'], ['Container']];
  await h.send({ type: 'prepare', libraryId: 'testlibrary', structure });
  const input = h.messages.findLast(m => m.type === 'prepared').input;
  assert.deepEqual(input.structure, structure);
  let calls = 0;
  const result = await plan(input, async (state) => {
    calls++;
    assert.equal(state.phase, 'component-resolution');
    return { n0: 'card', n1: 'container' };
  });
  assert.equal(calls, 1);
  await h.send({ type: 'apply', plan: result });
  assert.equal(h.messages.at(-2).type, 'done');
  assert.equal(slot.children.length, 2);
  assert.equal(demo.removed, true);
  assert.equal(instance.applied['Caption#1'], 'Resolved title');
  assert.equal(instance.type, 'INSTANCE');
});

test('library descriptions reach JEV from variants, their set, or REST metadata', async () => {
  for (const [variantDescription, setDescription, restDescription, expected] of [
    ['Variant description', 'Set description', 'REST description', 'Variant description'],
    ['  ', 'Set description', '', 'Set description'],
    ['', '', 'REST description', 'REST description']
  ]) {
    const h = harness(); await h.send({ type: 'init' });
    const main = h.frame('COMPONENT'); main.description = variantDescription;
    const set = h.frame('COMPONENT_SET'); set.description = setDescription; set.componentPropertyDefinitions = {};
    set.appendChild(main);
    await h.send({ type: 'library', fileKey: 'test', components: [{ id: 'button', key: 'button', nodeId: main.id, name: 'Button', description: restDescription }] });
    await h.send({ type: 'prepare', libraryId: 'test', structure: ['Button'] });
    const input = h.messages.findLast(m => m.type === 'prepared').input;
    assert.equal(input.catalog[0].description, expected);
    await plan(input, async (_, questions) => {
      assert.equal(questions.n0.criteria.button, `Button: ${expected}`);
      return { n0: 'button' };
    });
  }
});

test('actual Figma sizing errors still propagate and clean up partial creation', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { component, instance } = h.cardWithContent();
  component.createInstance = () => instance; instance.layoutMode = 'NONE';
  Object.defineProperty(instance, 'layoutSizingHorizontal', { get: () => 'FIXED', set: () => { throw new Error('Figma API rejected sizing'); } });
  await h.send({ type: 'library', fileKey: 'testlibrary', components: [{ id: 'card', nodeId: component.id, key: 'card', name: 'Card' }] });
  await h.send({ type: 'prepare', libraryId: 'testlibrary' });
  await h.send({ type: 'apply', plan: { mode: 'create', exactTree: true, tree: { type: 'component', componentId: 'card', width: 'HUG', height: 'KEEP' } } });
  assert.equal(h.messages.at(-1).type, 'error');
  assert.match(h.messages.at(-1).error, /Figma API rejected sizing/);
  assert.equal(h.page.children.length, 0);
});

test('Hug with a Fill child is passed to Figma for creation and selected edits', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { component, instance, slot } = h.cardWithContent();
  component.createInstance = () => instance; slot.layoutSizingHorizontal = 'FILL';
  await h.send({ type: 'library', fileKey: 'testlibrary', components: [{ id: 'card', nodeId: component.id, key: 'card', name: 'Card' }] });
  await h.send({ type: 'prepare', libraryId: 'testlibrary' });
  await h.send({ type: 'apply', plan: { mode: 'create', exactTree: true, tree: { type: 'component', componentId: 'card', width: 'HUG', height: 'KEEP' } } });
  assert.equal(h.messages.at(-2).type, 'done');
  assert.equal(instance.layoutSizingHorizontal, 'HUG');
  instance.layoutSizingHorizontal = 'FIXED'; h.page.selection = [instance];
   await h.send({ type: 'prepare', libraryId: 'testlibrary' });
  await h.send({ type: 'apply', plan: { mode: 'edit', targetId: instance.id, operations: [{ id: instance.id, field: 'width', value: 'HUG' }] } });
  assert.equal(h.messages.at(-2).type, 'done');
  assert.equal(instance.layoutSizingHorizontal, 'HUG');
});

test('remove affects selected child only and enforces slot minimum', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { instance, slot, component } = h.cardWithContent();
  const child = h.frame(); const sibling = h.frame(); slot.appendChild(child); slot.appendChild(sibling);
  h.page.selection = [instance]; 
  await h.send({ type: 'prepare', libraryId: 'local' });
  await h.send({ type: 'apply', plan: { mode: 'remove', targetId: instance.id, nodeId: child.id } });
  assert.equal(child.removed, true); assert.equal(slot.children[0], sibling);
  component.children[0].componentPropertyReferences = { slotContentId: 'Content#1' };
  component.componentPropertyDefinitions = { 'Content#1': { slotSettings: { minChildren: 1 } } };
  await h.send({ type: 'prepare', libraryId: 'local' });
  await h.send({ type: 'apply', plan: { mode: 'remove', targetId: instance.id, nodeId: sibling.id } });
  assert.equal(h.messages.at(-1).type, 'error');
  assert.equal(sibling.removed, false);
});

test('generic delete resolves and removes the selected root, preserving siblings', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const selected = h.frame(); const sibling = h.frame();
  h.page.appendChild(selected); h.page.appendChild(sibling); h.page.selection = [selected];
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'usuń element' });
  const input = h.messages.findLast(m => m.type === 'prepared').input;
  assert.equal(input.context.nodes[0].removable, true);
  const result = await plan(input, async (state, questions) => {
    if ('action' in questions) return { action: 'remove' };
    assert.equal(state.selected, 'r0');
    assert.equal(questions.target.criteria.r0, `COMPONENT NAME: ${JSON.stringify(selected.name)}`);
    return { target: 'r0' };
  });
  await h.send({ type: 'apply', plan: result });
  assert.equal(h.messages.at(-2).type, 'done');
  assert.equal(selected.removed, true); assert.equal(sibling.removed, false);
  assert.equal(h.page.selection.length, 0);
});

test('selected slot child deletion checks its external parent minimum', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { component, slot } = h.cardWithContent();
  component.children[0].componentPropertyReferences = { slotContentId: 'Content#1' };
  component.componentPropertyDefinitions = { 'Content#1': { slotSettings: { minChildren: 1 } } };
  const child = h.frame(); slot.appendChild(child); h.page.selection = [child];
  await h.send({ type: 'prepare', libraryId: 'local' });
  await h.send({ type: 'apply', plan: { mode: 'remove', targetId: child.id, nodeId: child.id } });
  assert.equal(h.messages.at(-1).type, 'error'); assert.equal(child.removed, false);
  const other = h.frame(); slot.appendChild(other);
  await h.send({ type: 'prepare', libraryId: 'local' });
  await h.send({ type: 'apply', plan: { mode: 'remove', targetId: child.id, nodeId: child.id } });
  assert.equal(h.messages.at(-2).type, 'done'); assert.equal(child.removed, true);
});

test('selected fixed internal instance layer cannot be deleted as a root', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { instance } = h.cardWithContent(); const internal = h.frame(); instance.appendChild(internal);
  h.page.selection = [internal]; await h.send({ type: 'prepare', libraryId: 'local' });
  assert.equal(h.messages.findLast(m => m.type === 'prepared').input.context.nodes[0].removable, false);
  await h.send({ type: 'apply', plan: { mode: 'remove', targetId: internal.id, nodeId: internal.id } });
  assert.equal(h.messages.at(-1).type, 'error'); assert.equal(internal.removed, false);
});

test('directly selected Content exposes live capacity and accepts a button without expanding edit scope', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { component, instance, slot } = h.cardWithContent();
  component.children[0].componentPropertyReferences = { slotContentId: 'Content#1' };
  component.componentPropertyDefinitions = { 'Content#1': { slotSettings: { maxChildren: 2 } } };
  const existing = h.frame(); slot.appendChild(existing);
  const buttonMain = h.frame('COMPONENT'); buttonMain.componentPropertyDefinitions = {};
  const button = h.frame('INSTANCE'); buttonMain.createInstance = () => button;
  button.componentProperties = {}; button.getMainComponentAsync = async () => buttonMain;
  await h.send({ type: 'library', fileKey: 'buttons', components: [{ id: 'button', key: 'button', nodeId: buttonMain.id, name: 'Button' }] });
  h.page.selection = [slot]; await h.send({ type: 'prepare', libraryId: 'buttons', prompt: 'dodaj button' });
  const input = h.messages.findLast(m => m.type === 'prepared').input;
  assert.equal(input.context.targetId, slot.id);
  assert.equal(input.context.nodes[0].contentSlot.capacity, 1);
  assert.ok(!input.context.nodes.some(n => n.id === instance.id));
  const result = await plan(input, async (state, questions) => {
    if ('action' in questions) return { action: 'insert' };
    if ('component' in questions) return { component: 'button' };
    if ('target' in questions) { assert.ok(slot.id in questions.target.criteria); return { target: slot.id }; }
    if (state.phase === 'component-resolution') return { n0: 'button' };
    return Object.fromEntries(Object.entries(questions).map(([key, q]) => [key, 'KEEP' in q.criteria ? 'KEEP' : Object.keys(q.criteria)[0]]));
  });
  await h.send({ type: 'apply', plan: result });
  assert.equal(h.messages.at(-2).type, 'done');
  assert.equal(slot.children[0], existing); assert.equal(slot.children[1], button);
  // A subsequent snapshot sees the actual full slot, not the main's empty one.
  h.page.selection = [slot]; await h.send({ type: 'prepare', libraryId: 'buttons' });
  const full = h.messages.findLast(m => m.type === 'prepared').input;
  assert.equal(full.context.nodes[0].contentSlot.capacity, 0);
});

test('selected product exposes its parent slot and inserts another product beside it', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const list = h.cardWithContent(); list.instance.name = 'Product list';
  const product = h.cardWithContent(); product.instance.name = 'Product';
  list.slot.appendChild(product.instance);
  const added = h.frame('INSTANCE'); added.name = 'Product'; added.componentProperties = {};
  added.getMainComponentAsync = async () => product.component;
  product.component.createInstance = () => added;
  await h.send({ type: 'library', fileKey: 'products', components: [{ id: 'product', key: 'product', nodeId: product.component.id, name: 'Product' }] });
  h.page.selection = [product.instance];
  await h.send({ type: 'prepare', libraryId: 'products', prompt: 'dodaj kolejny produkt' });
  const input = h.messages.findLast(m => m.type === 'prepared').input;
  assert.equal(input.context.parent.id, list.slot.id);
  assert.equal(input.context.parent.ownerName, 'Product list');
  assert.equal(input.context.parent.contentSlot.existingChildren[0].name, 'Product');
  assert.ok(!input.context.nodes.some(n => n.id === list.slot.id || n.id === list.instance.id));
  let calls = 0;
  const result = await plan(input, async (state, questions) => {
    calls++;
    if (questions.action) return { action: 'insert' };
    if (questions.component) return { component: 'product' };
    assert.equal(state.selected, 'Product');
    assert.match(questions.target.criteria[list.slot.id], /PARENT OF SELECTED/);
    assert.match(questions.target.criteria[list.slot.id], /direct children: \["Product"\]/);
    assert.ok(product.slot.id in questions.target.criteria);
    return { target: list.slot.id };
  });
  assert.equal(calls, 3);
  await h.send({ type: 'apply', plan: result });
  assert.equal(h.messages.at(-2).type, 'done');
  assert.equal(list.slot.children.length, 2);
  assert.equal(list.slot.children[0], product.instance);
  assert.equal(list.slot.children[1], added);
  assert.equal(product.slot.children.length, 0);
  assert.equal(h.page.selection[0], product.instance);
});

test('quick insertion also supports a selected native frame without replacing its children', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const parent = h.frame(); h.page.appendChild(parent); h.page.selection = [parent];
  const existing = h.frame(); parent.appendChild(existing);
   await h.send({ type: 'prepare', libraryId: 'local' });
  assert.equal(h.messages.findLast(m => m.type === 'prepared').input.context.nodes[0].insertable, true);
  await h.send({ type: 'apply', plan: { mode: 'insert', targetId: parent.id, parentId: parent.id, exactTree: true, children: [{ type: 'container', direction: 'HORIZONTAL', width: 'KEEP', height: 'KEEP', primaryAlign: 'MAX', children: [] }] } });
  assert.equal(h.messages.at(-2).type, 'done');
  assert.equal(parent.children.length, 2);
  assert.equal(parent.children[0], existing);
  assert.equal(parent.children[1].primaryAxisAlignItems, 'MAX');
});

test('INSTANCE_SWAP translates library key to local/imported component node ID, preserving boolean and text', async () => {
  for (const imported of [false, true]) {
    const h = harness(); await h.send({ type: 'init' });
    const { component, instance } = h.cardWithContent();
    component.createInstance = () => instance;
    component.componentPropertyDefinitions = { 'Icon#1': { type: 'INSTANCE_SWAP' }, 'Visible#2': { type: 'BOOLEAN' }, 'Label#3': { type: 'TEXT' } };
    const icon = h.frame('COMPONENT'); icon.componentPropertyDefinitions = {};
    let imports = 0;
    h.figma.importComponentByKeyAsync = async key => { assert.equal(key, 'icon-library-key'); imports++; return icon; };
    let applied;
    instance.setProperties = props => {
      assert.equal(props['Icon#1'], icon.id);
      assert.equal(typeof props['Visible#2'], 'boolean');
      assert.equal(typeof props['Label#3'], 'string');
      applied = props;
    };
    await h.send({ type: 'library', fileKey: 'testlibrary', components: [
      { id: 'card', nodeId: component.id, key: 'card', name: 'Card' },
      { id: 'icon', nodeId: imported ? undefined : icon.id, key: 'icon-library-key', name: 'Icon' }
    ] });
    await h.send({ type: 'prepare', libraryId: 'testlibrary' });
    // Exercise the render-time import path too, when the cached node disappears.
    if (imported) h.messages.findLast(m => m.type === 'prepared').input.catalog[1].nodeId = 'missing';
    const properties = { 'Icon#1': 'icon-library-key', 'Visible#2': false, 'Label#3': 'Save' };
    await h.send({ type: 'apply', plan: { mode: 'create', exactTree: true, tree: { type: 'component', componentId: 'card', width: 'KEEP', height: 'KEEP', properties } } });
    assert.equal(h.messages.at(-2).type, 'done');
    assert.equal(applied['Icon#1'], icon.id);
    assert.equal(properties['Icon#1'], 'icon-library-key');
    assert.equal(imports, imported ? 2 : 0);
  }
});

test('INSTANCE_SWAP outside catalog fails before setProperties and cleans partial layout', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { component, instance } = h.cardWithContent();
  component.createInstance = () => instance;
  component.componentPropertyDefinitions = { 'Icon#1': { type: 'INSTANCE_SWAP' } };
  let called = false; instance.setProperties = () => { called = true; };
  await h.send({ type: 'library', fileKey: 'testlibrary', components: [{ id: 'card', nodeId: component.id, key: 'card', name: 'Card' }] });
  await h.send({ type: 'prepare', libraryId: 'testlibrary' });
  await h.send({ type: 'apply', plan: { mode: 'create', tree: { type: 'component', componentId: 'card', width: 'KEEP', height: 'KEEP', properties: { 'Icon#1': 'unknown-key' } } } });
  assert.equal(called, false); assert.equal(h.page.children.length, 0);
  assert.match(h.messages.at(-1).error, /spoza katalogu/);
});

test('editing INSTANCE_SWAP resolves key to node ID and rolls back the old ID on later failure', async () => {
  for (const fail of [false, true]) {
    const h = harness(); await h.send({ type: 'init' });
    const { instance, component } = h.cardWithContent();
    component.componentPropertyDefinitions = { 'Icon#1': { type: 'INSTANCE_SWAP' }, 'Show#2': { type: 'BOOLEAN' } };
    instance.componentProperties = { 'Icon#1': { type: 'INSTANCE_SWAP', value: 'old-node-id' }, 'Show#2': { type: 'BOOLEAN', value: false } };
    const bell = h.frame('COMPONENT'); bell.componentPropertyDefinitions = {};
    instance.setProperties = props => {
      if (fail && props['Show#2'] === true) throw new Error('Figma write failed');
      for (const [key, value] of Object.entries(props)) instance.componentProperties[key].value = value;
    };
    await h.send({ type: 'library', fileKey: 'icons', components: [{ id: 'bell', key: 'bell-key', nodeId: bell.id, name: 'Icons / Alarm' }] });
    h.page.selection = [instance]; await h.send({ type: 'pin' });
    await h.send({ type: 'prepare', libraryId: 'icons' });
    await h.send({ type: 'apply', plan: { mode: 'edit', targetId: instance.id, operations: [
      { id: instance.id, field: 'property:Icon#1', value: 'bell-key' }, { id: instance.id, field: 'property:Show#2', value: true }
    ] } });
    assert.equal(instance.componentProperties['Icon#1'].value, fail ? 'old-node-id' : bell.id);
    assert.equal(instance.componentProperties['Show#2'].value, !fail);
    assert.equal(fail ? h.messages.at(-1).type : h.messages.at(-2).type, fail ? 'error' : 'done');
  }
});

test('KEEP inherits source Fill/Hug after instantiation, slot insertion and property resets; explicit sizing wins', async () => {
  for (const width of ['KEEP', 'HUG']) {
    const h = harness(); await h.send({ type: 'init' });
    const { instance: parent, slot } = h.cardWithContent();
    const source = h.frame('COMPONENT'); source.componentPropertyDefinitions = { 'Show#1': { type: 'BOOLEAN' } };
    source.layoutSizingHorizontal = 'FILL'; source.layoutSizingVertical = 'HUG';
    const created = h.frame('INSTANCE');
    source.createInstance = () => created; // new instance is FIXED/FIXED
    created.setProperties = () => { created.layoutSizingHorizontal = created.layoutSizingVertical = 'FIXED'; };
    const append = slot.appendChild;
    slot.appendChild = n => { append(n); n.layoutSizingHorizontal = n.layoutSizingVertical = 'FIXED'; };
    await h.send({ type: 'library', fileKey: 'ds', components: [{ id: 'custom', key: 'custom', nodeId: source.id, name: 'Any DS component' }] });
    h.page.selection = [parent]; 
    await h.send({ type: 'prepare', libraryId: 'ds' });
    const input = h.messages.findLast(m => m.type === 'prepared').input;
    assert.equal(input.catalog[0].defaultSizing.width, 'FILL');
    assert.equal(input.catalog[0].defaultSizing.height, 'HUG');
    await h.send({ type: 'apply', plan: { mode: 'insert', targetId: parent.id, parentId: slot.id, children: [{ type: 'component', componentId: 'custom', width, height: 'KEEP', properties: { 'Show#1': true } }] } });
    assert.equal(h.messages.at(-2).type, 'done');
    assert.equal(created.layoutSizingHorizontal, width === 'KEEP' ? 'FILL' : 'HUG');
    assert.equal(created.layoutSizingVertical, 'HUG');
  }
});
