import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../plugin/ui.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
test('library import accepts forwarded Figma messages and ends loading', async () => {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', disabled: false, classList: { toggle() {} }, replaceChildren(...children) { this.children = children; } });
    return elements.get(id);
  }
  const sent = []; const window = {}; const timers = new Map(); let timerId = 0;
  const parent = { postMessage: message => sent.push(message.pluginMessage) };
  const context = {
    window, parent, document: { getElementById: element, querySelector: element, createElement: () => ({}) },
    AbortController, setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
    fetch: async (url, request) => {
      assert.equal(url, 'http://localhost:3847/library');
      assert.equal(JSON.parse(request.body).fileKey, 'iCotPXnNLa5DV1OsJEgsio');
      return { ok: true, json: async () => ({ components: [{ id: 'card', name: 'Card' }] }) };
    }
  };
  vm.runInNewContext(script, context);
  await window.onmessage({ data: { pluginMessage: { type: 'settings', token: 'restored-token', libraryUrl: 'saved-library' } } });
  assert.equal(element('token').value, 'restored-token');
  assert.equal(element('fileKey').value, 'saved-library');
  element('token').value = 'test-local-token';
  element('token').oninput();
  assert.equal(sent.at(-1).token, 'test-local-token');
  await window.onmessage({ data: { pluginMessage: { type: 'settings', token: 'stale-token', libraryUrl: 'saved-library' } } });
  assert.equal(element('token').value, 'test-local-token');
  element('fileKey').value = 'https://www.figma.com/design/iCotPXnNLa5DV1OsJEgsio/CeneoDesign?node-id=13-6&p=f';
  await element('import').onclick();
  assert.equal(sent.at(-1).type, 'library');
  assert.match(element('status').textContent, /Pobrano 1/);
  await window.onmessage({ source: null, data: { pluginMessage: { type: 'libraries', selected: 'library1', libraries: [{ id: 'library1', name: 'Library', components: [{ id: 'card' }] }] } } });
  assert.equal(element('library').value, 'library1');
  assert.equal(element('import').disabled, false);
  assert.equal(timers.size, 0);
  element('structure').value = '["Container",["Button"]]';
  element('prompt').value = '';
  element('form').onsubmit({ preventDefault() {} });
  assert.equal(sent.at(-1).type, 'prepare');
  assert.equal(sent.at(-1).structure, element('structure').value);
  await window.onmessage({ data: { pluginMessage: { type: 'done' } } });
  element('structure').value = 'invalid';
  element('form').onsubmit({ preventDefault() {} });
  assert.match(element('status').textContent, /JSON/);
  await window.onmessage({ data: { pluginMessage: { type: 'selection', count: 1, node: { id: 'card', name: 'Card' } } } });
  element('prompt').value = 'dodaj przycisk';
  element('form').onsubmit({ preventDefault() {} });
  assert.equal(sent.at(-1).type, 'prepare');
  assert.equal(sent.at(-1).prompt, 'dodaj przycisk');
  assert.equal(element('editFields').hidden, false);
  assert.equal(element('createFields').hidden, true);
  await window.onmessage({ data: { pluginMessage: { type: 'done' } } });
  await window.onmessage({ data: { pluginMessage: { type: 'selection', count: 2, node: null } } });
  assert.equal(element('generate').disabled, true);
  const previousCount = sent.length;
  element('form').onsubmit({ preventDefault() {} });
  assert.equal(sent.length, previousCount);
  await window.onmessage({ data: { pluginMessage: { type: 'selection', count: 0, node: null } } });
  assert.equal(element('editFields').hidden, true);
  assert.equal(element('createFields').hidden, false);
  assert.equal(element('generate').disabled, false);
  element('forget').onclick();
  assert.equal(element('token').value, ''); assert.equal(element('fileKey').value, '');
  assert.equal(sent.at(-1).type, 'save-settings'); assert.equal(sent.at(-1).token, '');
});
