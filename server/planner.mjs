import { resolveTree, ask, validateCatalog } from './resolver.mjs';
import { choice } from './jev.mjs';

const noChange = 'JEV nie wybrał żadnej zmiany. Sprawdź dostępne właściwości elementu i komponenty wybranej biblioteki.';
const label = c => `${c.name}${c.description ? `: ${c.description}` : ''}`;
const choices = list => Object.fromEntries(list.map(c => [c.id, label(c)]));

function instanceLabel(node) {
  const labels = Object.entries(node.properties || {})
    .filter(([name, property]) => name.split('#')[0].trim().toLowerCase() === 'label' && property.type === 'TEXT' && typeof property.value === 'string' && property.value.trim())
    .map(([, property]) => property.value);
  return `${label(node)}${labels.length ? `; Label: ${[...new Set(labels)].map(value => JSON.stringify(value)).join(', ')}` : ''}`;
}

// Instances inside other instances are implementation details, except when
// reached through an editable slot. The selected instance itself is always UI.
function isUI(node, nodes, targetId) {
  if (node.id === targetId) return true;
  let parent = nodes.find(n => n.id === node.parentId);
  const seen = new Set();
  while (parent && !seen.has(parent.id)) {
    if (parent.type === 'SLOT') return true;
    if (parent.type === 'INSTANCE') return false;
    seen.add(parent.id); parent = nodes.find(n => n.id === parent.parentId);
  }
  return true;
}

function pathLabel(node, nodes, targetId) {
  const names = [node.name]; const seen = new Set([node.id]);
  let parent = nodes.find(n => n.id === node.parentId);
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    if (parent.type === 'INSTANCE' || parent.id === targetId) names.unshift(parent.name);
    parent = nodes.find(n => n.id === parent.parentId);
  }
  return names.join(' / ');
}

export async function plan(input, decide) {
  if (!input || typeof input !== 'object') throw new Error('Nieprawidłowe wejście.');
  validateCatalog(input.catalog);
  if (!input.context) return resolveTree(input, decide);
  return editSelected(input, decide);
}

async function editSelected(input, decide) {
  const { context, prompt, catalog } = input;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000 || !Array.isArray(context.nodes) || !context.nodes.length) throw new Error('Wpisz prompt i zaznacz element.');
  const target = context.nodes.find(n => n.id === context.targetId) || context.nodes[0];
  if (target.type === 'VECTOR') throw new Error('Zaznacz komponent lub kontener zamiast wewnętrznej warstwy wektorowej.');
  const { action } = await ask({ prompt }, {
    action: choice('Choose intent. Showing/hiding an existing icon or label, changing an icon or variant is properties. Only explicit additions/removals of whole components use insert/remove.', { properties: 'Edit component properties', insert: 'Add a component', remove: 'Remove an element' })
  }, decide);

  if (action === 'insert') {
    const slots = context.nodes.filter(n => n.contentSlot?.capacity > 0);
    if (context.parent?.contentSlot?.capacity > 0) slots.push(context.parent);
    if (!slots.length) throw new Error('Brak wolnego slotu Content w zaznaczonym elemencie i jego dzieciach.');
    if (!catalog.length) throw new Error('Biblioteka nie zawiera komponentów.');
    const { component } = await ask({ prompt }, {
      component: choice('Choose the component/variant to add. Unspecified properties retain library defaults. none if unavailable.', { none: 'No suitable component', ...choices(catalog) })
    }, decide);
    if (component === 'none') return { mode: 'edit', targetId: context.targetId, operations: [], warnings: [noChange] };
    const selected = catalog.find(c => c.id === component);
    const destinations = Object.fromEntries(slots.map(n => {
      const children = n.contentSlot.existingChildren || context.nodes.filter(child => child.parentId === n.id);
      const names = [...new Set(children.filter(child => child.type !== 'VECTOR').map(child => child.name))];
      const location = n === context.parent
        ? `[PARENT OF SELECTED — adds a sibling] ${[n.ownerName, n.name].filter(Boolean).join(' / ')}`
        : `${n.id === context.targetId ? '[SELECTED] ' : ''}${pathLabel(n, context.nodes, context.targetId)}`;
      return [n.id, `${location}${names.length ? `; direct children: ${JSON.stringify(names)}` : ''}`];
    }));
    const { target: parentId } = await ask({ prompt, component: selected.name, selected: target.name }, {
      target: choice('Choose destination slot. Honor an explicitly requested destination or selected slot. "Add another" of the selected kind means its parent slot: add a sibling. Otherwise first prefer a slot already containing components of the same kind: add beside them as a sibling, not inside an existing component of that kind. Direct children lists identify existing siblings; names in a path identify ancestors, not siblings. If no such group exists, prefer placing new components inside a Card: choose its Content or an appropriate slot within it. If no Card slot is available, prefer Content of the selected element, then the nearest suitable slot. Only choose from the offered slots; do not create a Card or change the hierarchy. The component being added is not itself the destination.', destinations)
    }, decide);
    // No recursive resolution or size/property survey after the two choices.
    return { mode: 'insert', exactTree: true, targetId: context.targetId, parentId, children: [{ type: 'component', componentId: selected.id, width: 'KEEP', height: 'KEEP' }] };
  }

  if (action === 'remove') {
    const removable = context.nodes.filter(n => n.removable && n.type !== 'VECTOR' && isUI(n, context.nodes, context.targetId));
    if (!removable.length) throw new Error('Zaznaczona warstwa i jej dzieci nie mogą zostać usunięte. Wybierz całą instancję lub element w edytowalnym kontenerze.');
    // Short model-facing references stay local to this choice; the renderer still receives Figma IDs.
    const candidates = Object.fromEntries(removable.map((n, i) => [`r${i}`, n]));
    const nameCounts = new Map();
    for (const n of removable) nameCounts.set(n.name, (nameCounts.get(n.name) || 0) + 1);
    const selected = Object.keys(candidates).find(key => candidates[key].id === context.targetId) || null;
    const { target: reference } = await ask({ prompt, selected }, {
      target: choice('Choose the element to remove by its own name/meaning or Label (UI text), matching across languages. An explicitly named target takes priority over selection. Selection defines the search scope, not the default removal target for a named request. Only generic requests such as "usuń element" or "delete this" mean selected. Paths only distinguish namesakes; an ancestor is not a match for its descendant. Choose none if no target matches.', {
        none: 'No matching element',
        ...Object.fromEntries(Object.entries(candidates).map(([key, n]) => [key, `${instanceLabel(n)}${nameCounts.get(n.name) > 1 ? ` (path: ${pathLabel(n, context.nodes, context.targetId)})` : ''}`]))
      })
    }, decide);
    const node = reference === 'none' ? null : candidates[reference];
    console.log('REMOVAL TARGET', JSON.stringify({ reference, nodeId: node?.id ?? null, name: node?.name ?? null }));
    return { mode: 'remove', targetId: context.targetId, nodeId: node?.id ?? null };
  }

  const components = target.type === 'INSTANCE' ? [target] : context.nodes.filter(n => n.type === 'INSTANCE' && isUI(n, context.nodes, context.targetId));
  if (!components.length) return { mode: 'edit', targetId: context.targetId, operations: [], warnings: ['Zaznacz komponent z udostępnionymi właściwościami lub jego kontener.'] };
  let component = components[0];
  if (components.length > 1) {
    const { target: id } = await ask({ prompt }, {
      target: choice('Choose the component whose exposed properties should change. Label is its UI text.', Object.fromEntries(components.map(n => [n.id, instanceLabel(n)])))
    }, decide);
    component = components.find(c => c.id === id);
  }

  const questions = {}; const bindings = [];
  function add(name, criteria, decode = v => v) {
    const key = `q${bindings.length}`;
    questions[key] = choice(name, { keep: 'Unchanged', ...criteria });
    bindings.push({ key, name, decode });
  }
  const copy = prompt.match(/["„“]([^"”\n]+)["”]/)?.[1];
  const properties = {};
  for (const [name, def] of Object.entries(component.properties || {})) {
    if (!['VARIANT', 'BOOLEAN', 'TEXT', 'INSTANCE_SWAP'].includes(def.type)) continue;
    properties[name] = { type: def.type, ...(def.type !== 'INSTANCE_SWAP' ? { value: def.value } : {}), ...(def.description ? { description: def.description } : {}) };
    if (def.type === 'VARIANT' && def.options?.length) add(name, Object.fromEntries(def.options.map((v, i) => [`v${i}`, v])), v => def.options[Number(v.slice(1))]);
    if (def.type === 'BOOLEAN') add(name, { true: 'true', false: 'false' }, v => v === 'true');
    if (def.type === 'TEXT' && copy !== undefined) add(name, { literal: copy }, () => copy);
    // The library is sent only if JEV actually requests a replacement.
    if (def.type === 'INSTANCE_SWAP' && catalog.some(c => c.key)) add(name, { change: 'Replace the component only when a different icon/component is requested. Showing or hiding the existing one means keep.' });
  }
  const answers = await ask({ prompt, component: { name: component.name, description: component.description || '', properties }, instructions: 'Change only requested exposed properties. Show/hide (pokaż/ukryj) changes visibility BOOLEAN only; keep INSTANCE_SWAP unchanged. Replace INSTANCE_SWAP only when a different icon/component is requested, enabling its visibility when needed. Size requests use Size variant. No internal layer edits.' }, questions, decide);
  const operations = []; const swaps = {};
  for (const b of bindings) {
    if (answers[b.key] === 'keep') continue;
    if (answers[b.key] === 'change' && component.properties[b.name].type === 'INSTANCE_SWAP') {
      swaps[b.key] = choice(`Replacement for ${b.name}. Match names/descriptions across languages; none if unavailable.`, { none: 'No suitable replacement', ...Object.fromEntries(catalog.filter(c => c.key).map(c => [c.key, label(c)])) });
    } else {
      const value = b.decode(answers[b.key]);
      if (value !== component.properties[b.name].value) operations.push({ id: component.id, field: `property:${b.name}`, value });
    }
  }
  const warnings = [];
  if (Object.keys(swaps).length) {
    const replacements = await ask({ prompt, component: component.name }, swaps, decide);
    for (const [key, value] of Object.entries(replacements)) {
      const name = bindings.find(b => b.key === key).name;
      if (value === 'none') warnings.push(`${name}: JEV nie znalazł zamiennika. Zachowano dotychczasowy komponent.`);
      else operations.push({ id: component.id, field: `property:${name}`, value });
    }
  }
  if (!operations.length) warnings.unshift(noChange);
  return { mode: 'edit', targetId: context.targetId, operations, ...(warnings.length ? { warnings } : {}) };
}
