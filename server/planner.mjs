import { choice } from './jev.mjs';

const directions = { VERTICAL: 'Vertical stack', HORIZONTAL: 'Horizontal row' };
const gaps = { 0: 'No gap', 8: 'Compact, 8px', 16: 'Standard, 16px', 24: 'Spacious, 24px', 32: 'Wide, 32px' };
export function textCandidates(prompt, context = []) {
  // Jev cannot invent text. Quoted copy is supplied verbatim by the user.
  return [...new Set([...Array.from(prompt.matchAll(/["„“]([^"”\n]{1,200})["”]/g), m => m[1]),
    ...context.filter(n => n.type === 'TEXT').map(n => n.text), 'Nagłówek', 'Opis', 'Kontynuuj', 'Anuluj'])].filter(Boolean).slice(0, 40);
}
const options = values => Object.fromEntries(values.map((value, index) => [`v${index}`, String(value)]));

export function validateInput(input) {
  if (!input || typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 4000) throw new Error('Prompt musi mieć 1–4000 znaków.');
  if (!Array.isArray(input.catalog) || input.catalog.length > 180) throw new Error('Katalog może mieć najwyżej 180 komponentów.');
  const ids = new Set();
  for (const c of input.catalog) {
    if (!c || typeof c.id !== 'string' || typeof c.name !== 'string' || ids.has(c.id)) throw new Error('Nieprawidłowy katalog.');
    ids.add(c.id);
  }
  if (input.context && (!Array.isArray(input.context.nodes) || input.context.nodes.length > 80 || !input.context.nodes.length)) throw new Error('Zbyt duży lub nieprawidłowy kontekst.');
}

export async function plan(input, decide) {
  validateInput(input);
  return input.context ? edit(input, decide) : create(input, decide);
}

async function create(input, decide) {
  const texts = textCandidates(input.prompt);
  const tree = { type: 'container', name: 'Layout', direction: 'VERTICAL', gap: 16, padding: 24, children: [] };
  const queue = [{ node: tree, path: 'Layout', depth: 0 }];
  const trace = [];
  let count = 1;
  while (queue.length) {
    const { node, path, depth } = queue.shift();
    const slots = Math.min(4, 32 - count);
    if (!slots) break;
    const state = { prompt: input.prompt, catalog: input.catalog, tree, currentPath: path };
    const answers = await decide(state, {
      direction: choice(`Choose layout direction for container at ${path}.`, directions),
      gap: choice(`Choose spacing for container at ${path}.`, gaps),
      count: choice(`How many immediate children belong in ${path}? Existing library components already include their internal content.`, Object.fromEntries(Array.from({ length: slots + 1 }, (_, i) => [String(i), `${i} children`]))),
    });
    node.direction = answers.direction; node.gap = Number(answers.gap);
    const questions = {};
    const kinds = { text: 'Native text', ...Object.fromEntries(input.catalog.map(c => [c.id, `Library component: ${c.name}. ${c.description || ''}`])) };
    if (depth < 3) kinds.container = 'Nested layout container';
    for (let i = 0; i < Number(answers.count); i++) {
      questions[`child${i}`] = choice(`Choose element for child ${i + 1} of ${path}. Consider siblings and requested hierarchy.`, kinds);
      questions[`text${i}`] = choice(`If child ${i + 1} of ${path} is text, choose its exact copy.`, options(texts));
    }
    if (!Object.keys(questions).length) continue;
    const children = await decide(state, questions);
    for (let i = 0; i < Number(answers.count); i++) {
      const kind = children[`child${i}`];
      const child = kind === 'container'
        ? { type: 'container', name: 'Container', direction: 'VERTICAL', gap: 16, padding: 0, children: [] }
        : kind === 'text' ? { type: 'text', text: texts[Number(children[`text${i}`].slice(1))] }
          : { type: 'component', componentId: kind };
      node.children.push(child); count++;
      if (child.type === 'container') queue.push({ node: child, path: `${path}/${i + 1}`, depth: depth + 1 });
    }
    trace.push({ path, ...answers });
  }
  return { mode: 'create', tree, trace };
}

async function edit(input, decide) {
  const nodes = input.context.nodes;
  const texts = textCandidates(input.prompt, nodes);
  const questions = {};
  const bindings = [];
  function add(node, field, criteria) {
    const key = `q${bindings.length}`;
    questions[key] = choice(`For node ${node.id} (${node.name}), choose ${field}. Keep existing value unless the prompt asks to change it.`, { keep: 'Preserve current value', ...criteria });
    bindings.push({ key, id: node.id, field });
  }
  for (const node of nodes) {
    if (node.layout) { add(node, 'direction', directions); add(node, 'gap', gaps); }
    if (node.type === 'TEXT') add(node, 'text', options(texts));
    for (const [name, def] of Object.entries(node.properties || {})) {
      if (def.type === 'VARIANT' && def.options?.length) add(node, `property:${name}`, options(def.options));
      if (def.type === 'BOOLEAN') add(node, `property:${name}`, { true: 'Visible/enabled', false: 'Hidden/disabled' });
      if (def.type === 'TEXT') add(node, `property:${name}`, options(texts));
    }
  }
  if (bindings.length > 240) throw new Error('Wybierz mniejszy element (maks. 240 decyzji).');
  if (!bindings.length) throw new Error('Ten element nie ma obsługiwanych właściwości do edycji.');
  const answers = await decide({ prompt: input.prompt, context: input.context, catalog: input.catalog }, questions);
  const operations = [];
  for (const b of bindings) {
    const selected = answers[b.key];
    if (selected === 'keep') continue;
    let value = selected;
    if (b.field === 'gap') value = Number(selected);
    if (b.field === 'text') value = texts[Number(selected.slice(1))];
    if (b.field.startsWith('property:')) {
      const def = nodes.find(n => n.id === b.id).properties[b.field.slice(9)];
      value = def.type === 'BOOLEAN' ? selected === 'true' : (def.type === 'TEXT' ? texts : def.options)[Number(selected.slice(1))];
    }
    operations.push({ id: b.id, field: b.field, value });
  }
  return { mode: 'edit', targetId: input.context.targetId, operations };
}
