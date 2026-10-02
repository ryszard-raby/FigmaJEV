import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDocumentation, documentationPrompt } from '../server/documentation.mjs';

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
  assert.deepEqual(components.map(c => c.name), ['Card', 'Text / Bold']);
  assert.equal(components[1].description, 'Headline ``` <script>');
  assert.equal(components[0].slots[0].maxChildren, 10);
});

test('GPT prompt contains the configurable documentation URL and no library payload', () => {
  const url = 'https://example.org/docs/design-system.md';
  assert.ok(documentationPrompt(url).includes(url));
  assert.match(documentationPrompt(url), /Jeśli link jest niedostępny/);
  assert.throws(() => documentationPrompt('javascript:alert(1)'));
});
