import { choice } from './jev.mjs';
import { extractRequirements, requirementState, logPlannerStep } from './requirements.mjs';

const directions = { VERTICAL: 'Vertical stack', HORIZONTAL: 'Horizontal row' };
const sizing = { KEEP: 'Leave unchanged: preserve the library/default size and resizing mode. Prefer unless the user explicitly requests resizing this axis.', HUG: 'Hug contents: size to content', FILL: 'Fill available space in parent' };
const libraryRules = 'Native containers are technical wrappers, not library components. They do not fulfill requests for named library components such as Layout or Card. When the prompt explicitly requests a library component, choose its catalog ID and put its requested descendants in its Content slot. Do not substitute a native container for that component. A generic request for a view/screen (widok/ekran) does NOT request an extra Layout or Card: place the requested controls directly in the current container. Respect explicit quantities: one button and one input means two children, not two copies of the same control. When one outer library component is explicitly requested, add that component as one child of the technical root; plan its content separately in its slot.';
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

async function create(input, decide, insertionSlot = null) {
  const requiredRequirements = await extractRequirements(input, decide);
  const texts = textCandidates(input.prompt);
  const tree = { type: 'container', name: 'FigmaJev', direction: 'VERTICAL', width: 'KEEP', height: 'KEEP', children: [] };
  if (insertionSlot) { tree.width = insertionSlot.width === 'HUG' ? 'HUG' : 'FILL'; tree.height = insertionSlot.height === 'HUG' ? 'HUG' : 'FILL'; }
  const trace = [];
  const warnings = [];
  let count = 1;
  async function expand({ node, path, depth, slot, owner }) {
    const coverage = () => requirementState(requiredRequirements, tree, node, input.catalog);
    const debug = (additionalChildren, extra = {}) => {
      const record = { currentPath: path, ...coverage(), additionalChildren, ...extra };
      trace.push({ phase: 'requirements', ...record }); logPlannerStep(record);
    };
    if (!coverage().remainingRequirements.length) { debug(0, { reason: 'requirements-fulfilled' }); return; }
    const slots = Math.min(4, 32 - count, slot?.capacity ?? 4);
    if (!slots) { debug(0, { reason: 'capacity-or-node-limit' }); return; }
    const scopeRules = slot
      ? `You are INSIDE the Content slot of ${owner?.name || 'the selected component'}. This component has ALREADY been instantiated. Choose its requested direct CONTENT, not another copy of the outer component. The component's existence does not mean its slot has been populated. Existing slot children: ${JSON.stringify(slot.existingChildren || [])}. Use zero only when no additional content belongs in THIS slot. Preserve existing children.`
      : libraryRules;
    const state = () => ({ prompt: input.prompt, catalog: input.catalog, tree, context: input.context, currentPath: path, currentComponent: owner, contentSlot: slot, scopeRules, libraryRules, ...coverage() });
    const answers = await decide(state(), {
      ...(!slot ? { direction: choice(`Choose layout direction for container at ${path}.`, directions) } : {}),
      ...(depth === 0 && !slot ? {
        width: choice('Choose width of the single technical FigmaJev root on the page. KEEP preserves Hug. There is no outer frame, so Fill is unavailable.', { KEEP: sizing.KEEP, HUG: sizing.HUG }),
        height: choice('Choose height of the single technical FigmaJev root on the page. KEEP preserves fixed 480px; HUG sizes to contents. There is no outer frame, so Fill is unavailable. Prefer KEEP unless resizing is requested.', { KEEP: sizing.KEEP, HUG: sizing.HUG }),
      } : {}),
      count: choice(`How many additional immediate children are needed for remainingRequirements ONLY? fulfilledRequirements includes descendants and other branches: never recreate them. Structural wrappers do not fulfill requirements. ${scopeRules}`, Object.fromEntries(Array.from({ length: slots + 1 }, (_, i) => [String(i), `${i} children`]))),
    });
    if (!slot) node.direction = answers.direction;
    if (depth === 0 && !slot) { node.width = answers.width; node.height = answers.height; }
    trace.push({ path, component: owner?.name, slot: slot?.name, ...answers });
    debug(Number(answers.count));
    if (slot && Number(answers.count) === 0) warnings.push(`${owner?.name || 'Komponent'} / Content: JEV wybrał 0 nowych dzieci.`);
    const kinds = { text: 'Native text', ...Object.fromEntries(input.catalog.map(c => [c.id, `Library component: ${c.name}. ${c.description || ''}. Content slots: ${JSON.stringify(c.slots || [])}`])) };
    if (depth < 3) kinds.container = 'Plain native frame for grouping; NOT the library Layout component. Use only for an explicitly requested plain frame or grouping without a requested library component.';
    for (let i = 0; i < Number(answers.count); i++) {
      if (!coverage().remainingRequirements.length) { debug(0, { reason: 'requirements-fulfilled' }); break; }
      if (count >= 32) { debug(0, { reason: 'node-limit' }); break; }
      const questions = {};
      questions[`child${i}`] = choice(`Choose ONLY the next element at ${path} for remainingRequirements. Read plannedChildren including descendants and fulfilledRequirements across the entire tree. Never recreate a fulfilled occurrence. Same-type components are allowed for distinct remaining IDs. Containers only group requirements. ${scopeRules}`, kinds);
      questions[`text${i}`] = choice(`If child ${i + 1} of ${path} is text, choose its exact copy.`, options(texts));
      for (const axis of ['width', 'height']) {
        const canFill = node[axis] === 'FILL' || (depth === 0 && !slot && axis === 'height' && node.height === 'KEEP');
        questions[`${axis}${i}`] = choice(`Choose ${axis} behavior for child ${i + 1} of ${path}. Prefer KEEP: preserve the component's standard size unless the user explicitly asks to resize this child on this axis. A request to resize the parent does not imply resizing its children.`, canFill ? sizing : { KEEP: sizing.KEEP, HUG: sizing.HUG });
      }
      // Choice questions in one request are independent: later siblings must
      // receive earlier selections through a subsequent request's state.
      const selectedSiblings = node.children.map(child => ({
        type: child.type, componentId: child.componentId,
        name: child.type === 'component' ? input.catalog.find(c => c.id === child.componentId)?.name : child.name,
        text: child.text
      }));
      const children = await decide({ ...state(), selectedSiblings, childIndex: i, expectedChildren: Number(answers.count) }, questions);
      const kind = children[`child${i}`];
      trace.push({ path, childIndex: i, selected: kind, component: input.catalog.find(c => c.id === kind)?.name });
      const child = kind === 'container'
        ? { type: 'container', name: 'Container', direction: 'VERTICAL', children: [] }
        : kind === 'text' ? { type: 'text', text: texts[Number(children[`text${i}`].slice(1))] }
          : { type: 'component', componentId: kind };
      child.width = children[`width${i}`] || 'KEEP';
      child.height = children[`height${i}`] || 'KEEP';
      const component = input.catalog.find(c => c.id === kind);
      // Native containers never claim content. Library components are classified
      // by purpose: having a slot alone does not make a semantic control a wrapper.
      if (child.type !== 'container') {
        const remaining = coverage().remainingRequirements;
        const { requirement } = await decide({ ...state(), phase: 'requirement-claim', candidate: { ...child, componentName: component?.name, description: component?.description, contentSlots: component?.slots } }, {
          requirement: choice('Which ONE remaining semantic occurrence does this concrete element implement? Match purpose, not just type. Choose none if it duplicates fulfilled content or serves no requested purpose. If it only contains/groups requested descendants, choose structural: wrappers never consume a requirement. A semantic control can have slots; classify its purpose, not the presence of slots.', {
            none: 'No unmet requirement is implemented; do not add this element',
            ...(child.type === 'component' ? { structural: 'Pure layout wrapper; not a semantic control/content element' } : {}),
            ...Object.fromEntries(remaining.map(r => [r.id, `${r.purpose} (occurrence ${r.occurrence})`]))
          })
        });
        if (requirement === 'none') { debug(0, { reason: 'unmatched-candidate', candidate: kind }); break; }
        if (requirement !== 'structural') {
          if (!remaining.some(r => r.id === requirement)) throw new Error('JEV claimed an unknown or already fulfilled requirement.');
          child.requirementId = requirement;
        } else if (child.type !== 'component') throw new Error('Text cannot be a structural wrapper.');
      }
      node.children.push(child); count++;
      debug(0, { reason: 'child-added', childIndex: i });
      if (child.type === 'container') await expand({ node: child, path: `${path}/${i + 1}`, depth: depth + 1 });
      if (child.type === 'component' && depth < 3) {
        const component = input.catalog.find(c => c.id === kind);
        child.slots = [];
        if (!component?.slots?.length && /\b(layout|card)\b/i.test(component?.name || '')) warnings.push(`${component.name}: nie wykryto natywnego slotu Content. Wnętrze komponentu nie zostało rozwinięte.`);
        for (const descriptor of component?.slots || []) {
          if (!descriptor.capacity) { warnings.push(`${component.name} / Content: brak miejsca na nowe dzieci.`); continue; }
          const content = { path: descriptor.path, children: [] };
          child.slots.push(content);
          await expand({ node: { children: content.children, width: descriptor.width === 'HUG' ? 'HUG' : 'FILL', height: descriptor.height === 'HUG' ? 'HUG' : 'FILL' }, path: `${path}/${i + 1}/Content[${descriptor.path.join('.')}]`, depth: depth + 1, slot: descriptor, owner: { id: component.id, name: component.name } });
        }
      }
    }
    debug(0, { reason: 'subtree-complete' });
  }
  await expand({ node: tree, path: insertionSlot ? 'Content' : 'technical-root', depth: 0, slot: insertionSlot });
  const finalCoverage = requirementState(requiredRequirements, tree, tree, input.catalog);
  if (finalCoverage.remainingRequirements.length) warnings.push(`Unfulfilled requirements: ${finalCoverage.remainingRequirements.map(r => `${r.id}: ${r.purpose}`).join(', ')}`);
  return { mode: 'create', tree, trace, warnings, ...finalCoverage };
}

async function edit(input, decide) {
  const nodes = input.context.nodes;
  const targets = nodes.filter(n => n.contentSlot?.capacity > 0);
  if (targets.length) {
    const action = await decide({ prompt: input.prompt, context: input.context }, {
      action: choice('Does the user explicitly request adding NEW children to a Content slot? Otherwise edit existing properties.', { edit: 'Change existing properties only', insert: 'Append new children to Content without replacing existing ones' }),
    });
    if (action.action === 'insert') {
      const answer = targets.length === 1 ? { target: targets[0].id } : await decide({ prompt: input.prompt, context: input.context }, {
        target: choice('Which Content slot should receive the requested new children?', Object.fromEntries(targets.map(n => [n.id, `${n.name}, parent ${n.parentId}`])))
      });
      const target = targets.find(n => n.id === answer.target);
      if (!target) throw new Error('Nieprawidłowy slot docelowy.');
      const result = await create(input, decide, target.contentSlot);
      if (!result.tree.children.length) throw new Error('JEV nie wybrał dzieci do dodania. Doprecyzuj prompt.');
      return { ...result, mode: 'insert', targetId: input.context.targetId, parentId: target.id, children: result.tree.children };
    }
  }
  const texts = textCandidates(input.prompt, nodes);
  const questions = {};
  const bindings = [];
  function add(node, field, criteria) {
    const key = `q${bindings.length}`;
    questions[key] = choice(`For node ${node.id} (${node.name}), choose ${field}. Keep existing value unless the prompt asks to change it.`, { keep: 'Preserve current value', ...criteria });
    bindings.push({ key, id: node.id, field });
  }
  for (const node of nodes) {
    if (node.layout) add(node, 'direction', directions);
    for (const axis of ['width', 'height']) {
      const allowed = node.sizing?.[axis]?.allowed || [];
      if (allowed.length) add(node, axis, Object.fromEntries(allowed.map(value => [value, sizing[value]])));
    }
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
    if (b.field === 'text') value = texts[Number(selected.slice(1))];
    if (b.field.startsWith('property:')) {
      const def = nodes.find(n => n.id === b.id).properties[b.field.slice(9)];
      value = def.type === 'BOOLEAN' ? selected === 'true' : (def.type === 'TEXT' ? texts : def.options)[Number(selected.slice(1))];
    }
    operations.push({ id: b.id, field: b.field, value });
  }
  return { mode: 'edit', targetId: input.context.targetId, operations };
}
