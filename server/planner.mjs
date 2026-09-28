import { resolveTree, ask, validateCatalog } from './resolver.mjs';
import { choice } from './jev.mjs';

export async function plan(input, decide) {
  if (!input || typeof input !== 'object') throw new Error('Nieprawidłowe wejście.');
  validateCatalog(input.catalog);
  if (!input.context) return resolveTree(input, decide);
  return editSelected(input, decide);
}

async function editSelected(input, decide) {
  const { context, prompt } = input;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000 || !Array.isArray(context.nodes) || !context.nodes.length || context.nodes.length > 80) throw new Error('Wpisz prompt i zaznacz element (maks. 80 warstw).');
  const target = context.nodes.find(n => n.id === context.targetId) || context.nodes[0];
  const state = { prompt, context };
  const { action } = await ask({ prompt, target: { id: target.id, name: target.name, type: target.type } }, { action: choice('Choose the requested quick edit. Resizing or changing an existing component means properties, not insertion. Do not build a recursive layout. Only explicit additions/removals are allowed.', { properties: 'Change existing properties', insert: 'Add one component', remove: 'Remove one existing element' }) }, decide);
  if (action === 'insert') {
    const targets = context.nodes.filter(n => n.contentSlot?.capacity > 0 || n.insertable);
    if (!targets.length) throw new Error('Brak wolnego slotu Content lub edytowalnej ramki w zaznaczonym elemencie.');
    if (!input.catalog.length) throw new Error('Biblioteka nie zawiera komponentów.');
    const answer = await ask({ ...state, catalog: input.catalog.map(c => ({ id: c.id, name: c.name, description: c.description })) }, {
      target: choice('Choose Content slot or editable frame for the new component.', Object.fromEntries(targets.map(n => [n.id, `${n.name}, ${n.type}, parent ${n.parentId}`]))),
      component: choice('Choose the exact component/variant to add, following the prompt.', Object.fromEntries(input.catalog.map(c => [c.id, `${c.name}: ${c.description || ''}`])))
    }, decide);
    const selected = input.catalog.find(c => c.id === answer.component);
    const copy = prompt.match(/["„“]([^"”\n]+)["”]/)?.[1];
    const result = await resolveTree({ catalog: [selected], structure: [selected.name, { intent: prompt, ...(copy ? { text: copy } : {}) }] }, decide);
    return { mode: 'insert', exactTree: true, targetId: context.targetId, parentId: answer.target, children: [result.tree] };
  }
  if (action === 'remove') {
    const removable = context.nodes.filter(n => n.removable && n.id !== context.targetId);
    if (!removable.length) throw new Error('Brak warstw, które można usunąć z zaznaczonego elementu.');
    const { target } = await ask(state, { target: choice('Choose exactly the element explicitly requested for removal. none cancels.', { none: 'No matching element; preserve all', ...Object.fromEntries(removable.map(n => [n.id, `${n.name}, ${n.type}, parent ${n.parentId}`])) }) }, decide);
    return { mode: 'remove', targetId: context.targetId, nodeId: target === 'none' ? null : target };
  }
  const questions = {}; const bindings = [];
  function add(node, field, criteria, decode = value => value) {
    const key = `q${bindings.length}`;
    questions[key] = choice(`For ${node.name} (${node.id}), resolve ${field} from prompt. Keep unless explicitly requested.`, { keep: 'Leave unchanged', ...criteria });
    bindings.push({ key, id: node.id, field, decode });
  }
  const copy = prompt.match(/["„“]([^"”\n]+)["”]/)?.[1];
  const editableNodes = target.type === 'INSTANCE' ? [target] : context.nodes.filter(node => {
    let parent = context.nodes.find(n => n.id === node.parentId);
    const visited = new Set();
    while (parent && !visited.has(parent.id)) {
      if (parent.type === 'INSTANCE') return false;
      visited.add(parent.id);
      parent = context.nodes.find(n => n.id === parent.parentId);
    }
    return true;
  });
  for (const node of editableNodes) {
    // SVG paths are implementation details, not independent layout controls.
    if (node.type === 'VECTOR') continue;
    if (node.type !== 'INSTANCE') {
      if (node.layout) add(node, 'direction', { VERTICAL: 'Vertical', HORIZONTAL: 'Horizontal' });
      for (const axis of ['width', 'height']) if (node.sizing?.[axis]?.allowed?.length) add(node, axis, Object.fromEntries(node.sizing[axis].allowed.map(v => [v, v])));
    }
    if (node.type === 'TEXT') {
      if (copy !== undefined) add(node, 'text', { literal: copy }, () => copy);
      const sizes = [...new Set([12, 14, 16, 20, 24, 32, 40, 48, ...(typeof node.fontSize === 'number' ? [Math.min(300, node.fontSize + 4), Math.max(1, node.fontSize - 4)] : [])])];
      add(node, 'fontSize', Object.fromEntries(sizes.map(v => [String(v), `${v}px`])), Number);
    }
    for (const [name, def] of Object.entries(node.properties || {})) {
      if (def.type === 'VARIANT' && def.options?.length) add(node, `property:${name}`, Object.fromEntries(def.options.map((v, i) => [`v${i}`, v])), v => def.options[Number(v.slice(1))]);
      if (def.type === 'BOOLEAN') add(node, `property:${name}`, { true: 'true', false: 'false' }, v => v === 'true');
      if (def.type === 'TEXT' && copy !== undefined) add(node, `property:${name}`, { literal: copy }, () => copy);
    }
  }
  if (bindings.length > 240) throw new Error('Za dużo właściwości: wybierz mniejszy element.');
  const editContext = { targetId: context.targetId, nodes: editableNodes.map(node => node.type === 'INSTANCE' ? { id: node.id, name: node.name, type: node.type, properties: node.properties } : node) };
  const answers = await ask({ prompt, context: editContext, sizingRule: 'For instances use exposed component properties only. Interpret requests such as enlarge the button through the available Size variant values (for example Small to Default). Do not resize internal layers. Keep unrelated properties unchanged.' }, questions, decide);
  return { mode: 'edit', targetId: context.targetId, operations: bindings.filter(b => answers[b.key] !== 'keep').map(b => ({ id: b.id, field: b.field, value: b.decode(answers[b.key]) })) };
}
