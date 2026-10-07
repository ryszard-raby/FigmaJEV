import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDocumentation, documentationPrompt, saveDocumentation } from '../server/documentation.mjs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('incomplete REST catalog cannot overwrite existing documentation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'figmajev-docs-'));
  const path = join(directory, 'design-system.md');
  try {
    await writeFile(path, 'Existing full documentation');
    await assert.rejects(saveDocumentation([{ id: 'card', name: 'Card' }], 'Library', path), /pełnych danych/);
    assert.equal(await readFile(path, 'utf8'), 'Existing full documentation');
    await saveDocumentation([{ id: 'card', name: 'Card', properties: { Label: { type: 'TEXT' } }, slots: [], defaultSizing: { width: 'FILL', height: 'HUG' } }], 'Library', path);
    const saved = await readFile(path, 'utf8');
    assert.match(saved, /"width": "fill"/);
    assert.match(saved, /"Label"/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('documentation lists every variant alphabetically and excludes internal identifiers', () => {
  const text = renderDocumentation([
    { id: 'secret-id', key: 'secret-key', nodeId: 'secret-node', name: 'Text / Bold', description: 'Headline ``` <script>', properties: { 'Label#1': { type: 'TEXT' } }, textTargets: [{ name: 'Label', path: [0] }] },
    { id: 'b', name: 'Card', slots: [{ name: 'Content', path: [0], settings: { maxChildren: 10 } }] }
  ], 'My DS');
  assert.ok(text.includes('width i height'));
  assert.ok(!/secret-id|secret-key|secret-node|<script>/.test(text));
  const blocks = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)];
  assert.equal(blocks.length, 2);
  assert.ok(Array.isArray(JSON.parse(blocks[0][1])));
  const components = JSON.parse(blocks[1][1]);
  assert.deepEqual(components.map(c => c.name), ['Card', 'Text']);
  assert.deepEqual(components[1].variants, [{ name: 'Bold' }]);
  assert.equal(components[1].description, 'Headline ``` <script>');
  assert.equal(components[0].slots[0].maxChildren, 10);
});

test('groups variants, shares metadata and preserves variant-specific slots and descriptions', () => {
  const properties = { Label: { type: 'TEXT' } };
  const text = renderDocumentation([
    { id: '2', name: 'Forms / Button / Small', description: 'Small button', properties, slots: [] },
    { id: '1', name: 'Forms / Button / Large', description: 'Large button', properties, slots: [{ name: 'Content', settings: { maxChildren: 2 } }] }
  ]);
  const blocks = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)];
  const components = JSON.parse(blocks[1][1]);
  assert.equal(components.length, 1);
  assert.equal(components[0].name, 'Forms / Button');
  assert.deepEqual(components[0].properties, properties);
  assert.deepEqual(components[0].variants, [
    { name: 'Large', description: 'Large button', slots: [{ name: 'Content', maxChildren: 2 }] },
    { name: 'Small', description: 'Small button', slots: [] }
  ]);
});

test('GPT prompt contains the configurable documentation URL and no library payload', () => {
  const url = 'https://example.org/docs/design-system.md';
  assert.ok(documentationPrompt(url).includes(url));
  assert.match(documentationPrompt(url), /Jeśli link jest niedostępny/);
  assert.throws(() => documentationPrompt('javascript:alert(1)'));
});

test('documents source sizing, shares matching axes and does not invent missing defaults', () => {
  const text = renderDocumentation([
    { id: '1', name: 'Button / Large', defaultSizing: { width: 'FILL', height: 'FIXED' } },
    { id: '2', name: 'Button / Small', defaultSizing: { width: 'HUG', height: 'FIXED' } },
    { id: '3', name: 'Card', defaultSizing: { width: 'FILL', height: 'HUG' } },
    { id: '4', name: 'Unknown' }
  ]);
  const components = JSON.parse([...text.matchAll(/```json\n([\s\S]*?)\n```/g)].at(-1)[1]);
  assert.equal(components[0].height, 'fixed');
  assert.equal(components[0].width, undefined);
  assert.deepEqual(components[0].variants, [{ name: 'Large', width: 'fill' }, { name: 'Small', width: 'hug' }]);
  assert.equal(components[1].width, 'fill');
  assert.equal(components[1].height, 'hug');
  assert.equal(components[2].width, undefined);
  assert.equal(components[2].height, undefined);
});
