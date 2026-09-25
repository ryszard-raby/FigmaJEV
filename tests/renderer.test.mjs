import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

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
  vm.runInNewContext(code, { figma, __html__: '' });
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
  assert.equal(host.layoutSizingVertical, 'FIXED');
  assert.equal(host.children.length, 0);
  assert.equal(host.layoutMode, 'HORIZONTAL');
  assert.equal(host.itemSpacing, 0);
  assert.equal(host.paddingTop, 0);
  assert.equal(h.page.selection[0], host);
  assert.equal(h.messages.at(-2).type, 'done');
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
test('pinned edits keep identity even after changing selection', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const card = h.frame(); h.page.appendChild(card); h.page.selection = [card];
  await h.send({ type: 'pin' }); h.page.selection = [];
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Hug width' });
  await h.send({ type: 'apply', plan: { mode: 'edit', targetId: card.id, operations: [{ id: card.id, field: 'width', value: 'HUG' }] } });
  assert.equal(card.layoutSizingHorizontal, 'HUG'); assert.equal(h.page.children[0], card);
  assert.equal(card.itemSpacing, 16);
});
test('concurrent user change invalidates plan without touching canvas', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const card = h.frame(); h.page.appendChild(card); h.page.selection = [card];
  await h.send({ type: 'pin' });
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Hug width' });
  card.layoutSizingVertical = 'HUG';
  await h.send({ type: 'apply', plan: { mode: 'edit', targetId: card.id, operations: [{ id: card.id, field: 'width', value: 'HUG' }] } });
  assert.equal(card.layoutSizingHorizontal, 'FIXED'); assert.equal(h.messages.at(-1).type, 'error');
});

test('fill under hugging parent is rejected and creation cleaned up', async () => {
  const h = harness(); await h.send({ type: 'init' });
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Layout' });
  await h.send({ type: 'apply', plan: { mode: 'create', tree: { type: 'container', direction: 'VERTICAL', width: 'HUG', height: 'HUG', children: [{ type: 'container', direction: 'VERTICAL', width: 'FILL', height: 'HUG', children: [] }] } } });
  assert.equal(h.page.children.length, 0);
  assert.equal(h.messages.at(-1).type, 'error');
});

test('legacy spacing edits are rejected without changing spacing', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const card = h.frame(); h.page.appendChild(card); h.page.selection = [card];
  await h.send({ type: 'pin' }); await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Gap' });
  await h.send({ type: 'apply', plan: { mode: 'edit', targetId: card.id, operations: [{ id: card.id, field: 'gap', value: 24 }] } });
  assert.equal(card.itemSpacing, 16); assert.equal(h.messages.at(-1).type, 'error');
});

test('insertion appends into native Content without replacing existing children', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { instance, slot } = h.cardWithContent();
  const existing = h.frame(); slot.appendChild(existing); h.page.selection = [instance];
  await h.send({ type: 'pin' }); await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Add content' });
  await h.send({ type: 'apply', plan: { mode: 'insert', targetId: instance.id, parentId: slot.id, children: [{ type: 'container', direction: 'VERTICAL', width: 'HUG', height: 'HUG', children: [] }] } });
  assert.equal(slot.children.length, 2); assert.equal(slot.children[0], existing);
  assert.equal(h.page.children[0], instance); assert.equal(h.messages.at(-2).type, 'done');
});

test('failed insertion rolls back only new children', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { instance, slot } = h.cardWithContent();
  const existing = h.frame(); slot.appendChild(existing); h.page.selection = [instance];
  await h.send({ type: 'pin' }); await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Add content' });
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
  h.page.selection = [instance]; await h.send({ type: 'pin' }); await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Add content' });
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
  h.page.selection = [instance]; await h.send({ type: 'pin' }); await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Add content' });
  await h.send({ type: 'apply', plan: { mode: 'insert', targetId: instance.id, parentId: slot.id, children: [{ type: 'container', direction: 'VERTICAL', width: 'HUG', height: 'HUG', children: [] }] } });
  assert.equal(slot.children.length, 0); assert.equal(h.messages.at(-1).type, 'error');
});

test('KEEP restores standard button height after slot auto-stretch while width can Fill', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const { instance: card, slot } = h.cardWithContent();
  const buttonMain = h.frame('COMPONENT'); buttonMain.componentPropertyDefinitions = {};
  const button = h.frame('INSTANCE'); button.height = 40; button.width = 120;
  buttonMain.createInstance = () => button;
  const append = slot.appendChild;
  slot.appendChild = child => { append(child); child.height = 180; child.layoutSizingVertical = 'FILL'; };
  await h.send({ type: 'library', fileKey: 'buttons', components: [{ id: 'button', nodeId: buttonMain.id, key: 'button', name: 'Button', description: '' }] });
  h.page.selection = [card]; await h.send({ type: 'pin' });
  await h.send({ type: 'prepare', libraryId: 'buttons', prompt: 'Add button' });
  await h.send({ type: 'apply', plan: { mode: 'insert', targetId: card.id, parentId: slot.id, children: [{ type: 'component', componentId: 'button', width: 'FILL', height: 'KEEP' }] } });
  assert.equal(button.height, 40);
  assert.equal(button.layoutSizingVertical, 'FIXED');
  assert.equal(button.layoutSizingHorizontal, 'FILL');
  assert.equal(h.messages.at(-2).type, 'done');
});
