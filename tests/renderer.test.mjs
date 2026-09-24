import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const { code } = await transform(await readFile(new URL('../plugin/code.ts', import.meta.url), 'utf8'), { loader: 'ts', target: 'es2017' });
function harness() {
  let sequence = 0;
  const nodes = new Map(); const messages = []; const events = {};
  function frame(type = 'FRAME') {
    const n = { id: `id${sequence++}`, type, name: 'Card', visible: true, width: 300, height: 200, x: 0, y: 0,
      layoutMode: 'VERTICAL', itemSpacing: 16, children: [], removed: false,
      appendChild(child) { if (child.parent) child.parent.children = child.parent.children.filter(c => c !== child); child.parent = n; n.children.push(child); },
      remove() { n.removed = true; if (n.parent) n.parent.children = n.parent.children.filter(c => c !== n); for (const c of [...n.children]) c.remove(); nodes.delete(n.id); },
      findAllWithCriteria() { return []; }
    };
    nodes.set(n.id, n); return n;
  }
  const page = frame('PAGE'); page.selection = [];
  const figma = { currentPage: page, root: { children: [page] }, ui: { postMessage: m => messages.push(m) },
    showUI() {}, on: (event, fn) => { events[event] = fn; }, loadAllPagesAsync: async () => {},
    getNodeByIdAsync: async id => nodes.get(id) || null,
    createFrame() { const n = frame(); page.appendChild(n); return n; },
    viewport: { center: { x: 500, y: 500 }, scrollAndZoomIntoView() {} }, commitUndo() {},
    importComponentByKeyAsync: async () => { throw new Error('Import failed'); }
  };
  vm.runInNewContext(code, { figma, __html__: '' });
  return { figma, frame, page, messages, send: m => figma.ui.onmessage(m) };
}

test('renderer creates layout and removes staging frame', async () => {
  const h = harness(); await h.send({ type: 'init' });
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Layout' });
  await h.send({ type: 'apply', plan: { mode: 'create', tree: { type: 'container', direction: 'VERTICAL', gap: 16, children: [] } } });
  assert.equal(h.page.children.length, 1);
  assert.equal(h.page.children[0].name, 'Container');
  assert.equal(h.messages.at(-2).type, 'done');
});
test('renderer rejects unknown component and cleans partial layout', async () => {
  const h = harness(); await h.send({ type: 'init' });
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Layout' });
  await h.send({ type: 'apply', plan: { mode: 'create', tree: { type: 'container', direction: 'VERTICAL', gap: 16, children: [{ type: 'component', componentId: 'invented' }] } } });
  assert.equal(h.page.children.length, 0);
  assert.equal(h.messages.at(-1).type, 'error');
});
test('pinned edits keep identity even after changing selection', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const card = h.frame(); h.page.appendChild(card); h.page.selection = [card];
  await h.send({ type: 'pin' }); h.page.selection = [];
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Gap 24' });
  await h.send({ type: 'apply', plan: { mode: 'edit', targetId: card.id, operations: [{ id: card.id, field: 'gap', value: 24 }] } });
  assert.equal(card.itemSpacing, 24); assert.equal(h.page.children[0], card);
});
test('concurrent user change invalidates plan without touching canvas', async () => {
  const h = harness(); await h.send({ type: 'init' });
  const card = h.frame(); h.page.appendChild(card); h.page.selection = [card];
  await h.send({ type: 'pin' });
  await h.send({ type: 'prepare', libraryId: 'local', prompt: 'Gap 24' });
  card.itemSpacing = 32;
  await h.send({ type: 'apply', plan: { mode: 'edit', targetId: card.id, operations: [{ id: card.id, field: 'gap', value: 24 }] } });
  assert.equal(card.itemSpacing, 32); assert.equal(h.messages.at(-1).type, 'error');
});
