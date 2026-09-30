export const DEFAULT_STRUCTURE = ['Layout', { device: 'mobile' }, ['Card', ['Container', ['Button']]]];
export const MAX_TREE_NODES = 256;
export const MAX_TREE_LEVELS = 32;

export function parseCompactTree(source) {
  let value = source;
  if (typeof source === 'string') {
    if (source.length > 40000) throw new Error('Struktura projektu przekracza 40 000 znaków.');
    try { value = JSON.parse(source); } catch { throw new Error('Struktura projektu: nieprawidłowy JSON. Użyj tablic ["Component", properties?, ...children].'); }
  }
  let count = 0;
  function parse(node, path, depth) {
    if (++count > MAX_TREE_NODES) throw new Error(`Struktura projektu: przekroczono ${MAX_TREE_NODES} elementów (${path}).`);
    if (depth >= MAX_TREE_LEVELS) throw new Error(`Struktura projektu: przekroczono ${MAX_TREE_LEVELS} poziomy (${path}).`);
    if (!Array.isArray(node) || typeof node[0] !== 'string' || !node[0].trim() || node[0].length > 200) throw new Error(`${path}: oczekiwano [componentName, properties?, ...children].`);
    let offset = 1; let properties = {};
    if (node[1] !== null && typeof node[1] === 'object' && !Array.isArray(node[1])) {
      properties = node[1]; offset = 2;
      if (Object.keys(properties).length > 24) throw new Error(`${path}: zbyt wiele properties.`);
      for (const [key, v] of Object.entries(properties)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key) || !['string', 'number', 'boolean'].includes(typeof v) || (typeof v === 'number' && !Number.isFinite(v)) || (typeof v === 'string' && v.length > 1000)) throw new Error(`${path}: properties muszą zawierać krótkie wartości string/number/boolean.`);
      }
    }
    return { path, name: node[0].trim(), properties, children: node.slice(offset).map((child, i) => parse(child, `${path}/${i}`, depth + 1)) };
  }
  return parse(value, 'root', 0);
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function collectRequired(root, candidatesFor) {
  const groups = new Map(); const nodeGroups = new Map();
  function visit(node) {
    // Literal copy and sizing are executed locally, not component-selection intent.
    // Different candidate sets keep slot/capacity constraints separate.
    const properties = Object.fromEntries(Object.entries(node.properties).filter(([key]) => !['text', 'width', 'height', 'slot'].includes(key)));
    const candidateIds = candidatesFor(node).map(c => c.id);
    const key = canonical({ name: node.name, properties, candidateIds });
    if (!groups.has(key)) groups.set(key, { id: `n${groups.size}`, name: node.name, properties, childCount: node.children.length, candidateIds, paths: [] });
    const group = groups.get(key); group.paths.push(node.path); nodeGroups.set(node.path, group.id);
    group.childCount = Math.max(group.childCount, node.children.length);
    for (const child of node.children) visit(child);
  }
  visit(root);
  return { required: [...groups.values()], nodeGroups };
}
