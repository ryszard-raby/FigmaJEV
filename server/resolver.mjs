import { choice, validateAnswers } from './jev.mjs';
import { parseCompactTree, collectRequired, MAX_TREE_NODES } from './compact-tree.mjs';

const sizes = { KEEP: 'Inherit sizing from the source Design System component on this axis; prefer unless explicitly requested otherwise', HUG: 'Hug contents', FILL: 'Fill container; Figma handles layout dependencies' };
const values = list => Object.fromEntries(list.map((v, i) => [`v${i}`, String(v)]));

export function componentCandidates(node, catalog) {
  const normalize = name => name.trim().toLowerCase().replace(/\s+/g, ' ');
  const requested = normalize(node.name);
  // Name lookup only; variant/intent decisions still belong to JEV.
  const family = catalog.filter(c => normalize(c.name) === requested || c.name.split('/').some(part => normalize(part) === requested));
  const pool = family.length ? family : catalog;
  return pool.filter(c => !node.childCount || (c.slots || []).some(s => (s.settings?.maxChildren ?? MAX_TREE_NODES) >= node.childCount));
}

export async function ask(state, questions, decide) {
  if (!Object.keys(questions).length) return {};
  console.log('JEV REQUEST', JSON.stringify({ state, questions }));
  const result = await decide(state, questions);
  console.log('JEV RESPONSE', JSON.stringify(result));
  // Keep validation at this boundary as well as in the live client.
  validateAnswers(questions, Object.fromEntries(Object.entries(result).map(([k, v]) => [k, { type: 'choice', choice: v }])));
  return result;
}

export function validateCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length > 180 || new Set(catalog.map(c => c?.id)).size !== catalog.length || catalog.some(c => !c || typeof c.id !== 'string' || typeof c.name !== 'string')) throw new Error('Nieprawidłowy katalog (maks. 180 komponentów).');
}

export async function resolveTree(input, decide) {
  validateCatalog(input.catalog);
  const root = parseCompactTree(input.structure);
  const { required, nodeGroups } = collectRequired(root);
  const catalog = input.catalog.map(c => ({ id: c.id, name: c.name, description: c.description || '', defaultSizing: c.defaultSizing, slots: c.slots || [], properties: c.properties || {}, textTargets: c.textTargets || [] }));
  console.log('INPUT TREE', JSON.stringify(input.structure));
  console.log('REQUIRED COMPONENTS', JSON.stringify(required));
  const firstQuestions = {}; const offered = new Set();
  for (const n of required) {
    const pool = componentCandidates(n, catalog);
    pool.forEach(c => offered.add(c.id));
    const candidates = Object.fromEntries(pool.map(c => [c.id, `${c.name}: ${c.description}`]));
    // Native primitives are explicit choices, not automatic fallback mappings.
    if (n.name.toLowerCase() === 'container') candidates.native_container = 'Native auto-layout frame';
    if (n.name.toLowerCase() === 'text' && !n.childCount) candidates.native_text = 'Native Figma text';
    candidates.unresolved = 'No candidate can implement this component or an explicit requirement is impossible. Missing optional properties alone is NOT a reason.';
    firstQuestions[n.id] = choice(`Resolve ${n.id}: ${n.name}, intent ${JSON.stringify(n.properties)}. Choose one real component/variant from the candidates. Unspecified properties impose no constraints: choose a standard/default variant and preserve its defaults. Multiple suitable variants do not mean unresolved. Use names, descriptions and parent intent. Do not add/remove/reorder children. Select unresolved only if no candidate can implement the requested component or explicit requirements.`, candidates);
  }
  const selected = await ask({ phase: 'component-resolution', inputTree: root, requiredComponents: required, catalog: catalog.filter(c => offered.has(c.id)).map(c => ({ id: c.id, name: c.name, description: c.description, slots: c.slots.map(s => ({ name: s.name, settings: s.settings })) })) }, firstQuestions, decide);
  const warnings = [];
  const unmatched = required.filter(n => selected[n.id] === 'unresolved');
  if (unmatched.length) {
    const alternatives = {};
    const offeredAlternatives = new Set();
    for (const n of unmatched) {
      const pool = catalog.filter(c => (!n.childCount || c.slots.some(s => (s.settings?.maxChildren ?? MAX_TREE_NODES) >= n.childCount))
        && (typeof n.properties.text !== 'string' || c.textTargets.length || Object.values(c.properties).some(p => p.type === 'TEXT')));
      pool.forEach(c => offeredAlternatives.add(c.id));
      const candidates = Object.fromEntries(pool.map(c => [c.id, `${c.name}: ${c.description}`]));
      candidates.native_container = 'Native auto-layout frame preserving the requested children';
      if (!n.childCount) candidates.native_text = 'Native Figma text using the supplied literal text';
      alternatives[n.id] = choice(`Propose the closest available implementation for ${n.id}: ${n.name}, intent ${JSON.stringify(n.properties)}. Exact matching failed. Choose the most useful available component based on purpose and parent context, relaxing unsupported appearance or variant requirements. Prefer a library component when suitable; otherwise choose a native frame or text. Preserve child order and supplied text. Do not invent component IDs.`, candidates);
    }
    const proposed = await ask({ phase: 'component-proposal', inputTree: root, requiredComponents: unmatched, catalog: catalog.filter(c => offeredAlternatives.has(c.id)) }, alternatives, decide);
    for (const n of unmatched) {
      selected[n.id] = proposed[n.id];
      const replacement = catalog.find(c => c.id === proposed[n.id])?.name || (proposed[n.id] === 'native_text' ? 'tekst Figmy' : 'kontener Figmy');
      warnings.push(`${n.paths.join(', ')}: brak dokładnego dopasowania dla „${n.name}”. JEV zaproponował: ${replacement}.`);
    }
  }
  const questions = {}; const decoders = new Map();
  function add(n, field, criteria, decode = value => value) {
    const key = `q${decoders.size}`;
    questions[key] = choice(`Resolve ${field} for ${n.id} (${n.name}), intent ${JSON.stringify(n.properties)}. Use selected component and its available definitions. Prefer KEEP for unspecified properties; preserve exact supplied text.`, criteria);
    decoders.set(key, { id: n.id, field, decode });
  }
  for (const n of required) {
    const id = selected[n.id]; const c = catalog.find(c => c.id === id);
    add(n, 'width', sizes);
    add(n, 'height', sizes);
    if (id === 'native_container') {
      add(n, 'direction', { VERTICAL: 'Vertical', HORIZONTAL: 'Horizontal' });
      add(n, 'primaryAlign', { MIN: 'Start along layout direction', CENTER: 'Center along layout direction', MAX: 'End along layout direction', SPACE_BETWEEN: 'Space between children' });
      add(n, 'counterAlign', { MIN: 'Start across layout direction', CENTER: 'Center across layout direction', MAX: 'End across layout direction' });
    }
    if (id === 'native_text') {
      const text = typeof n.properties.text === 'string' ? n.properties.text : '';
      add(n, 'text', { literal: `Exact text: ${JSON.stringify(text)}` }, () => text);
      const fontSizes = [...new Set([12, 14, 16, 20, 24, 32, 40, ...(typeof n.properties.fontSize === 'number' ? [n.properties.fontSize] : [])])].filter(v => v >= 1 && v <= 300);
      add(n, 'fontSize', values(fontSizes), value => fontSizes[Number(value.slice(1))]);
    }
    if (c) {
      if (n.childCount) add(n, 'slot', Object.fromEntries(c.slots.map((s, i) => [`s${i}`, `${s.name}, replacement capacity ${s.settings?.maxChildren ?? MAX_TREE_NODES}, settings ${JSON.stringify(s.settings || {})}`]).filter((_, i) => (c.slots[i].settings?.maxChildren ?? MAX_TREE_NODES) >= n.childCount)), value => c.slots[Number(value.slice(1))]);
      // Variants are already resolved by choosing an exact catalog component in pass 1.
      for (const [property, def] of Object.entries(c.properties)) {
        if (def.type === 'BOOLEAN') add(n, `property:${property}`, { KEEP: 'Keep current value', true: 'true', false: 'false' }, v => v === 'KEEP' ? undefined : v === 'true');
        if (def.type === 'TEXT') {
          const literals = Object.entries(n.properties).filter(([, value]) => typeof value === 'string');
          if (literals.length) add(n, `property:${property}`, { KEEP: 'Keep current value', ...Object.fromEntries(literals.map(([key, value], i) => [`literal${i}`, `${key}: ${JSON.stringify(value)}`])) }, v => v === 'KEEP' ? undefined : literals[Number(v.slice(7))][1]);
        }
        if (def.type === 'INSTANCE_SWAP') {
          add(n, `property:${property}`, { KEEP: 'Keep current component', ...Object.fromEntries(input.catalog.filter(item => item.key).map(item => [item.key, item.name])) }, v => v === 'KEEP' ? undefined : v);
        }
      }
      if (typeof n.properties.text === 'string') for (const [i, target] of c.textTargets.entries()) add(n, `textTarget:${i}`, { KEEP: 'Keep existing text', literal: `Replace ${target.name} with ${JSON.stringify(n.properties.text)}` }, v => v === 'KEEP' ? undefined : { path: target.path, text: n.properties.text });
    }
  }
  const answers = await ask({ phase: 'property-resolution', inputTree: root, requiredComponents: required, selectedComponents: selected, catalog: catalog.filter(c => Object.values(selected).includes(c.id)), sizingRule: 'Prefer KEEP for unspecified sizing. Figma handles Hug/Fill dependencies. For align:right with horizontal direction choose primary MAX; with vertical direction choose counter MAX. TEXT property candidates are literal input values: only assign actual copy, never copy semantic hints such as primary or password unless explicitly requested as visible text.' }, questions, decide);
  const resolved = new Map(required.map(n => [n.id, {}]));
  for (const [key, binding] of decoders) resolved.get(binding.id)[binding.field] = binding.decode(answers[key]);
  function assemble(node) {
    const group = nodeGroups.get(node.path); const id = selected[group]; const fields = resolved.get(group);
    const children = node.children.map(assemble);
    const base = { width: fields.width, height: fields.height, sourcePath: node.path };
    if (id === 'native_container') {
      if (typeof node.properties.text === 'string') children.unshift({ type: 'text', text: node.properties.text, width: 'KEEP', height: 'KEEP' });
      return { ...base, type: 'container', name: node.name, direction: fields.direction, primaryAlign: fields.primaryAlign, counterAlign: fields.counterAlign, children };
    }
    if (id === 'native_text') return { ...base, type: 'text', text: fields.text, fontSize: fields.fontSize };
    const properties = Object.fromEntries(Object.entries(fields).filter(([k, v]) => k.startsWith('property:') && v !== undefined).map(([k, v]) => [k.slice(9), v]));
    const textOverrides = Object.entries(fields).filter(([k, v]) => k.startsWith('textTarget:') && v !== undefined).map(([, v]) => v);
    if (typeof node.properties.text === 'string' && !Object.entries(properties).some(([k, v]) => input.catalog.find(c => c.id === id)?.properties?.[k]?.type === 'TEXT' && v === node.properties.text) && !textOverrides.length) throw new Error(`${node.path}: JEV nie wskazał właściwości ani warstwy dla podanego tekstu.`);
    const component = catalog.find(c => c.id === id);
    // Empty declared content means empty slots, rather than inherited demo children.
    const slots = component.slots.map(slot => ({ path: slot.path, mode: 'replace', children: fields.slot === slot ? children : [] }));
    return { ...base, type: 'component', componentId: id, properties, textOverrides, slots };
  }
  const tree = assemble(root);
  console.log('RESOLVED TREE', JSON.stringify(tree));
  return { mode: 'create', tree, exactTree: true, warnings, resolutionCount: required.length };
}
